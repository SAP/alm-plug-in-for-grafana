import defaults from 'lodash/defaults';

import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  // toDataFrame,
  MutableDataFrame,
  FieldType,
  DataQueryError,
  // TableData,
  // TimeSeries,
  DateTime,
  TimeRange,
  MetricFindValue,
  RawTimeRange,
  Labels,
} from '@grafana/data';

import { FetchResponse, getBackendSrv, getTemplateSrv } from '@grafana/runtime';
import {
  MyQuery,
  MyDataSourceOptions,
  defaultQuery,
  TextValuePair,
  DPFilterResponse,
  DataProviderFilter,
  MyVariableQuery,
  DataProviderConfig,
} from './types';
import { merge, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Format, Resolution } from 'format';

// type ResultData = TimeSeries | TableData;

const routePath = '/analytics';
const dpListPath = '/providers';
const dpFiltersPath = '/providers/filters';
const dpDataPath = '/providers/data';

export interface RequestQuery {
  [key: string]: any;
}

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  resolution: Resolution;
  url: string;
  withCredentials: boolean;
  oauthPassThru: boolean;
  isFRUN: boolean;
  alias: string;
  headers: any;
  uid: string;
  dataProviderConfigs: { [key: string]: DataProviderConfig };
  isUpdatingCSRFToken: boolean;

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);

    this.uid = (Date.now() + Math.floor(Math.random() * 100000)).toString();

    this.url = instanceSettings.url ? instanceSettings.url : '';

    this.withCredentials = instanceSettings.withCredentials !== undefined;

    this.isFRUN = instanceSettings.jsonData.isFRUN ? instanceSettings.jsonData.isFRUN : false;

    this.alias = instanceSettings.jsonData.alias ? instanceSettings.jsonData.alias : '';

    this.oauthPassThru = instanceSettings.jsonData['oauthPassThru'] || false;

    this.resolution = instanceSettings.jsonData.resolution || Resolution.Hour;

    this.dataProviderConfigs = instanceSettings.jsonData.dataProviderConfigs || {};

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

  updateCSRFToken() {
    this.isUpdatingCSRFToken = true;
    getBackendSrv()
      .fetch({
        url: this.url,
        method: 'GET',
        headers: { ...this.headers, 'X-CSRF-Token': 'fetch' },
      })
      .toPromise()
      .then(
        (response) => {
          if (response.headers.has('X-CSRF-Token') && response.headers.get('X-CSRF-Token') !== null) {
            this.headers['X-CSRF-Token'] = response.headers.get('X-CSRF-Token');
          }
          this.isUpdatingCSRFToken = false;
        },
        (response) => {
          this.isUpdatingCSRFToken = false;
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
      );
  }

  getFiltersForQuery(filters: DataProviderFilter[], options?: DataQueryRequest<MyQuery>) {
    var f = [];
    for (let i = 0; i < filters.length; i++) {
      if (filters[i].key.value) {
        if (options) {
          let tf: { key: string | undefined; values: string[] } = {
            key: filters[i].key.value,
            values: [],
          };
          filters[i].values.forEach((v) => {
            // Check for variables
            if (v.value) {
              if (v.value?.substr(0, 1) === '$' || v.value?.substr(0, 2) === '{{') {
                let t = getTemplateSrv().replace(v.value, options.scopedVars, 'csv');
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
        } else {
          f.push({
            key: filters[i].key.value,
            values: filters[i].values.map((value, idx) => {
              return value.value;
            }),
          });
        }
      }
    }
    return f;
  }

  getDPVersion(dp?: string, isForPath?: boolean): string {
    let dpv = '';
    if (dp && this.dataProviderConfigs && this.dataProviderConfigs[dp]) {
      dpv = this.dataProviderConfigs[dp].version.value || '';
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
    const t = defaults(target, defaultQuery);
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
        if (v.value?.substr(0, 1) === '$' || v.value?.substr(0, 2) === '{{') {
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
        if (v.value?.value?.substr(0, 1) === '$' || v.value?.value?.substr(0, 2) === '{{') {
          let t = getTemplateSrv().replace(v.value.value, options.scopedVars, 'csv');
          t.split(',').forEach((ts) => {
            query.columns.metrics.push({ measure: ts, method: v.aggrMethod.value });
          });
        } else {
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
        case 'd':
          return 'D';
        case 'w':
          return 'W';
        case 'M':
          return 'M';
        case 'y':
          return 'Y';
        default:
          return 'H';
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
            if (resolution === Resolution.Raw && (rrfn > 2 || rrfsu !== 'H')) {
              rrfsu = 'H';
              rrfn = '2';
            }

            // Set period number and unit.
            period = period + rrfn + rrfsu;
          }
        }
      }
    }

    return period;
  }

  getAutomaticResolution(options: { maxDataPoints?: number; range: TimeRange }): string {
    let resolution: string = Resolution.Hour;
    let maxDataPoints = options.maxDataPoints || 101;

    // Get range in minutes
    // let dFrom = options.range.from.toDate().getTime() / (1000 * 60);
    // let dTo = options.range.to.toDate().getTime() / (1000 * 60);
    // Get the differences in minutes
    let nCal = options.range.to.diff(options.range.from, 'minutes');

    if (nCal / 60 <= maxDataPoints) {
      // Check for hours
      resolution = Resolution.Hour;
    } else if (nCal / (60 * 24) <= maxDataPoints) {
      // Check for days
      resolution = Resolution.Day;
    } else if (nCal / (60 * 24 * 7) <= maxDataPoints) {
      // Check for weeks
      resolution = Resolution.Week;
    } else if (nCal / (60 * 24 * 30) <= maxDataPoints) {
      // Check for months
      resolution = Resolution.Month;
    } else if (nCal / (60 * 24 * 365) <= maxDataPoints) {
      // Check for years
      resolution = Resolution.Year;
    }

    return resolution;
  }

  getLinuxTimeFromTimeStamp(ts: string): number {
    const d = new Date(
      Date.UTC(
        Number(ts.substr(0, 4)),
        Number(ts.substr(4, 2)) - 1,
        Number(ts.substr(6, 2)),
        Number(ts.substr(8, 2)),
        Number(ts.substr(10, 2)),
        Number(ts.substr(12, 2))
      )
    );
    // let dt: DateTime = dateTime(d);
    return d.getTime();
  }

  parseSeriesPoints(points: Array<{ x: any; y: any }>): any[] {
    let pp: any[] = [];

    points.forEach((p) => {
      pp.push([p.y, this.getLinuxTimeFromTimeStamp(p.x)]);
    });

    return pp;
  }

  getErrorFromResponse(response: FetchResponse): DataQueryError {
    const error = {
      data: {
        message: response.data.message,
        error: response.data.error,
      },
      status: response.status.toString(),
      statusText: response.statusText,
    };

    return error;
  }

  sortSeriesDataPoints(points: number[][]) {
    points = points.sort((p1: number[], p2: number[]) => {
      return p1[1] - p2[1];
    });
  }

  getDataFrameFromTimeSeries(series: any, refId: string): MutableDataFrame {
    let labels: Labels = {};
    series.attributes.forEach((attr: any) => {
      labels[attr.key] = attr.value;
    });

    const frame = new MutableDataFrame({
      refId: refId,
      name: series.serieName,
      fields: [{
        name: 'Value',
        type: FieldType.number,
        labels: labels,
        config: {
          displayNameFromDS: series.serieName
        }
      }, {
        name: 'Time',
        type: FieldType.time
      }]
    });

    series.dataPoints.forEach((point: any[]) => {
      frame.appendRow(point);
    });
    return frame;
  }

  processTimeSeriesResult(queries: any, response: FetchResponse): DataQueryResponse {
    // const data: ResultData[] = [];
    const data: MutableDataFrame[] = [];
    let error: DataQueryError | undefined = undefined;

    if (response.data.error) {
      error = this.getErrorFromResponse(response);
    } else {
      // Each query has their own array of series in response.data
      for (let i = 0; i < response.data.length; i++) {
        const qseries = response.data[i];
        for (let j = 0; j < qseries.length; j++) {
          const series = qseries[j];
          if (series) {
            this.sortSeriesDataPoints(series.dataPoints);
            data.push(this.getDataFrameFromTimeSeries(series, queries[i].refId));
          }
        }
      }
    }

    return { data, error };
  }

  getDataFrameFromTable(table: any, refId: string): MutableDataFrame {
    const frame = new MutableDataFrame({
      refId: refId,
      fields: []
    });

    let iTime: number[] = [];

    table.COLUMNS.forEach((col: any, idx: number) => {
      frame.addField({
        name: col.text,
        type: col.type
      });
      if (col.type === 'time') {
        iTime.push(idx);
      }
    });

    table.ROWS.forEach((row: any[]) => {
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

    if (response.data.error) {
      error = this.getErrorFromResponse(response);
    } else {
      for (let i = 0; i < response.data.length; i++) {
        // Need to convert for each time column to unix value
        // let ti: number[] = [];
        // response.data[i].columns.forEach((col: {type: string}, i: number) => {
        //   if (col.type === "time") {
        //     ti.push(i);
        //   }
        // });
        // if (ti.length > 0) {
        //   for (let j = 0; j < response.data[i].rows.length; j++) {
        //     ti.forEach((v, i) => {
        //       response.data[i].rows[j][v] = this.getLinuxTimeFromTimeStamp(response.data[i].rows[j][v]);
        //     });
        //   }
        // }

        const table = response.data[i];
        data.push(this.getDataFrameFromTable(table, queries[i].refId));
      }
    }

    return { data, error };
  }

  // Query data for panel
  query(options: DataQueryRequest<MyQuery>): Observable<DataQueryResponse> {
    const queriesTSeries: any[] = [];
    const queriesTable: any[] = [];
    const queriesRTable: any[] = [];
    const streams: Array<Observable<DataQueryResponse>> = [];

    let isConfigChecked = false;
    let resolution: string = this.resolution;

    // Start streams and prepare queries
    for (const target of options.targets) {
      if (target.hide) {
        continue;
      }

      // Check for configuration query
      if (target.isConfig && !isConfigChecked) {
        isConfigChecked = true;
        if (target.resolution && target.resolution.autoDecide) {
          resolution = this.getAutomaticResolution({
            maxDataPoints: options.maxDataPoints,
            range: options.range,
          });
        } else if (target.resolution && target.resolution.default) {
          resolution = target.resolution.default;
        }
      } else {
        if (!target.dataProvider || !target.dataProvider.value) {
          continue;
        }
        if (target.type === Format.Timeseries) {
          queriesTSeries.push({
            ...this.getQueryForRequest(target, options),
            refId: target.refId,
            // intervalMs: options.intervalMs,
            // maxDataPoints: options.maxDataPoints,
            // datasourceId: this.id,
            // alias: getTemplateSrv().replace(target.alias || '', options.scopedVars),
          });
        } else if (target.type === Format.RawTable) {
          queriesRTable.push({
            ...this.getQueryForRequest(target, options),
            refId: target.refId,
            // intervalMs: options.intervalMs,
            // maxDataPoints: options.maxDataPoints,
            // datasourceId: this.id,
            // alias: getTemplateSrv().replace(target.alias || '', options.scopedVars),
          });
        } else {
          queriesTable.push({
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

    // Get time zone offset in hours.
    let tzOffset = options.range.from.utcOffset() / 60;
    let tzHoursStr = this.getIntNumberInString(tzOffset, 2, true);
    // Get remaining time zone offset in minutes.
    let tzMinutes = Math.abs(options.range.from.utcOffset() % 60);
    let tzMinutesStr = this.getIntNumberInString(tzMinutes, 2);
    // Get time zone offset into string.
    let timezone = `${tzHoursStr}:${tzMinutesStr}`;
    // Period for request.
    let period = this.getPeriodForRequest(options.range.raw, resolution);
    // From and To time stamps.
    let from;
    let to;
    // To time stamp.
    // let to = period !== "" ? undefined : this.getTimeStampForRequest(options.range.to);
    to = this.getTimeStampForRequest(options.range.to);
    // From time stamp.
    // Check for restriction of raw resolution.
    if (
      resolution === Resolution.Raw &&
      (period === 'L2H' || period === 'C2H') &&
      options.range.to.diff(options.range.from, 'hours') > 2
    ) {
      from = this.getTimeStampForRequest(options.range.to.subtract(2, 'hours'));
    } else {
      from = this.getTimeStampForRequest(options.range.from);
    }

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
    };

    if (queriesTSeries.length) {
      const stream = getBackendSrv()
        .fetch({
          method: 'POST',
          url: this.getRootURL() + dpDataPath,
          headers: this.headers,
          // credentials: this.withCredentials ? "include" : undefined,
          requestId: `${options.dashboardId}-${options.panelId}-querydata-timeseries`,
          data: {
            ...body,
            queries: queriesTSeries,
          },
        })
        .pipe(map((response) => this.processTimeSeriesResult(queriesTSeries, response)));

      streams.push(stream);
    }
    if (queriesRTable.length) {
      const stream = getBackendSrv()
        .fetch({
          method: 'POST',
          url: this.getRootURL() + dpDataPath,
          headers: this.headers,
          // credentials: this.withCredentials ? "include" : undefined,
          requestId: `${options.dashboardId}-${options.panelId}-querydata-tableraw`,
          data: {
            ...body,
            format: 'table',
            tableType: 'raw',
            queries: queriesRTable,
          },
        })
        .pipe(map((response) => this.processTableResult(queriesRTable, response)));

      streams.push(stream);
    }
    if (queriesTable.length) {
      const stream = getBackendSrv()
        .fetch({
          method: 'POST',
          url: this.getRootURL() + dpDataPath,
          headers: this.headers,
          // credentials: this.withCredentials ? "include" : undefined,
          requestId: `${options.dashboardId}-${options.panelId}-querydata-table`,
          data: {
            ...body,
            format: 'table',
            queries: queriesTable,
          },
        })
        .pipe(map((response) => this.processTableResult(queriesTable, response)));

      streams.push(stream);
    }

    return merge(...streams);
  }

  getRootURL(): string {
    if (this.isFRUN) {
      return this.url;
    } else {
      return this.url + '/' + this.alias + routePath;
    }
  }

  async testDatasource() {
    return getBackendSrv()
      .fetch({
        method: 'GET',
        url: this.getRootURL() + dpListPath,
      })
      .toPromise()
      .then((response) => {
        if (response.status === 200) {
          return { status: 'success', message: 'Data source is working', title: 'Success' };
        }

        return {
          status: 'error',
          message: `Data source is not working: ${response.statusText}`,
          title: 'Error',
        };
      });
  }

  metricFindQuery(query: MyVariableQuery, options?: any): Promise<MetricFindValue[]> {
    let dp;
    if (query.dataProvider) {
      dp = query.dataProvider.value;
      const dpv = this.getDPVersion(dp, true);

      let body = {
        providerName: dp,
        providerVersion: dpv,
      };

      return getBackendSrv()
        .fetch({
          method: 'POST',
          url: this.getRootURL() + dpFiltersPath,
          data: body,
          headers: this.headers,
          // credentials: this.withCredentials ? "include" : undefined,
          // requestId: this.uid + queryId + "-searchdp",
        })
        .pipe(map((response) => this.processMetrics(response, query)))
        .toPromise();
    }

    // Return empty
    return new Promise((resolve) => {
      resolve([]);
    });
  }

  searchDataProviders(query: string, queryId: string, options?: any, type?: string): Promise<TextValuePair[]> {
    return getBackendSrv()
      .fetch({
        method: 'GET',
        url: this.getRootURL() + dpListPath,
        // headers: this.headers,
        // credentials: this.withCredentials ? "include" : undefined,
        requestId: this.uid + queryId + '-searchdp',
      })
      .pipe(map((response) => this.processDataProvidersSearch(response)))
      .toPromise();
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
          values = filter.values.map((value) => ({ text: value.key }));
        } else if (query.type.value === 'DIM' && filter.type === 'dimension') {
          // For dimension
          values.push({ text: filter.key });
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
  ): Promise<DPFilterResponse[]> {
    const t = defaults(query, defaultQuery);
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

    return getBackendSrv()
      .fetch({
        method: 'POST',
        url: this.getRootURL() + dpFiltersPath,
        headers: this.headers,
        // credentials: this.withCredentials ? "include" : undefined,
        requestId: this.uid + queryId + '-searchfilters',
        data: body,
      })
      .pipe(map((response) => this.processDataProviderFiltersSearch(response)))
      .toPromise();
  }

  processDataProviderFiltersSearch(response: FetchResponse): DPFilterResponse[] {
    return response.data;
  }
}
