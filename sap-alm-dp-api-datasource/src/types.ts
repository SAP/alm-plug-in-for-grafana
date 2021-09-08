import { DataQuery, DataSourceJsonData, SelectableValue } from '@grafana/data';
import { Format, Resolution, AggrMethod, FilterType } from 'format';

export interface ConfigQueryResolution {
  default?: Resolution;
  autoDecide?: true;
}

export interface QueryDrilldownMeasure {
  value: SelectableValue<string>;
  aggrMethod: SelectableValue<AggrMethod>;
}

export interface QueryDrilldown {
  dimensions: Array<SelectableValue<string>>;
  measures: QueryDrilldownMeasure[];
}

export interface DataProviderFilter {
  key: SelectableValue<string>;
  values: Array<SelectableValue<string>>;
  keySelected: boolean;
  valuesSelected: boolean;
}

export interface MyQuery extends DataQuery {
  name: string;
  type: Format;
  isConfig: boolean;
  dataProvider: SelectableValue<string>;
  dataProviderFilters: DataProviderFilter[];
  resolution?: ConfigQueryResolution;
  drilldown: QueryDrilldown;
}

export interface MyVariableQuery {
  dataProvider: SelectableValue<string>;
  type: SelectableValue<string>;
  value: SelectableValue<string>;
}

export const defaultQuery: Partial<MyQuery> = {
  name: "",
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
    dimensions: []
  },
};

/**
 * These are options configured for each DataSource instance
 */

export interface DataProviderConfig {
  dataProvider: SelectableValue<string>;
  version: SelectableValue<string>;
}

export interface MyDataSourceOptions extends DataSourceJsonData {
  resolution?: Resolution;
  oauthPassThru?: boolean;
  isFRUN?: boolean;
  alias?: string;
  dataProviderConfigs?: {[key: string]: DataProviderConfig};
}

export interface TextValuePair {
  text: string;
  value: any;
}

export interface KeyLabelPair {
  key: string;
  label: string;
}

export interface DPResponse {
  name: string;
  description: string;
  service: string;
  domain: string;
  version: string[];
  plan: string;
  calmMarket: string;
}

export interface DPFilterResponse {
  key: string;
  name: string;
  description: string;
  values: KeyLabelPair[];
  isAttribute: boolean;
  isMultiple: boolean;
  triggerRefresh: boolean;
  group: string;
  type: FilterType;
}
/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
// export interface MySecureJsonData {
//   apiKey?: string;
// }
