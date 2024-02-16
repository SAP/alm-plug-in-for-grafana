import defaults from 'lodash/defaults';
import moment from 'moment-timezone';

import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
  DataQueryError,
  DateTime,
  TimeRange,
  MetricFindValue,
  RawTimeRange,
  Labels,
} from '@grafana/data';

import { BackendSrvRequest, FetchResponse, getBackendSrv, getTemplateSrv } from '@grafana/runtime';
import {
  MyQuery,
  MyDataSourceOptions,
  DEFAULT_QUERY,
  TextValuePair,
  DPFilterResponse,
  DataProviderFilter,
  MyVariableQuery,
  DataProviderConfig,
} from './types';
import { merge, Observable, lastValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { FDoW, Format, Resolution } from 'format';

const routePath = '/analytics';
const dpListPath = '/providers';
const dpFiltersPath = '/providers/filters';
const dpDataPath = '/providers/data';
const predefAlias = "zudr";

export interface RequestQuery {
  [key: string]: any;
}

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  resolution: Resolution;
  url: string;
  withCredentials: boolean;
  oauthPassThru: boolean;
  isFRUN: boolean;
  isPredefined?: boolean;
  alias: string;
  headers: any;
  almUid: string;
  dataProviderConfigs: { [key: string]: DataProviderConfig };
  isUpdatingCSRFToken: boolean;

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);

    this.almUid = (Date.now() + Math.floor(Math.random() * 100000)).toString();

    this.url = instanceSettings.url ? instanceSettings.url : '';

    this.withCredentials = instanceSettings.withCredentials !== undefined;

    this.isFRUN = instanceSettings.jsonData.isFRUN ? instanceSettings.jsonData.isFRUN : false;

    this.isPredefined = instanceSettings.jsonData.isPredefined;

    this.alias = instanceSettings.jsonData.alias ? instanceSettings.jsonData.alias : '';

    this.oauthPassThru = instanceSettings.jsonData['oauthPassThru'] ?? false;

    this.resolution = instanceSettings.jsonData.resolution ?? Resolution.Hour;

    this.dataProviderConfigs = instanceSettings.jsonData.dataProviderConfigs ?? {};

    this.isUpdatingCSRFToken = false;
    this.headers = { 'Content-Type': 'application/json' };
    if (this.isFRUN) {
      // Fetch CSRF token
      this.updateCSRFToken();
    }
    if (typeof instanceSettings.basicAuth === 'string' && instanceSettings.basicAuth.length > 0) {
      this.headers['Authorization'] = instanceSettings.basicAuth;
    }
  }

  fetchData(options: BackendSrvRequest, process: Function, complete?: Function, errHandled?: boolean): Observable<any> {
    return getBackendSrv()
      .fetch(options)
      .pipe(
        map((response: FetchResponse) => {
          let result;
          if (response.data.error) {
            if (complete) {
              complete();
            }
            if (errHandled) {
              result = process(response);
            } else {
              let cid = "", cidh = "x-correlationid";
              if (response.headers.has(cidh)) {
                cid = `Correlation Id: ${response.headers.get(cidh)}`;
              }
              let msg = `${response.data.message} ${cid}`;
              throw new Error(`Error ${response.status}: ${response.statusText} - ${msg}`);
            }
          } else {
            result = process(response);
          }
          if (complete) {
            complete();
          }
          return result;
        })
      );
  }

  processCSRFResponse(response: FetchResponse) {
    if (response.headers.has('X-CSRF-Token') && response.headers.get('X-CSRF-Token') !== null) {
      this.headers['X-CSRF-Token'] = response.headers.get('X-CSRF-Token');
    }
  }

  updateCSRFToken() {
    this.isUpdatingCSRFToken = true;
    const options = {
      url: this.url,
      method: 'GET',
      headers: { ...this.headers, 'X-CSRF-Token': 'fetch' },
    };

    this.fetchData(options, this.processCSRFResponse, () => { this.isUpdatingCSRFToken = false; }).subscribe();
  }

  getFiltersForQuery(filters: DataProviderFilter[], options?: DataQueryRequest<MyQuery>) {
    let f = [];
    for (const filter of filters) {
      if (filter.key.value) {
        let tf: { key: string | undefined; values: string[] } = {
          key: filter.key.value,
          values: [],
        };
        filter.values.forEach((v) => {
          // Check for variables
          if (v.value) {
            if (v.value?.startsWith('$') || v.value?.startsWith('{{')) {
              let t = getTemplateSrv().replace(v.value, options ? options.scopedVars : {}, 'csv');
              t.split(',').forEach((ts) => {
                tf.values.push(ts);
              });
            } else {
              // Otherwise simply add
              tf.values.push(v.value);
            }
          }
        });
        f.push(tf);
      }
    }
    return f;
  }

  getDPVersion(dp?: string, isForPath?: boolean): string {
    let dpv = '';
    if (dp && this.dataProviderConfigs && this.dataProviderConfigs[dp]) {
      dpv = this.dataProviderConfigs[dp].version.value ?? '';
      if (dpv === 'LATEST') {
        // Empty it out if version is latest, since empty is, by default, latest
        dpv = '';
      }
    }
    if (dpv !== '' && isForPath) {
      dpv = `/${dpv}`;
    }
    return dpv;
  }

  // Try to parse target to suitable query data format for request
  // The query contains name (string), dataProvider (string: name of data provider)
  // and filters (array of key (string) and values (string array) pair)
  getQueryForRequest(target: MyQuery, options: DataQueryRequest<MyQuery>): RequestQuery {
    const t = defaults(target, DEFAULT_QUERY);
    const dpv = this.getDPVersion(t.dataProvider.value);
    let query: RequestQuery = {
      name: t.name,
      provider: t.dataProvider.value,
      version: dpv !== '' ? dpv : undefined,
      columns: {
        dimensions: [],
        metrics: [],
      },
      filters: this.getFiltersForQuery(t.dataProviderFilters, options),
    };

    // Populate drilldowns
    if (t.drilldown.dimensions.length > 0) {
      t.drilldown.dimensions.forEach((v) => {
        // Check for variables
        if (v.value?.substring(0, 1) === '$' || v.value?.substring(0, 2) === '{{') {
          let t = getTemplateSrv().replace(v.value, options.scopedVars, 'csv');
          t.split(',').forEach((ts) => {
            query.columns.dimensions.push(ts);
          });
        } else {
          // Otherwise simply add
          query.columns.dimensions.push(v.value);
        }
      });
    }
    if (t.drilldown.measures.length > 0) {
      t.drilldown.measures.forEach((v) => {
        // Check for variables
        if (v.value?.value?.substring(0, 1) === '$' || v.value?.value?.substring(0, 2) === '{{') {
          let t = getTemplateSrv().replace(v.value.value, options.scopedVars, 'csv');
          t.split(',').forEach((ts) => {
            query.columns.metrics.push({ measure: ts, method: v.aggrMethod.value });
          });
        } else if (v.value.value) {
          // Otherwise simply add
          query.columns.metrics.push({ measure: v.value.value, method: v.aggrMethod.value });
        }
      });
    }

    return query;
  }

  getIntNumberInString(num: number, length = 2, withSign = false): string {
    let str = '';
    let temp = Math.trunc(num < 0 ? num * -1 : num);
    let numstr: string = temp.toString();

    // Do only if number length is less than required length
    // Else return the number as string
    if (length > numstr.length) {
      // Reput sign if possible
      if (num < 0) {
        str = '-';
      } else if (withSign) {
        str = '+';
      }
      // Prepend the missing 0s
      let rest = length - numstr.length;
      for (let i = 0; i < rest; i++) {
        str = str + '0';
      }
      // Put back the number
      str = str + numstr;
    } else {
      str = numstr;
    }
    return str;
  }

  // Parse datetime object to timestamp string with format YYYYMMDDhhmmss
  getTimeStampForRequest(dt: DateTime): string {
    let d = dt.toDate();
    let YYYY = this.getIntNumberInString(d.getFullYear(), 4);
    let MM = this.getIntNumberInString(d.getMonth() + 1);
    let DD = this.getIntNumberInString(d.getDate());
    let hh = this.getIntNumberInString(d.getHours());
    let mm = this.getIntNumberInString(d.getMinutes());
    let ss = this.getIntNumberInString(d.getSeconds());

    let s = `${YYYY}${MM}${DD}${hh}${mm}${ss}`;
    return s;
  }

  translateToPeriodUnit(unit: string): string {
    if (unit) {
      switch (unit) {
        case 'h':
          return 'H';
        case 'd':
          return 'D';
        case 'w':
          return 'W';
        case 'M':
          return 'M';
        case 'y':
          return 'Y';
        default:
          return 'Mi';
      }
    }
    return '';
  }

  getPeriodForRequest(rangeRaw: RawTimeRange, resolution: string): string {
    let period = '';

    // Full format can be now-2d/d for both from and to.
    // Period prefix is get from from.
    // Period number and suffix are get from to.

    // If range's raw data is provided as string, meaning relative time is provided.
    if (rangeRaw && typeof rangeRaw.from === 'string' && typeof rangeRaw.to === 'string') {
      // Currently not support for the day before yesterday or future date, we have only last and current.

      // Check to for prefix.
      let rrts = rangeRaw.to.split('+');
      if (!rrts[1]) {
        let rrtu = rangeRaw.to.split('/');
        rrts = rrtu[0].split('-');
        if (rrts.length === 2 && rrts[0] === 'now') {
          // Get number from first split.
          let rrtn = Number(rrts[1].substring(0, rrts[1].length - 1));
          // More than 1 is not supported as stated.
          if (rrtn === 1) {
            // Set L (last) as period prefix.
            period = period + 'L';
          }
        } else if (rrts[0] === 'now') {
          // Set C (current) as period prefix.
          period = period + 'C';
        }
      }

      // Continue if there's prefix.
      if (period !== '') {
        // Check from for number and suffix.
        let rrfs = rangeRaw.from.split('+');
        if (!rrfs[1]) {
          let rrfu = rangeRaw.from.split('/');
          rrfs = rrfu[0].split('-');
          let rrfn;
          let rrfsu;
          if (rrfs.length === 2 && rrfs[0] === 'now') {
            // Get number from first split.
            rrfn = Number(rrfs[1].substring(0, rrfs[1].length - 1));
            rrfsu = rrfs[1].substring(rrfs[1].length - 1);
            rrfsu = this.translateToPeriodUnit(rrfsu);
          } else if (rrfs[0] === 'now') {
            // Set period number to 1.
            rrfn = '1';
            // Set suffix to requested unit or hour by default.
            if (rrfu[1]) {
              rrfsu = this.translateToPeriodUnit(rrfu[1]);
            } else {
              rrfsu = 'H';
            }
          }

          if (rrfsu && rrfn) {
            // Check for restriction of raw resolution.
            // if (resolution === Resolution.Raw && (rrfn > 2 || rrfsu !== 'H')) {
            //   rrfsu = 'H';
            //   rrfn = '2';
            // }

            // Set period number and unit.
            period = period + rrfn + rrfsu;
          }
        }
      }
    }

    return period;
  }

  getAutomaticResolution(options: { maxDataPoints?: number; range: TimeRange }): string {
    let maxDataPoints = options.maxDataPoints ?? 101;

    // Get range in minutes
    // let dFrom = options.range.from.toDate().getTime() / (1000 * 60);
    // let dTo = options.range.to.toDate().getTime() / (1000 * 60);
    // Get the differences in minutes
    let nCal = options.range.to.diff(options.range.from, 'minutes');
    
    let aRes = [
      Resolution.Min5,
      Resolution.Min10,
      Resolution.Min15,
      Resolution.Min30,
      Resolution.Hour,
      Resolution.Day,
      Resolution.Week,
      Resolution.Month,
      Resolution.Year
    ], aDiv = [
      5, 10, 15, 30, 60, (60*24), (60*24*7), (60*24*30), (60*24*365)
    ];
    
    let iIdx = 0;
    while (aDiv[iIdx] && (nCal / aDiv[iIdx] > maxDataPoints)) {
      iIdx++;
    }

    return aRes[Math.min(iIdx, aRes.length - 1)];
  }

  getLinuxTimeFromTimeStamp(ts: string, tz?: string): number {
    let D;
    let y = Number(ts.substring(0, 4)),
        m = Number(ts.substring(4, 6)) - 1,
        d = Number(ts.substring(6, 8)),
        h = Number(ts.substring(8, 10)),
        mi = Number(ts.substring(10, 12)),
        s = Number(ts.substring(12, 14))

    if (tz && tz !== null) {
      D = new Date(`${y}-${m}-${d}T${h}:${mi}:${s}.000${tz}`);
    } else {
      D = new Date(
        Date.UTC(y,m,d,h,mi,s)
      );
    }
    
    return D.getTime();
  }

  parseSeriesPoints(points: Array<{ x: any; y: any }>): any[] {
    let pp: any[] = [];

    points.forEach((p) => {
      pp.push([p.y, this.getLinuxTimeFromTimeStamp(p.x)]);
    });

    return pp;
  }

  getErrorFromResponse(response: FetchResponse): DataQueryError {
    let cid = "", cidh = "x-correlationid";
    if (response.headers.has(cidh)) {
      cid = `Correlation Id: ${response.headers.get(cidh)}`;
    }
    let msg = `${response.data.message} - ${cid}`;
    const error = {
      data: {
        message: msg,
        error: response.data.error,
      },
      status: response.status,
      statusText: response.statusText,
    };

    return error;
  }

  sortSeriesDataPoints(points: number[][]) {
    points.sort((p1: number[], p2: number[]) => {
      return p1[1] - p2[1];
    });
  }

  getLogLevelByMsgType(type: string): string {
    switch (type) {
      case "W":
        return "warn";
      case "E":
        return "error";
      default:
        return "info";
    }
  }

  getDataFrameForLogs(response: FetchResponse): MutableDataFrame | undefined {
    const headerField = "sap-message";
    if (!response.headers.has(headerField) && !response.data.error) {
      return undefined;
    }

    const frame = new MutableDataFrame({
      fields: [
        {
          name: 'time',
          type: FieldType.time,
        },
        {
          name: 'content',
          type: FieldType.string,
        },
        {
          name: 'level',
          type: FieldType.string,
        },
      ],
    });

    if (response.data.error) {
      let cid = "", cidh = "x-correlationid";
      if (response.headers.has(cidh)) {
        cid = `Correlation Id: ${response.headers.get(cidh)}`;
      }
      let msg = `${response.data.message} ${cid}`;
      frame.add({time: Date.now(), content: msg, level: this.getLogLevelByMsgType("E")});
    }

    let sapMsg = response.headers.get(headerField);
    let allMsgs = JSON.parse(sapMsg ?? "[]");

    allMsgs.forEach((msg: any) => {
      frame.add({time: this.getLinuxTimeFromTimeStamp(`${msg.time}`), content: msg.content, level: this.getLogLevelByMsgType(msg.type)});
    });
    return frame;
  }

  getDataFrameFromTimeSeries(series: any, refId: string): MutableDataFrame {
    let labels: Labels = {};
    series.attributes.forEach((attr: any) => {
      labels[attr.key] = attr.value;
    });

    const frame = new MutableDataFrame({
      refId: refId,
      name: series.serieName,
      fields: [
        {
          name: 'Value',
          type: FieldType.number,
          labels: labels,
          config: {
            displayNameFromDS: series.serieName,
          },
        },
        {
          name: 'Time',
          type: FieldType.time,
        },
      ],
    });

    series.dataPoints.forEach((point: any[]) => {
      frame.appendRow(point);
    });
    return frame;
  }

  getDateFromTS(ts: string, tz: string, resolution: string, fdow = 1): Date {
    let toBegin = {
      mi: ['H', 'D', 'M', 'Y', 'W'],
      h: ['D', 'M', 'Y', 'W'],
      d: ['M', 'Y'],
      m: ['Y']
    };
    let y = ts.substring(0, 4),
      m = (toBegin.m.indexOf(resolution) >= 0) ? '01' : ts.substring(4, 6),
      d = (toBegin.d.indexOf(resolution) >= 0) ? '01' : ts.substring(6, 8),
      h = (toBegin.h.indexOf(resolution) >= 0) ? '00' : ts.substring(8, 10),
      mi = (toBegin.mi.indexOf(resolution) >= 0) ? '00' : ts.substring(10, 12);
    
    // Take care of weekly granularity to look for first day of the week
    if (resolution === 'W') {
      let val = new Date(`${y}-${m}-${d}T${h}:${mi}:00.000${tz}`);
      let cd = val.getDay();
      let diff = (cd - fdow) * 24 * 60 * 60 * 1000;
      let newVal = new Date(val.getTime() - diff);
      let td = newVal.getDate().toString();
      d = td.length < 2 ? `0${td}` : td;
    }

    return new Date(`${y}-${m}-${d}T${h}:${mi}:00.000${tz}`);
  }

  getPossibleTimestamps(settings: any): number[] {
    let ts: number[] = [];

    if (!settings?.resolution || !settings?.timeRange || !settings?.timezone) {
      return ts;
    }

    // When there is from-to as period
    if (settings.timeRange.from && settings.timeRange.to) {
      let oF = this.getDateFromTS(settings.timeRange.from, settings.timezone, settings.resolution);
      let oT = this.getDateFromTS(settings.timeRange.to, settings.timezone, settings.resolution);
      let tsF = oF.getTime();
      let tsT = oT.getTime();
      let step = 0;

      if (!isNaN(tsF) && !isNaN(tsT)) {
        switch (settings.resolution) {
          case 'H':
            step = 60 * 60000;
            break;
          case 'D':
            step = 24 * 60 * 60000;
            break;
          case 'W':
            step = 7 * 24 * 60 * 60000;
            break;
          case 'M':
            step = 30 * 24 * 60 * 60000;
            break;
          case 'Y':
            step = 365 * 24 * 60 * 60000;
            break;
          case '5Mi':
            step = 5 * 60000;
            break;
          case '10Mi':
            step = 10 * 60000;
            break;
          case '15Mi':
            step = 15 * 60000;
            break;
          case '30Mi':
            step = 30 * 60000;
            break;
          default:
            step = 60000;
        }

        ts.push(tsF);
        while (tsF + step <= tsT) {
          tsF = tsF + step;
          ts.push(tsF);
        }
      }
    }

    return ts;
  }

  insertPointToSeries(series: any, idx: number, ts: number, value: string | number | null, settings: any) {
    // Before inserting, need to check if they represent the same point granularitily speaking
    // For example, if resolution is 'D' (Day), then 20020202000000 and 20020202101010 are the same
    let seriesDate = new Date(series.dataPoints[idx][1]);
    let insertDate = new Date(ts);
    let scales =  ['Y', 'M', 'D', 'H', 'Mi', 'S'];
    let stop;
    switch (settings.resolution) {
      case 'Y':
        stop = 'M';
        break;
      case 'W':
      case 'M':
        stop = 'D';
        break;
      case 'D':
        stop = 'H';
        break;
      case 'H':
        stop = 'Mi';
        break;
      default:
        stop = 'S';
    }
    let is = 0;
    let bSame = true;

    while (scales[is] !== stop && is < scales.length) {
      let v1, v2;
      switch (scales[is]) {
        case 'Y':
          v1 = seriesDate.getFullYear();
          v2 = insertDate.getFullYear();
          break;
        case 'M':
          v1 = seriesDate.getMonth();
          v2 = insertDate.getMonth();
          break;
        case 'D':
          v1 = seriesDate.getDate();
          v2 = insertDate.getDate();
          break;
        case 'H':
          v1 = seriesDate.getHours();
          v2 = insertDate.getHours();
          break;
        default:
          v1 = seriesDate.getMinutes();
          v2 = insertDate.getMinutes();
      }
      if (v1 !== v2) {
        bSame = false;
        break;
      }
      is++;
    }

    if (!bSame) {
      series.dataPoints.splice(idx, 0, [value, ts]);
    }
  }

  fillSeriesGaps(series: any, value: string | number | null, settings: any) {
    if (!settings?.resolution || settings?.resolution === 'R' || !settings?.timeRange) {
      return;
    }

    // Get all possible timestamps
    let aTS = this.getPossibleTimestamps(settings);

    // Check needed to fill
    if (aTS.length > series.dataPoints.length) {
      let iS = 0,
        iT = 0;
      while (iS < series.dataPoints.length) {
        if (series.dataPoints[iS][1] > aTS[iT]) {
          this.insertPointToSeries(series, iS, aTS[iT], value, settings);
          iT++;
        } else if (series.dataPoints[iS][1] === aTS[iT]) {
          iS++;
          iT++;
        } else {
          iS++;
        }
      }
      while (iT < aTS.length) {
        series.dataPoints.push([value, aTS[iT]]);
        iT++;
      }
    }
  }

  checkResSeries(query: any, series: any) {
    if (series.length === 0) {
      series.push({
        attributes: [],
        dataPoints: [],
        serieName: query.name,
      });
    }
  }

  checkApproriateCurrentTS(ts: number, settings: any): boolean {
    let bOK = false;
    let diff = this.getLinuxTimeFromTimeStamp(settings.timeRange.to, settings.timezone) - ts;
    let threshold = 0;
    switch (settings.resolution) {
      case 'H':
        threshold = 60 * 60000;
        break;
      case 'D':
        threshold = 24 * 60 * 60000;
        break;
      case 'W':
        threshold = 7 * 24 * 60 * 60000;
        break;
      case 'M':
        threshold = 30 * 24 * 60 * 60000;
        break;
      case 'Y':
        threshold = 365 * 24 * 60 * 60000;
        break;
      case '5Mi':
        threshold = 5 * 60000;
        break;
      case '10Mi':
        threshold = 10 * 60000;
        break;
      case '15Mi':
        threshold = 15 * 60000;
        break;
      case '30Mi':
        threshold = 30 * 60000;
        break;
      default:
    }
    bOK = (diff <= threshold);
    return bOK;
  }

  progressLastDP(series: any, settings: any) {
    if (!settings?.resolution || settings?.resolution === 'R' || !settings?.selectedPeriod || !settings?.timeRange) {
      return;
    }

    // Get last point
    let lastDP = series.dataPoints[series.dataPoints.length - 1];
    // Progress if correct
    if (this.checkApproriateCurrentTS(lastDP[1], settings)) {
      series.dataPoints[series.dataPoints.length - 1][1] = this.getLinuxTimeFromTimeStamp(settings.timeRange.to, settings.timezone);
    }
  }

  processSeries(series: any, settings: any, soloSeries: boolean) {
    this.sortSeriesDataPoints(series.dataPoints);
    // Progress last point
    if (settings.progressLastDataPoint) {
      this.progressLastDP(series, settings);
    }
    // Only fill for query that has 1 series in return
    if (settings.completeSeriesWZeros && soloSeries) {
      this.fillSeriesGaps(series, 0, settings);
    }
  }

  processTimeSeriesResult(queries: any, response: FetchResponse, settings: any): DataQueryResponse {
    const data: MutableDataFrame[] = [];
    let error: DataQueryError | undefined = undefined;

    const logsFrame = this.getDataFrameForLogs(response);
    if (logsFrame) {
      data.push(logsFrame);
    }
    
    if (response.data.error) {
      error = this.getErrorFromResponse(response);
    } else {
      for (let i = 0; i < response.data.length; i++) {
        // Each query has their own array of series in response.data
        const qseries = response.data[i];
        // If no series return for query, create an empty series
        this.checkResSeries(queries[i], qseries);

        // Process each series of the query
        for (const series of qseries) {
          if (!series) {
            continue;
          }

          this.processSeries(series, settings, (qseries.length === 1));

          data.push(this.getDataFrameFromTimeSeries(series, queries[i].refId));
        }
      }
    }
    
    return { data, error };
  }

  getDataFrameFromTable(table: any, refId: string): MutableDataFrame {
    const frame = new MutableDataFrame({
      refId: refId,
      fields: [],
    });

    let iTime: number[] = [];

    const colProp = table.COLUMNS ? 'COLUMNS' : 'columns';
    const rowProp = table.ROWS ? 'ROWS' : 'rows';

    table[colProp].forEach((col: any, idx: number) => {
      frame.addField({
        name: col.text,
        type: col.type,
      });
      if (col.type === 'time') {
        iTime.push(idx);
      }
    });

    table[rowProp].forEach((row: any[]) => {
      iTime.forEach((i) => {
        row[i] = Number(row[i]);
      });

      frame.appendRow(row);
    });
    return frame;
  }

  processTableResult(queries: any, response: FetchResponse): DataQueryResponse {
    const data: MutableDataFrame[] = [];
    let error: DataQueryError | undefined = undefined;

    const logsFrame = this.getDataFrameForLogs(response);
    if (logsFrame) {
      data.push(logsFrame);
    }

    if (response.data.error) {
      error = this.getErrorFromResponse(response);
    } else {
      for (let i = 0; i < response.data.length; i++) {
        const table = response.data[i];
        data.push(this.getDataFrameFromTable(table, queries[i].refId));
      }
    }

    return { data, error };
  }

  prepareForQuery(options: DataQueryRequest<MyQuery>, queries: any): any {
    let isConfigChecked = false;
    let resolution: string = this.resolution;
    let ignoreSemPeriod = false;
    let completeSeriesWZero = false;
    let progressLastDataPoint = false;
    let fdow = FDoW.Mon;

    for (const target of options.targets) {
      if (target.hide) {
        continue;
      }

      // Check for configuration query
      if (target.isConfig && !isConfigChecked) {
        isConfigChecked = true;
        if (target.resolution?.autoDecide) {
          // Get automatic resolution
          resolution = this.getAutomaticResolution({
            maxDataPoints: options.maxDataPoints,
            range: options.range,
          });
        } else if (target.resolution?.default) {
          // Get default resolution
          resolution = target.resolution.default;
        }
        ignoreSemPeriod = target.ignoreSemanticPeriod ? target.ignoreSemanticPeriod : false;
        completeSeriesWZero = target.completeTimeSeriesWZero ? target.completeTimeSeriesWZero : false;
        progressLastDataPoint = target.progressLastDataPoint ? target.progressLastDataPoint : false;
        fdow = target.fdow;
      } else {
        if (!target.dataProvider?.value) {
          continue;
        }
        if (target.type === Format.Timeseries) {
          queries.tSeries.push({
            ...this.getQueryForRequest(target, options),
            refId: target.refId,
            // intervalMs: options.intervalMs,
            // maxDataPoints: options.maxDataPoints,
            // datasourceId: this.id,
            // alias: getTemplateSrv().replace(target.alias || '', options.scopedVars),
          });
        } else if (target.type === Format.RawTable) {
          queries.rTable.push({
            ...this.getQueryForRequest(target, options),
            refId: target.refId,
            // intervalMs: options.intervalMs,
            // maxDataPoints: options.maxDataPoints,
            // datasourceId: this.id,
            // alias: getTemplateSrv().replace(target.alias || '', options.scopedVars),
          });
        } else {
          queries.table.push({
            ...this.getQueryForRequest(target, options),
            refId: target.refId,
            // intervalMs: options.intervalMs,
            // maxDataPoints: options.maxDataPoints,
            // datasourceId: this.id,
            // alias: getTemplateSrv().replace(target.alias || '', options.scopedVars),
          });
        }
      }
    }

    return {
      resolution: resolution,
      ignoreSemPeriod: ignoreSemPeriod,
      completeSeriesWZero: completeSeriesWZero,
      progressLastDataPoint: progressLastDataPoint,
      fdow: fdow
    };
  }

  prepareTimeRangeForQuery(options: DataQueryRequest<MyQuery>, settings: any): any {
    // Get time zone offset in hours.
    let utcOffset;
    let reqFrom = moment(options.range.from.format()), reqTo = moment(options.range.to.format());
    if (options.timezone !== "browser") {
      utcOffset = moment().tz(options.timezone).format("Z");
      reqFrom.tz(options.timezone);
      reqTo.tz(options.timezone);
    } else {
      utcOffset = options.range.from.format("Z");
    }
    
    // let tzOffset = utcOffset / 60;
    // let tzHoursStr = this.getIntNumberInString(tzOffset, 2, true);
    // Get remaining time zone offset in minutes.
    // let tzMinutes = Math.abs(utcOffset % 60);
    // let tzMinutesStr = this.getIntNumberInString(tzMinutes, 2);
    // Get time zone offset into string.
    // let timezone = `${tzHoursStr}:${tzMinutesStr}`;
    let timezone = utcOffset;
    // Period for request.
    let selPeriod = this.getPeriodForRequest(options.range.raw, settings.resolution);
    let period = settings.ignoreSemPeriod ? '' : selPeriod;
    // From and To time stamps.
    let from;
    let to;
    const dtFormat = 'YYYYMMDDHHmmss';
    // To time stamp.
    // let to = period !== "" ? undefined : this.getTimeStampForRequest(options.range.to);
    to = reqTo.format(dtFormat);
    // From time stamp.
    // Check for restriction of raw resolution.
    if (
      settings.resolution === Resolution.Raw &&
      (period === 'L2H' || period === 'C2H') &&
      reqTo.diff(reqFrom, 'hours') > 2
    ) {
      from = reqTo.subtract(2, 'hours').format(dtFormat);
    } else {
      from = reqFrom.format(dtFormat);
    }

    return {
      period: period,
      from: from,
      to: to,
      timezone: timezone,
      selPeriod: selPeriod
    };
  }

  // Query data for panel
  query(options: DataQueryRequest<MyQuery>): Observable<DataQueryResponse> {
    const queriesTSeries: any[] = [];
    const queriesTable: any[] = [];
    const queriesRTable: any[] = [];
    const streams: Array<Observable<DataQueryResponse>> = [];

    // Start streams and prepare queries
    let { resolution, ignoreSemPeriod, completeSeriesWZero, progressLastDataPoint, fdow } = this.prepareForQuery(options, {
      tSeries: queriesTSeries,
      table: queriesTable,
      rTable: queriesRTable
    });
    // Prepare time range
    let { period, from, to, timezone, selPeriod } = this.prepareTimeRangeForQuery(options, {
      ignoreSemPeriod: ignoreSemPeriod,
      resolution: resolution
    });

    // Normal body payload
    let body = {
      format: 'time_series',
      timestampFormat: 'unix',
      timeRange: {
        semantic: period,
        from: from,
        to: to,
      },
      resolution: resolution,
      timezone: timezone,
      firstWeekDay: fdow,
    };

    if (queriesTSeries.length) {
      const stream = this.fetchData({
        method: 'POST',
        url: this.getRootURL() + dpDataPath,
        headers: this.headers,
        // credentials: this.withCredentials ? "include" : undefined,
        requestId: `${options.dashboardUID}-${options.panelId}-${this.almUid}-querydata-timeseries`,
        data: {
          ...body,
          queries: queriesTSeries,
        },
      }, (response: FetchResponse) =>
        this.processTimeSeriesResult(queriesTSeries, response, {
          isFRUN: this.isFRUN,
          completeSeriesWZeros: completeSeriesWZero,
          progressLastDataPoint: progressLastDataPoint,
          timeRange: body.timeRange,
          selectedPeriod: selPeriod,
          resolution: resolution,
          timezone: timezone,
        })
      , undefined, true);

      streams.push(stream);
    }
    if (queriesRTable.length) {
      const stream = this.fetchData({
        method: 'POST',
        url: this.getRootURL() + dpDataPath,
        headers: this.headers,
        // credentials: this.withCredentials ? "include" : undefined,
        requestId: `${options.dashboardUID}-${options.panelId}-${this.almUid}-querydata-tableraw`,
        data: {
          ...body,
          format: 'table',
          tableType: 'raw',
          table_format: 'raw',
          queries: queriesRTable,
        },
      }, (response: FetchResponse) =>
        this.processTableResult(queriesRTable, response)
      , undefined, true);

      streams.push(stream);
    }
    if (queriesTable.length) {
      const stream = this.fetchData({
        method: 'POST',
        url: this.getRootURL() + dpDataPath,
        headers: this.headers,
        // credentials: this.withCredentials ? "include" : undefined,
        requestId: `${options.dashboardUID}-${options.panelId}-${this.almUid}-querydata-table`,
        data: {
          ...body,
          format: 'table',
          queries: queriesTable,
        },
      }, (response: FetchResponse) =>
        this.processTableResult(queriesTable, response)
      , undefined, true);

      streams.push(stream);
    }

    return merge(...streams);
  }

  getRootURL(): string {
    if (this.isFRUN) {
      return this.url;
    } else if (this.isPredefined !== undefined && !this.isPredefined) {
      return this.url + '/' + predefAlias + routePath;
    } else {
      return this.url + '/' + this.alias + routePath;
    }
  }

  processTestDS(response: FetchResponse): any {
    if (response.status === 200) {
      return { status: 'success', message: 'Data source is working', title: 'Success' };
    }

    return {
      status: 'error',
      message: `Data source is not working: ${response.statusText}`,
      title: 'Error',
    };
  }

  async testDatasource() {
    const options = {
      method: 'GET',
      url: this.getRootURL() + dpListPath,
    };
    const obsver = this.fetchData(options, this.processTestDS);
    const testResult = await lastValueFrom(obsver);

    return testResult;

  }

  async metricFindQuery(query: MyVariableQuery, options?: any): Promise<MetricFindValue[]> {
    let dp;
    if (query.dataProvider) {
      dp = query.dataProvider.value;
      const dpv = this.getDPVersion(dp, true);

      let body = {
        providerName: dp,
        providerVersion: dpv,
      };

      const options = {
        method: 'POST',
        url: this.getRootURL() + dpFiltersPath,
        data: body,
        headers: this.headers,
        // credentials: this.withCredentials ? "include" : undefined,
        // requestId: this.almUid + queryId + "-searchdp",
      };

      const obsver = this.fetchData(options, (response: FetchResponse) => this.processMetrics(response, query));
      const data = await lastValueFrom(obsver);
      return data;
    }

    // Return empty
    return Promise.resolve([]);
  }

  searchDataProviders(query: string, queryId: string, options?: any, type?: string): Observable<TextValuePair[]> {
    const payload = {
      method: 'GET',
      url: this.getRootURL() + dpListPath,
      // headers: this.headers,
      // credentials: this.withCredentials ? "include" : undefined,
      requestId: this.almUid + queryId + '-searchdp',
    };
    return this.fetchData(payload, this.processDataProvidersSearch);
  }

  processDataProvidersSearch(response: FetchResponse): TextValuePair[] {
    return response.data.map((value: { description: any; name: any }) => ({
      text: value.description,
      value: value.name,
    }));
  }

  processMetrics(response: FetchResponse, query: MyVariableQuery): MetricFindValue[] {
    let values: MetricFindValue[] = [];
    if (query.type) {
      response.data.forEach((filter: DPFilterResponse) => {
        // Get list of dimensions
        if (
          (query.type.value === 'ATTR' &&
            query.value &&
            query.value.value === filter.key &&
            (filter.type === 'attribute' || filter.isAttribute)) || // For attribute
          (query.type.value === 'MEAS' && filter.type === 'measure') // For measure
        ) {
          values = filter.values.map((value) => ({ text: value.label, value: value.key }));
        } else if (query.type.value === 'DIM' && filter.type === 'dimension') {
          // For dimension
          values.push({ text: filter.name, value: filter.key });
        }
      });
    }
    return values;
  }

  searchDataProviderFilters(
    dp: string,
    queryId: string,
    filter?: DPFilterResponse,
    query?: MyQuery
  ): Observable<DPFilterResponse[]> {
    const t = defaults(query, DEFAULT_QUERY);
    const dpv = this.getDPVersion(dp);
    let body;
    if (filter) {
      body = {
        providerName: dp,
        providerVersion: dpv,
        name: filter.key,
        filters: this.getFiltersForQuery(t.dataProviderFilters),
      };
    } else {
      body = {
        providerName: dp,
        providerVersion: dpv,
      };
    }

    const options = {
      method: 'POST',
      url: this.getRootURL() + dpFiltersPath,
      headers: this.headers,
      // credentials: this.withCredentials ? "include" : undefined,
      requestId: this.almUid + queryId + '-searchfilters',
      data: body,
    };
    return this.fetchData(options, this.processDataProviderFiltersSearch);
  }

  processDataProviderFiltersSearch(response: FetchResponse): DPFilterResponse[] {
    return response.data;
  }
}
