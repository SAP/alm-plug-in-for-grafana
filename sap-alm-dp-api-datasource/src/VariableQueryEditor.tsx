// import defaults from 'lodash/defaults';

import React, { useState, MouseEvent } from 'react';
import { AsyncSelect, Button, Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { DataSource } from './DataSource';
import { DPFilterResponse, MyVariableQuery } from './types';

const resTypes = [
  { label: 'Attribute', value: 'ATTR' },
  { label: 'Dimension', value: 'DIM' },
  { label: 'Measure', value: 'MEAS' },
];

interface VariableQueryProps {
  datasource: DataSource;
  query: MyVariableQuery;
  onChange: (query: MyVariableQuery, definition: string) => void;
}

let dataProviderOptions: Array<SelectableValue<string>> = [];
let dataProviderFilterOptions: Array<SelectableValue<string>> = [];
let dataProviderFiltersValues: { [key: string]: DPFilterResponse } = {};
let dataProviderDimensionOptions: Array<SelectableValue<string>> = [];
let dataProviderMeasuresOptions: Array<SelectableValue<string>> = [];
let valueOptions: Array<SelectableValue<string>> = [];

export const VariableQueryEditor: React.FC<VariableQueryProps> = ({ datasource, query, onChange }) => {
  const saveQuery = () => {
    let text = '';
    if (state.dataProvider) {
      text =
        text + (state.dataProvider.value ? `DP = "${state.dataProvider.label} [${state.dataProvider.value}]"` : '');
    }
    if (state.type && state.value) {
      let val = state.value.value ? `${state.value.label} [${state.value.value}]` : '';
      text = text + (state.type.value ? ` -- ${state.type.value} = "${val}"` : '');
    }

    onChange(state, text);
  };

  /* ---------------- Utilities ---------------- */

  /* Load Data Providers List */
  const loadDataProviders = (q: string) => {
    return new Promise<Array<SelectableValue<string>>>((resolve) => {
      // Retrieval of data providers list and parse it to options list
      datasource.searchDataProviders(q, '').then(
        (result) => {
          dataProviderOptions = result.map((value) => ({
            label: value.text,
            value: value.value,
            description: value.value,
          }));
          const fdp = dataProviderOptions.find((dp) => {
            return query && query.dataProvider && dp.value === query.dataProvider.value;
          });

          cleanUpDPFilters();

          if (fdp) {
            // setDataProvider(fdp);
            loadDPFilters(query.dataProvider.value);
          }

          resolve(dataProviderOptions);
        },
        (response) => {
          throw new Error(response.statusText);
        }
      );
    });
  };

  const cleanUpDPFilters = () => {
    dataProviderFilterOptions = [];
    // dataProviderFilterValueOptions = [];
    dataProviderFiltersValues = {};
    dataProviderMeasuresOptions = [];
  };

  /* Load Data Providers List */
  const loadDPFilters = (dp = '', rfilter?: DPFilterResponse) => {
    // Load all related filters
    if (dp && dp !== '') {
      datasource.searchDataProviderFilters(dp, '').then(
        (result) => {
          if (!rfilter) {
            cleanUpDPFilters();
          }
          // Process result
          result.forEach((filter, i) => {
            let exist = dataProviderFiltersValues[filter.key] ? true : false;

            if (filter.type === 'attribute' || (filter.type === 'dimension' && filter.isAttribute)) {
              dataProviderFiltersValues[filter.key] = filter;
              if (!exist) {
                dataProviderFilterOptions.push({
                  value: filter.key,
                  label: filter.name,
                  description: filter.description,
                });
              }
            }

            // Get list of dimensions
            if (!exist && filter.type === 'dimension') {
              dataProviderDimensionOptions.push({
                value: filter.key,
                label: filter.name,
                description: filter.description,
              });
            }

            // Extract list of measures
            if (!exist && filter.type === 'measure') {
              dataProviderMeasuresOptions = filter.values.map((value) => ({ label: value.label, value: value.key }));
            }
          });

          // Update value options
          if (state.type && state.type.value) {
            updateValueOptions(state.type.value);
          }
        },
        (response) => {
          throw new Error(response.statusText);
        }
      );
    }
  };

  const updateValueOptions = (ptype?: string) => {
    valueOptions = [];
    switch (ptype) {
      case 'ATTR':
        // Load attributes to values select box
        dataProviderFilterOptions.forEach((f) => {
          valueOptions.push(f);
        });
        break;
      case 'DIM':
        // Load dimensions to values select box
        dataProviderDimensionOptions.forEach((f) => {
          valueOptions.push(f);
        });
        break;
      case 'MEAS':
        // Load measures to values select box
        dataProviderMeasuresOptions.forEach((f) => {
          valueOptions.push(f);
        });
        break;
    }
  };

  /* ------------------------------------------------ */

  /* ---------------- Event Handlers ---------------- */

  const onRefreshDPList = (event: MouseEvent<HTMLButtonElement>) => {
    setState({ ...state, dpASKey: Date.now().toString() });
  };

  /* Data Provider Selected Event */
  const onDataProviderChange = (value: SelectableValue<string>) => {
    setState({ ...state, dataProvider: value });
    loadDPFilters(value.value);
  };

  /* Property Type Change */
  const onTypeChange = (value: SelectableValue<string>) => {
    setState({ ...state, type: value });
    updateValueOptions(value.value);
  };

  /* Property Value Change */
  const onValueChange = (value: SelectableValue<string>) => {
    setState({ ...state, value: value });
  };

  const [state, setState] = useState(query);

  if (query && query.type && query.type.value && query.type.value !== '') {
    updateValueOptions(query.type.value);
  }

  /* ------------------------------------------------ */

  return (
    <>
      <div className="gf-form">
        <label className="gf-form-label width-10">Data Provider</label>
        <AsyncSelect
          key={JSON.stringify(state.dpASKey)}
          placeholder="Select a data provider"
          loadOptions={loadDataProviders}
          defaultOptions
          onChange={onDataProviderChange}
          onBlur={saveQuery}
          value={state.dataProvider}
          cacheOptions={false}
          allowCustomValue
        />
        <Button
          icon="sync"
          variant="secondary"
          title="Refresh Data Providers List"
          onClick={onRefreshDPList}
          className="gf-form-label query-part"
        />
      </div>
      <div className="gf-form-inline">
        <div className="gf-form max-width-21">
          <label className="gf-form-label width-10">Type</label>
          <Select
            placeholder="Select a property type"
            options={resTypes}
            value={state.type}
            onChange={onTypeChange}
            onBlur={saveQuery}
            allowCustomValue
          />
        </div>
        {state.type && state.type.value === 'ATTR' ? (
          <div className="gf-form max-width-21">
            <label className="gf-form-label width-10">Values of</label>
            <Select
              placeholder="Select a property"
              options={valueOptions}
              value={state.value}
              onChange={onValueChange}
              onBlur={saveQuery}
              allowCustomValue
            />
          </div>
        ) : (
          ''
        )}
      </div>
    </>
  );
};
