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
  Period = 'P',
  Min5 = '5Mi',
  Min10 = '10Mi',
  Min15 = '15Mi',
  Min30 = '30Mi',
}

export enum AggrMethod {
  Avg = 'AVG',
  Min = 'MIN',
  Max = 'MAX',
  Sum = 'SUM',
  Percent = 'PERCENT',
}

export enum FilterType {
  measure = 'measure',
  dimension = 'dimension',
  attribute = 'attribute',
}

export enum FDoW {
  Sat = 'SA',
  Sun = 'SU',
  Mon = 'MO',
}
