import defaults from 'lodash/defaults';

import React, { MouseEvent, PureComponent, ChangeEvent } from 'react';
import { AsyncSelect, Button, IconButton, MultiSelect, Select, Switch } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { DataSource } from './DataSource';
import { AggrMethod, Format, Resolution } from './format';
import { DPFilterResponse, MyDataSourceOptions, MyQuery } from './types';

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

const formatAsOptions = [
  { label: 'Time Series', value: Format.Timeseries },
  { label: 'Table', value: Format.Table },
  { label: 'Raw Table', value: Format.RawTable },
];

const resOptions = [
  { label: '5 Minutes', value: Resolution.Min5 },
  { label: '10 Minutes', value: Resolution.Min10 },
  { label: '15 Minutes', value: Resolution.Min15 },
  { label: '30 Minutes', value: Resolution.Min30 },
  { label: 'Hours', value: Resolution.Hour },
  { label: 'Days', value: Resolution.Day },
  { label: 'Weeks', value: Resolution.Week },
  { label: 'Months', value: Resolution.Month },
  { label: 'Years', value: Resolution.Year },
  { label: 'Raw', value: Resolution.Raw },
  { label: 'Period', value: Resolution.Period },
];

const aggrMethods = [
  { label: 'Avg', value: AggrMethod.Avg },
  { label: 'Sum', value: AggrMethod.Sum },
  { label: 'Min', value: AggrMethod.Min },
  { label: 'Max', value: AggrMethod.Max },
];

export class QueryEditor extends PureComponent<Props> {
  dataProviderOptionsBackup: Array<SelectableValue<string>> = [];
  dataProviderOptions: Array<SelectableValue<string>> = [];
  dataProviderFilterOptions: Array<SelectableValue<string>> = [];
  dataProviderCustomFilterOptions: Array<SelectableValue<string>> = [];
  dataProviderFilterValueOptions: Array<Array<SelectableValue<string>>> = [];
  dataProviderCustomFilterValueOptions: Array<Array<SelectableValue<string>>> = [];
  dataProviderFiltersValues: { [key: string]: DPFilterResponse } = {};
  dataProviderDimensionOptions: Array<SelectableValue<string>> = [];
  dataProviderCustomDimensionOptions: Array<SelectableValue<string>> = [];
  dataProviderMeasuresOptions: Array<SelectableValue<string>> = [];
  dataProviderCustomMeasuresOptions: Array<SelectableValue<string>> = [];

  /* ---------------- Utilities ---------------- */

  /* To change selection state of filter key for it to be editable when true, or otherwise when false. */
  dpfSetKeySelectedState = (i: number, s: boolean) => {
    const { onChange, query } = this.props;

    query.dataProviderFilters[i].keySelected = s;

    onChange({ ...query, dataProviderFilters: query.dataProviderFilters });
  };

  /* To change selection state of filter value for it to be editable when true, or otherwise when false. */
  dpfSetValueSelectedState = (i: number, s: boolean) => {
    const { onChange, query } = this.props;

    query.dataProviderFilters[i].valuesSelected = s;

    onChange({ ...query, dataProviderFilters: query.dataProviderFilters });
  };

  /* Remove filter for data provider */
  dpfRemoveFilter = (i: number) => {
    const { onChange, query, onRunQuery } = this.props;

    query.dataProviderFilters.splice(i, 1);
    this.dataProviderFilterValueOptions.splice(i, 1);
    this.dataProviderCustomFilterValueOptions.splice(i, 1);

    onChange({ ...query, dataProviderFilters: query.dataProviderFilters });

    // executes the query
    onRunQuery();
  };

  /* Remove drilldown measure for data provider */
  drilldownRemoveMeasure = (i: number) => {
    const { onChange, query, onRunQuery } = this.props;

    query.drilldown.measures.splice(i, 1);

    onChange({ ...query, drilldown: query.drilldown });

    // executes the query
    onRunQuery();
  };

  /* Add new default filter for data provider */
  dpfAddFilter = () => {
    const { onChange, query } = this.props;

    query.dataProviderFilters.push({ key: {}, values: [], keySelected: true, valuesSelected: true });
    this.loadDPFilterValueOptions(
      query.dataProviderFilters.length - 1,
      query.dataProviderFilters[query.dataProviderFilters.length - 1].key
    );

    onChange({ ...query, dataProviderFilters: query.dataProviderFilters });
  };

  /* Add new default drilldown measure for data provider */
  drilldownAddMeasure = () => {
    const { onChange, query } = this.props;

    query.drilldown.measures.push({ value: {}, aggrMethod: {} });

    onChange({ ...query, dataProviderFilters: query.dataProviderFilters });
  };

  searchDP = (q: string) => {
    this.dataProviderOptions = [];
    if (q && q !== '') {
      this.dataProviderOptionsBackup.forEach((option) => {
        if ((option.label && option.label.indexOf(q) > -1) || (option.value && option.value.indexOf(q) > -1)) {
          this.dataProviderOptions.push({
            label: option.label,
            value: option.value,
            description: option.description,
          });
        }
      });
    } else {
      this.dataProviderOptions = this.dataProviderOptionsBackup.map((option) => ({
        label: option.label,
        value: option.value,
        description: option.description,
      }));
    }
  };

  /* Load Data Providers List */
  loadDataProviders = (q: string) => {
    const { query, datasource } = this.props;

    return new Promise<Array<SelectableValue<string>>>((resolve) => {
      if (this.dataProviderOptionsBackup.length === 0) {
        // Retrieval of data providers list and parse it to options list
        datasource.searchDataProviders(q, query.refId).subscribe((result) => {
          result.sort((a, b) => {
            if (a.text > b.text) {
              return 1;
            } else if (a.text < b.text) {
              return -1;
            }
            return 0;
          });
          this.dataProviderOptionsBackup = result.map((value) => ({
            label: value.text,
            value: value.value,
            description: value.value,
          }));

          this.searchDP(q);

          const fdp = this.dataProviderOptions.find((dp) => {
            return dp.value === query.dataProvider.value;
          });

          this.cleanUpDPFilters();
          if (fdp) {
            this.loadDPFilters(query.dataProvider);
          } else {
            this.checkCustomDimAndFil();
          }

          resolve(this.dataProviderOptions);
        });
      } else {
        this.searchDP(q);
        resolve(this.dataProviderOptions);
      }
    });
  };

  cleanUpDPFilters = () => {
    this.dataProviderFilterOptions = [];
    this.dataProviderCustomFilterOptions = [];
    this.dataProviderFilterValueOptions = [];
    this.dataProviderCustomFilterValueOptions = [];
    this.dataProviderFiltersValues = {};
    this.dataProviderDimensionOptions = [];
    this.dataProviderCustomDimensionOptions = [];
    this.dataProviderMeasuresOptions = [];
    this.dataProviderCustomMeasuresOptions = [];
  };

  checkCustomDimAndFil = () => {
    const { query } = this.props;

    query.drilldown.dimensions.forEach((dim) => {
      if (
        dim?.value &&
        dim.value !== '' &&
        !this.dataProviderDimensionOptions.find((d) => {
          return d.value === dim.value;
        })
      ) {
        this.dataProviderCustomDimensionOptions.push(dim);
      }
    });
    query.drilldown.measures.forEach((meas) => {
      if (
        meas?.value?.value &&
        meas.value.value !== '' &&
        !this.dataProviderMeasuresOptions.find((m) => {
          return m.value === meas.value.value;
        })
      ) {
        this.dataProviderCustomDimensionOptions.push(meas.value);
      }
    });
  };

  /* Load Data Providers List */
  loadDPFilters = (
    dp: SelectableValue<string> = {},
    rfilter?: DPFilterResponse,
    parents?: string[],
    fromValSel = false
  ) => {
    const { query, datasource, onChange } = this.props;

    // Load all related filters
    if (dp.value) {
      datasource
        .searchDataProviderFilters(dp.value, query.refId, rfilter ? rfilter : undefined, query)
        .subscribe((result) => {
          if (!rfilter) {
            this.cleanUpDPFilters();
          }

          result.forEach((filter, i) => {
            let exist = this.dataProviderFiltersValues[filter.key] ? true : false;

            if (
              filter.type === 'attribute' ||
              filter.type === 'measure' ||
              (filter.type === 'dimension' && filter.isAttribute)
            ) {
              this.dataProviderFiltersValues[filter.key] = filter;
            }

            if (!exist && (filter.type === 'attribute' || (filter.type === 'dimension' && filter.isAttribute))) {
              this.dataProviderFilterOptions.push({
                value: filter.key,
                label: filter.name,
                description: filter.description,
              });
            }

            // Get list of dimensions
            if (!exist && filter.type === 'dimension') {
              this.dataProviderDimensionOptions.push({
                value: filter.key,
                label: filter.name,
                description: filter.description,
              });
            }

            // Extract list of measures
            if (!exist && filter.type === 'measure') {
              this.dataProviderMeasuresOptions = filter.values.map((value) => ({
                label: value.key,
                value: value.key,
                description: value.label,
              }));
            }
          });

          // Check for custom dimensions and measures
          if (!rfilter) {
            this.checkCustomDimAndFil();
          }

          // Check if selected filter is correct, load filter's values
          query.dataProviderFilters.forEach((filter, i) => {
            // Check if selected filters' key still presents in the list, otherwise add to custom list
            if (
              filter?.key?.value &&
              filter.key.value !== '' &&
              !this.dataProviderFilterOptions.find((f) => {
                return f.value === filter.key.value;
              }) &&
              !this.dataProviderCustomFilterOptions.find((f) => {
                return f.value === filter.key.value;
              })
            ) {
              this.dataProviderCustomFilterOptions.push(filter);
            }

            // Get related filters in case needed.
            if (
              !fromValSel &&
              filter &&
              filter.key.value &&
              filter.key.value !== '' &&
              rfilter?.key !== filter.key.value &&
              this.dataProviderFilterOptions.find((f) => {
                return f.value === filter.key.value;
              }) &&
              this.dataProviderFiltersValues[filter.key.value].triggerRefresh &&
              (!parents || parents?.indexOf(filter.key.value) === -1)
            ) {
              if (!parents) {
                parents = [filter.key.value];
              } else {
                parents.push(filter.key.value);
              }
              this.retrieveRelatedFilters(this.dataProviderFiltersValues[filter.key.value], parents);
            }

            // Load filters' values list
            this.loadDPFilterValueOptions(i, filter.key, filter.values);
          });

          onChange({ ...query, drilldown: query.drilldown });
        });
    }
  };

  loadDPFilterValueOptions = (
    i: number,
    filterKey: SelectableValue<string> = {},
    filterValues: Array<SelectableValue<string>> = []
  ) => {
    this.dataProviderFilterValueOptions[i] = [];
    this.dataProviderCustomFilterValueOptions[i] = [];
    if (filterKey.value) {
      let rfilter = this.dataProviderFiltersValues[filterKey.value];
      if (rfilter) {
        this.dataProviderFilterValueOptions[i] = rfilter.values.map((value) => ({
          value: value.key,
          label: value.label,
        }));
      }
      // Check for custom values
      filterValues.forEach((fv) => {
        if (
          fv.value &&
          fv.value !== '' &&
          !this.dataProviderFilterValueOptions[i].find((op) => {
            return op.value === fv.value;
          }) &&
          !this.dataProviderCustomFilterValueOptions[i].find((op) => {
            return op.value === fv.value;
          })
        ) {
          this.dataProviderCustomFilterValueOptions[i].push(fv);
        }
      });
    }
  };

  retrieveRelatedFilters = (filter: DPFilterResponse, parents?: string[], fromValSel = false) => {
    const { query } = this.props;
    this.loadDPFilters(query.dataProvider, filter, parents, fromValSel);
  };

  /* Get combined selected filter values */
  getCombinedFilterValues = (values: Array<SelectableValue<string>>) => {
    let sCombined = '';
    if (values.length > 0) {
      values.forEach((v, i) => {
        if (i > 0) {
          sCombined = sCombined + ', ' + v.label;
        } else {
          sCombined = sCombined + v.label;
        }
      });
    } else {
      sCombined = '[values]';
    }

    return sCombined;
  };

  /* ------------------------------------------------ */

  /* ---------------- Event Handlers ---------------- */

  /* Is Query Configuartion Change */
  onIsConfigChange = (e: { currentTarget: { checked: any } }) => {
    const { onChange, query, onRunQuery } = this.props;

    onChange({ ...query, isConfig: e.currentTarget.checked });
    // executes the query
    onRunQuery();
  };

  onResolutionChange = (item: SelectableValue<Resolution>) => {
    const { onChange, query, onRunQuery } = this.props;

    if (item.value) {
      onChange({
        ...query,
        resolution: {
          ...query.resolution,
          default: item.value,
        },
      });
      // executes the query
      onRunQuery();
    }
  };

  onAutoDecideChange = (e: { currentTarget: { checked: any } }) => {
    const { onChange, query, onRunQuery } = this.props;

    onChange({
      ...query,
      resolution: {
        ...query.resolution,
        autoDecide: e.currentTarget.checked,
      },
    });
    // executes the query
    onRunQuery();
  };

  onIgnoreSemPeriodChange = (e: { currentTarget: { checked: any } }) => {
    const { onChange, query, onRunQuery } = this.props;

    onChange({
      ...query,
      ignoreSemanticPeriod: e.currentTarget.checked,
    });
    // executes the query
    onRunQuery();
  };

  onCompleteSeriesWZeroChange = (e: { currentTarget: { checked: any } }) => {
    const { onChange, query, onRunQuery } = this.props;

    onChange({
      ...query,
      completeTimeSeriesWZero: e.currentTarget.checked,
    });
    // executes the query
    onRunQuery();
  };

  onProgressLastDataPointChange = (e: { currentTarget: { checked: any } }) => {
    const { onChange, query, onRunQuery } = this.props;

    onChange({
      ...query,
      progressLastDataPoint: e.currentTarget.checked,
    });
    // executes the query
    onRunQuery();
  };

  /* Query Type Change */
  onTypeChange = (value: SelectableValue<Format>) => {
    const { onChange, query, onRunQuery } = this.props;

    onChange({ ...query, type: value.value ?? Format.Timeseries });
    // executes the query
    onRunQuery();
  };

  /* Query Name Change */
  onNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;

    onChange({ ...query, name: event.target.value });
    // executes the query
    onRunQuery();
  };

  /* Data Provider Selected Event */
  onDataProviderChange = (value: SelectableValue<string>) => {
    const { onChange, query, onRunQuery } = this.props;

    this.loadDPFilters(value);

    query.dataProvider = value;

    onChange({ ...query, dataProvider: value });
    // executes the query
    onRunQuery();
  };

  /* Add New Filter for Data Provider Event */
  onAddNewFilterClick = () => {
    this.dpfAddFilter();
  };

  onAddNewDrilldownMeasureClick = () => {
    this.drilldownAddMeasure();
  };

  /* Data Provider Filter Key Change Event */
  onDPFKeyChange = (value: SelectableValue<string>, i: number) => {
    const { onChange, query } = this.props;

    query.dataProviderFilters[i].key = value;

    this.loadDPFilterValueOptions(i, value);

    onChange({ ...query, dataProviderFilters: query.dataProviderFilters });
  };

  /* Data Provider Filter Values Change Event */
  onDPFValueChange = (item: SelectableValue<string>, i: number) => {
    const { onChange, query, onRunQuery } = this.props;

    query.dataProviderFilters[i].values = [item];

    // Check for refresh action
    let fv = query.dataProviderFilters[i].key.value;
    if (fv && this.dataProviderFiltersValues[fv].triggerRefresh) {
      this.retrieveRelatedFilters(this.dataProviderFiltersValues[fv], undefined, true);
    }

    onChange({ ...query, dataProviderFilters: query.dataProviderFilters });

    // executes the query
    onRunQuery();
  };

  /* Data Provider Filter Values Change Event */
  onDPFValuesChange = (items: Array<SelectableValue<string>>, i: number) => {
    const { onChange, query, onRunQuery } = this.props;

    query.dataProviderFilters[i].values = items;

    // Check for refresh action
    let fv = query.dataProviderFilters[i].key.value;
    if (fv && this.dataProviderFiltersValues[fv].triggerRefresh) {
      this.retrieveRelatedFilters(this.dataProviderFiltersValues[fv], undefined, true);
    }

    onChange({ ...query, dataProviderFilters: query.dataProviderFilters });

    // executes the query
    onRunQuery();
  };

  /* Data Provider Drilldown Dimensions Values Change Event */
  onDrilldownDimValuesChange = (items: Array<SelectableValue<string>>) => {
    const { onChange, query, onRunQuery } = this.props;

    query.drilldown.dimensions = items;

    onChange({ ...query, drilldown: query.drilldown });

    // executes the query
    onRunQuery();
  };

  /* Data Provider Drilldown Measure Value Change Event */
  onDrilldownMeasureValueChange = (item: SelectableValue<string>, i: number) => {
    const { onChange, query, onRunQuery } = this.props;

    query.drilldown.measures[i].value = item;

    onChange({ ...query, drilldown: query.drilldown });

    // executes the query
    onRunQuery();
  };

  /* Data Provider Drilldown Measure Method Change Event */
  onDrilldownMeasureMethodChange = (item: SelectableValue<AggrMethod>, i: number) => {
    const { onChange, query, onRunQuery } = this.props;

    query.drilldown.measures[i].aggrMethod = item;

    onChange({ ...query, drilldown: query.drilldown });

    // executes the query
    onRunQuery();
  };

  /* Data Provider Filter Remove Request Event */
  onDPFRemovePress = (event: MouseEvent<HTMLButtonElement>) => {
    let i = parseInt(event.currentTarget.getAttribute('data-key') ?? '0', 10);

    this.dpfRemoveFilter(i);
  };

  /* Data Provider Filter Remove Request Event */
  onDrilldownMeasureRemovePress = (event: MouseEvent<HTMLButtonElement>) => {
    let i = parseInt(event.currentTarget.getAttribute('data-key') ?? '0', 10);

    this.drilldownRemoveMeasure(i);
  };

  /* ------------------------------------------------ */

  render() {
    const css = `
    .filterVal-text-truncate {
      flex-grow: 1;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
    }
    .filterLabel-text-truncate {
      max-width: 81px;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
    }
    .filter-container {
      min-width: 300px;
      flex-grow: 1;
    }
    .filter-info-container {
      flex-grow: 1;
      justify-content: flex-start;
      padding: 0;
    }
    .filter-add-btn-container {
      min-width: 300px;
      flex-grow: 1;
      justify-content: flex-start;
      background-color: transparent;
      padding: 0;
    }
    .marginL4px {
      margin-left: 4px;
    }
    .marginB4px {
      margin-bottom: 4px;
    }
    .wrap-flex {
      flex-grow: 1;
      flex-wrap: wrap;
    }
    `;
    const defaultQuery: Partial<MyQuery> = {
      name: '',
      type: Format.Timeseries,
      isConfig: false,
      dataProvider: {},
      dataProviderFilters: [],
      resolution: {
        default: Resolution.Hour,
        autoDecide: true,
      },
      drilldown: {
        measures: [],
        dimensions: [],
      },
      ignoreSemanticPeriod: false,
      completeTimeSeriesWZero: false,
    };
    const query = defaults(this.props.query, defaultQuery);
    const {
      type,
      name,
      dataProvider,
      dataProviderFilters,
      drilldown,
      isConfig,
      resolution,
      ignoreSemanticPeriod,
      completeTimeSeriesWZero,
      progressLastDataPoint,
    } = query;

    const { isFRUN } = this.props.datasource;

    // Check if selected filter is correct, load filter's values
    // This needs to be done to ini custom filter options
    query.dataProviderFilters.forEach((filter, i) => {
      // Check if selected filters' key still presents in the list, otherwise add to custom list
      if (
        filter?.key?.value &&
        filter.key.value !== '' &&
        !this.dataProviderFilterOptions.find((f) => {
          return f.value === filter.key.value;
        }) &&
        !this.dataProviderCustomFilterOptions.find((f) => {
          return f.value === filter.key.value;
        })
      ) {
        this.dataProviderCustomFilterOptions.push(filter);
      }
      // Load filters' values list
      this.loadDPFilterValueOptions(i, filter.key, filter.values);
    });

    return (
      <>
        <style>{css}</style>
        <div className="gf-form max-width-21">
          <label className="gf-form-label width-11">Configuration Query</label>
          <div className="gf-form-switch">
            <Switch value={isConfig} onChange={this.onIsConfigChange} />
          </div>
        </div>
        {isConfig ? (
          <>
            <div className="gf-form">
              <label className="gf-form-label width-11">Automatic Resolution</label>
              <div className="gf-form-switch">
                <Switch value={resolution?.autoDecide} onChange={this.onAutoDecideChange} />
              </div>

              <label className="gf-form-label marginL4px width-11">
                Default Resolution
                <IconButton name="info-circle" tooltip="This is used when auto-resolution is off." />
              </label>
              <Select
                className="width-8"
                options={resOptions}
                defaultValue={resolution?.default}
                value={resolution?.default}
                onChange={this.onResolutionChange}
              />
            </div>
            <div className="gf-form">
              <label className="gf-form-label width-11">
                Ignore Semantic Period
                <IconButton name="info-circle" tooltip="To not use semantic period in data request." />
              </label>
              <div className="gf-form-switch">
                <Switch value={ignoreSemanticPeriod} onChange={this.onIgnoreSemPeriodChange} />
              </div>

              <label className="gf-form-label marginL4px width-15">
                Complete Time Series with Zeros
                <IconButton
                  name="info-circle"
                  tooltip="Fill missing data points for time series (Only for queries with single response)."
                />
              </label>
              <div className="gf-form-switch">
                <Switch value={completeTimeSeriesWZero} onChange={this.onCompleteSeriesWZeroChange} />
              </div>
            </div>

            <div className="gf-form">
              <label className="gf-form-label width-11">
                Progress Last Data Point
                <IconButton
                  name="info-circle"
                  tooltip="The data point's value of current time stamp has not finished yet. This will update the approriate last time stamp to current time."
                />
              </label>
              <div className="gf-form-switch">
                <Switch value={progressLastDataPoint} onChange={this.onProgressLastDataPointChange} />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="gf-form-inline">
              <div className="gf-form max-width-21">
                <label className="gf-form-label width-11">Format As</label>
                <Select
                  maxMenuHeight={170}
                  options={formatAsOptions}
                  defaultValue={type}
                  value={type}
                  onChange={this.onTypeChange}
                />
              </div>
              <div className="gf-form max-width-21">
                <label className="gf-form-label marginL4px width-5">Legend</label>
                <input onChange={this.onNameChange} value={name} className="gf-form-input" />
              </div>
            </div>
            <div className="gf-form">
              <label className="gf-form-label width-11">Data Provider</label>
              <AsyncSelect
                maxMenuHeight={170}
                placeholder="Select a data provider"
                loadOptions={this.loadDataProviders}
                defaultOptions
                onChange={this.onDataProviderChange}
                value={dataProvider}
                onCreateOption={(customValue) => {
                  this.onDataProviderChange({ label: customValue, value: customValue });
                }}
              />
            </div>
            <div className="gf-form">
              <label className="gf-form-label width-11">Filters</label>
              <div className="gf-form wrap-flex">
                {dataProviderFilters?.map((f, i) => {
                  return (
                    <span className="gf-form-label filter-container" key={i}>
                      <div className="gf-form-label filter-info-container">
                        <a
                          style={f.keySelected ? { display: 'none' } : {}}
                          className="filterLabel-text-truncate"
                          onClick={() => {
                            this.dpfSetKeySelectedState(i, true);
                          }}
                          title={f.key.label}
                        >
                          {f?.key?.label ? f.key.label : `[key${i}]`}
                        </a>

                        <span style={f.keySelected ? {} : { display: 'none' }}>
                          <Select
                            maxMenuHeight={170}
                            width={10}
                            options={[...this.dataProviderFilterOptions, ...this.dataProviderCustomFilterOptions]}
                            value={f.key}
                            onBlur={() => {
                              this.dpfSetKeySelectedState(i, false);
                            }}
                            onChange={(value) => {
                              this.onDPFKeyChange(value, i);
                            }}
                            allowCustomValue
                            onCreateOption={(customValue) => {
                              this.dataProviderCustomFilterOptions = [
                                ...this.dataProviderCustomFilterOptions,
                                { label: customValue, value: customValue },
                              ];
                              this.onDPFKeyChange({ label: customValue, value: customValue }, i);
                            }}
                          />
                        </span>
                        <span>&nbsp;</span>
                        <div className="query-segment-operator">=</div>
                        <span>&nbsp;</span>
                        <a
                          style={f.valuesSelected ? { display: 'none' } : {}}
                          className="filterVal-text-truncate"
                          onClick={() => {
                            this.dpfSetValueSelectedState(i, true);
                          }}
                          title={this.getCombinedFilterValues(f.values)}
                        >
                          {this.getCombinedFilterValues(f.values)}
                        </a>
                        <span style={f.valuesSelected ? {} : { display: 'none' }}>
                          {f.key.value &&
                          this.dataProviderFiltersValues[f.key.value] &&
                          !this.dataProviderFiltersValues[f.key.value].isMultiple ? (
                            <Select
                              maxMenuHeight={170}
                              width={19}
                              options={[
                                ...this.dataProviderFilterValueOptions[i],
                                ...this.dataProviderCustomFilterValueOptions[i],
                              ]}
                              value={f.values}
                              onBlur={() => {
                                this.dpfSetValueSelectedState(i, false);
                              }}
                              onChange={(value) => {
                                this.onDPFValueChange(value, i);
                              }}
                              allowCustomValue
                              onCreateOption={(customValue) => {
                                this.dataProviderCustomFilterValueOptions[i] = [
                                  ...this.dataProviderCustomFilterValueOptions[i],
                                  { label: customValue, value: customValue },
                                ];
                                this.onDPFValueChange({ label: customValue, value: customValue }, i);
                              }}
                            />
                          ) : (
                            <MultiSelect
                              maxMenuHeight={170}
                              width={20}
                              options={[
                                ...this.dataProviderFilterValueOptions[i],
                                ...this.dataProviderCustomFilterValueOptions[i],
                              ]}
                              value={f.values}
                              onBlur={() => {
                                this.dpfSetValueSelectedState(i, false);
                              }}
                              onChange={(value) => {
                                this.onDPFValuesChange(value, i);
                              }}
                              allowCustomValue
                              onCreateOption={(customValue) => {
                                this.dataProviderCustomFilterValueOptions[i] = [
                                  ...this.dataProviderCustomFilterValueOptions[i],
                                  { label: customValue, value: customValue },
                                ];
                                this.onDPFValuesChange([{ label: customValue, value: customValue }], i);
                              }}
                            />
                          )}
                        </span>

                        <span>&nbsp;&nbsp;&nbsp;</span>
                      </div>
                      <Button
                        data-key={i}
                        size="sm"
                        variant="secondary"
                        icon="times"
                        title="Remove filter"
                        onClick={this.onDPFRemovePress}
                      />
                    </span>
                  );
                })}
                <span className="gf-form-label filter-add-btn-container">
                  <Button
                    icon="plus"
                    variant="secondary"
                    title="Add new filter"
                    onClick={this.onAddNewFilterClick}
                    className="gf-form-label query-part"
                  />
                </span>
              </div>
            </div>
            {isFRUN ? (
              <></>
            ) : (
              <>
                {/* <div className="gf-form-inline"> */}
                <div className="gf-form">
                  <label className="gf-form-label width-11">Dimensions</label>
                  <MultiSelect
                    maxMenuHeight={170}
                    options={[...this.dataProviderDimensionOptions, ...this.dataProviderCustomDimensionOptions]}
                    value={drilldown.dimensions}
                    onChange={(value) => {
                      this.onDrilldownDimValuesChange(value);
                    }}
                    allowCustomValue
                    onCreateOption={(customValue) => {
                      this.dataProviderCustomDimensionOptions = [
                        ...this.dataProviderCustomDimensionOptions,
                        { label: customValue, value: customValue },
                      ];
                      this.onDrilldownDimValuesChange([{ label: customValue, value: customValue }]);
                    }}
                  />
                </div>
                <div className="gf-form">
                  <label className="gf-form-label width-11">Measures</label>
                  <div className="gf-form wrap-flex">
                    {drilldown.measures.map((m, i) => (
                      <span className="gf-form-label" key={i}>
                        <Select
                          width={20}
                          maxMenuHeight={170}
                          placeholder="Method"
                          options={aggrMethods}
                          value={m.aggrMethod}
                          onChange={(value) => {
                            this.onDrilldownMeasureMethodChange(value, i);
                          }}
                        />
                        <span>&nbsp;</span>
                        <div className="query-segment-operator">(</div>
                        <span>&nbsp;</span>
                        <Select
                          maxMenuHeight={170}
                          placeholder="Method"
                          options={[...this.dataProviderMeasuresOptions, ...this.dataProviderCustomMeasuresOptions]}
                          value={m.value}
                          onChange={(value) => {
                            this.onDrilldownMeasureValueChange(value, i);
                          }}
                          allowCustomValue
                          onCreateOption={(customValue) => {
                            this.onDrilldownMeasureValueChange({ label: customValue, value: customValue }, i);
                          }}
                        />
                        <span>&nbsp;</span>
                        <div className="query-segment-operator">)</div>
                        <span>&nbsp;</span>

                        <span>&nbsp;&nbsp;&nbsp;</span>
                        <Button
                          data-key={i}
                          size="sm"
                          variant="secondary"
                          icon="times"
                          title="Remove filter"
                          onClick={this.onDrilldownMeasureRemovePress}
                        />
                      </span>
                    ))}
                    <Button
                      icon="plus"
                      variant="secondary"
                      title="Add new filter"
                      onClick={this.onAddNewDrilldownMeasureClick}
                      className="gf-form-label query-part"
                    />
                  </div>
                </div>
                {/* </div> */}
              </>
            )}
          </>
        )}
      </>
    );
  }
}
