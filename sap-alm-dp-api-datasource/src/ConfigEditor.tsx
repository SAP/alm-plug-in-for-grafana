import React, { PureComponent, ChangeEvent } from 'react';
import { DataSourceHttpSettings, Select, Switch } from '@grafana/ui';
import {
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  DataSourceSettings,
  SelectableValue,
} from '@grafana/data';
import { DPResponse, MyDataSourceOptions } from './types';
import { Resolution } from 'format';
import { FetchResponse, getBackendSrv } from '@grafana/runtime';
import _ from 'lodash';
import { lastValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';

// const { FormField } = LegacyForms;
// const { SecretFormField, FormField } = LegacyForms;

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

const routePath = '/analytics';
const dpListPath = '/providers';

interface Props extends DataSourcePluginOptionsEditorProps<MyDataSourceOptions> {}

export class ConfigEditor extends PureComponent<Props> {
  dataProviderOptions: Array<SelectableValue<string>> = [];
  dataProviderVersionsOptions: Array<Array<SelectableValue<string>>> = [];

  constructor(props: Readonly<Props>) {
    super(props);

    this.getDPList();
  }

  async getDPList(): Promise<void | FetchResponse<void | DPResponse[]>> {
    let url = '';
    if (this.props.options.jsonData.isFRUN) {
      url = `/api/datasources/proxy/${this.props.options.id}${dpListPath}`;
    } else {
      url = `/api/datasources/proxy/${this.props.options.id}/${this.props.options.jsonData.alias}${routePath}${dpListPath}`;
    }
    const obsver = getBackendSrv()
      .fetch({
        method: 'GET',
        url: url,
        // headers: this.headers,
        // credentials: this.withCredentials ? "include" : undefined,
      })
      .pipe(
        map((response: FetchResponse) => {
          this.dataProviderOptions = [];
          this.dataProviderVersionsOptions = [];

          response.data
            .sort((el1: DPResponse, el2: DPResponse) => {
              if (el1.name > el2.name) {
                return 1;
              } else if (el1.name < el2.name) {
                return -1;
              }
              return 0;
            })
            .forEach((value: DPResponse) => {
              this.dataProviderOptions.push({
                label: value.description.split(' ').map(_.upperFirst).join(' '),
                value: value.name,
                description: value.description,
              });
              this.dataProviderVersionsOptions.push([{ label: 'Latest', value: 'LATEST' }]);
              if (value.version) {
                value.version.forEach((v) => {
                  this.dataProviderVersionsOptions[this.dataProviderOptions.length - 1].push({
                    label: v,
                    value: v,
                  });
                });
              }
            });

          const { onOptionsChange, options } = this.props;

          onOptionsChange({ ...options });
        })
      );

    const result = await lastValueFrom(obsver);
    return result;
  }

  onHTTPSettingsChange = (config: DataSourceSettings<DataSourceJsonData, {}>) => {
    const { onOptionsChange, options } = this.props;

    if (config.url !== options.url) {
      this.getDPList();
    }

    onOptionsChange({ ...options, ...config });
  };

  onResolutionChange = (item: SelectableValue<Resolution>) => {
    const { onOptionsChange, options } = this.props;
    const jsonData = {
      ...options.jsonData,
      resolution: item.value,
    };
    onOptionsChange({ ...options, jsonData });
  };

  onDPVersionChange = (item: SelectableValue<string>, i: number) => {
    const { onOptionsChange, options } = this.props;
    const dp = this.dataProviderOptions[i];

    if (!options.jsonData.dataProviderConfigs) {
      options.jsonData.dataProviderConfigs = {};
    }

    if (dp && dp.value) {
      options.jsonData.dataProviderConfigs[dp.value] = {
        dataProvider: dp,
        version: item,
      };
    }

    const jsonData = {
      ...options.jsonData,
      dataProviderConfigs: {
        ...options.jsonData.dataProviderConfigs,
      },
    };

    onOptionsChange({ ...options, jsonData });
  };

  onIsFRUNChange = (e: { currentTarget: { checked: any } }) => {
    const { onOptionsChange, options } = this.props;
    const jsonData = {
      ...options.jsonData,
      isFRUN: e.currentTarget.checked,
    };
    onOptionsChange({ ...options, jsonData });
  };

  onIsCALMChange = (e: { currentTarget: { checked: any } }) => {
    const { onOptionsChange, options } = this.props;
    const jsonData = {
      ...options.jsonData,
      isFRUN: !e.currentTarget.checked,
    };
    onOptionsChange({ ...options, jsonData });
  };

  onAliasChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const jsonData = {
      ...options.jsonData,
      alias: event.target.value,
    };
    onOptionsChange({ ...options, jsonData });
  };

  render() {
    const { options } = this.props;
    const { jsonData } = options;
    // const { jsonData, secureJsonFields } = options;
    // const secureJsonData = (options.secureJsonData || {}) as MySecureJsonData;

    return (
      <>
        <div className="gf-form-group">
          <h3 className="page-heading">Connection</h3>
          <div className="gf-form-group">
            <h6>Destination System</h6>
            <div className="gf-form-inline">
              <div className="gf-form-switch-container-react">
                <label className="gf-form-label width-10">SAP Cloud ALM</label>
                <div className="gf-form-switch">
                  <Switch value={!jsonData.isFRUN} onChange={this.onIsCALMChange} />
                </div>
              </div>
              <div className="gf-form-switch-container-react">
                <label className="gf-form-label width-10">SAP Focused Run</label>
                <div className="gf-form-switch">
                  <Switch value={jsonData.isFRUN} onChange={this.onIsFRUNChange} />
                </div>
              </div>
            </div>
          </div>
          {jsonData.isFRUN ? (
            <DataSourceHttpSettings
              defaultUrl={'http://localhost:8080'}
              dataSourceConfig={options}
              showAccessOptions={true}
              onChange={this.onHTTPSettingsChange}
            />
          ) : (
            <div className="gf-form-group">
              <h6>System Settings</h6>
              <div className="gf-form">
                <label className="gf-form-label width-10">Alias</label>

                <input onChange={this.onAliasChange} value={jsonData.alias} className="gf-form-input" />
              </div>
            </div>
          )}
        </div>

        <div className="gf-form-group">
          <h3 className="page-heading">Global Query Settings</h3>
          <div className="gf-form-group">
            <div className="gf-form">
              <label className="gf-form-label width-10">Resolution</label>

              <Select
                options={resOptions}
                defaultValue={jsonData.resolution}
                value={jsonData.resolution}
                onChange={this.onResolutionChange}
              />
            </div>
          </div>
          <div className="gf-form-group">
            <h6>Data Providers Settings</h6>
            <div className="gf-form">
              <label className="gf-form-label width-13">Id</label>
              <label className="gf-form-label width-18">Name</label>
              <label className="gf-form-label width-6">Used Version</label>
            </div>
            {this.dataProviderOptions.map((dp, i) => {
              return (
                <div key={dp.value} className="gf-form">
                  <label className="gf-form-label width-13" title={dp.description}>
                    {dp.value}
                  </label>
                  <label className="gf-form-label width-18" title={dp.description}>
                    {dp.label}
                  </label>
                  <Select
                    width={12}
                    options={this.dataProviderVersionsOptions[i]}
                    defaultValue={{ value: 'LATEST', label: 'Latest' }}
                    value={
                      jsonData.dataProviderConfigs && dp && dp.value && jsonData.dataProviderConfigs[dp.value]
                        ? jsonData.dataProviderConfigs[dp.value].version
                        : undefined
                    }
                    onChange={(item) => {
                      this.onDPVersionChange(item, i);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  }
}
