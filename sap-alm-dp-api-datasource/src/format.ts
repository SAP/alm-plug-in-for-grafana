export enum Format {
  Table = 'table',
  Timeseries = 'timeseries',
  RawTable = 'rawtable',
}

export enum Resolution {
  Hour = 'H',
  Day = 'D',
  Week = 'W',
  Month = 'M',
  Year = 'Y',
  Raw = 'R',
}

export enum AggrMethod {
  Avg = 'AVG',
  Min = 'MIN',
  Max = 'MAX',
  Sum = 'SUM',
}

export enum FilterType {
  measure = 'measure',
  dimension = 'dimension',
  attribute = 'attribute',
}
