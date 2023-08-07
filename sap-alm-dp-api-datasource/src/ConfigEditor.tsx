import React, { PureComponent, ChangeEvent } from 'react';
import { DataSourceHttpSettings, InlineField, InlineFieldRow, InlineLabel, InlineSwitch, Input, Select, VerticalGroup } from '@grafana/ui';
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
          <h6>Destination System</h6>
          <InlineFieldRow>
            <InlineField labelWidth={26} label="SAP Cloud ALM">
              <InlineSwitch id="swIsCALM" value={!jsonData.isFRUN} onChange={this.onIsCALMChange} />
            </InlineField>
            <InlineField labelWidth={26} label="SAP Focused Run">
              <InlineSwitch id="swIsFRUN" value={jsonData.isFRUN} onChange={this.onIsFRUNChange} />
            </InlineField>
          </InlineFieldRow>
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
              <InlineFieldRow>
                <InlineField labelWidth={26} label="Alias" grow>
                  <Input id="inpAlias" value={jsonData.alias} onChange={this.onAliasChange} />
                </InlineField>
              </InlineFieldRow>
            </div>
          )}
        </div>

        <div className="gf-form-group">
          <h3 className="page-heading">Global Query Settings</h3>
          <div className="gf-form-group">
            <InlineFieldRow>
              <InlineField labelWidth={26} label="Resolution" grow>
                <Select
                  options={resOptions}
                  defaultValue={jsonData.resolution}
                  value={jsonData.resolution}
                  onChange={this.onResolutionChange}
                />
              </InlineField>
            </InlineFieldRow>
            <InlineFieldRow>
              <InlineField labelWidth={26} label="Data Providers Settings" grow>
                <VerticalGroup spacing='xs'>
                  <InlineFieldRow>
                    <InlineLabel width={27}>Id</InlineLabel>
                    <InlineLabel width={36}>Name</InlineLabel>
                    <InlineLabel width={15}>Used version</InlineLabel>
                  </InlineFieldRow>
                  {this.dataProviderOptions.map((dp, i) => {
                    return (
                      <InlineFieldRow key={dp.value}>
                        <InlineLabel width={27} title={dp.description}>{dp.value}</InlineLabel>
                        <InlineLabel width={36} title={dp.description}>{dp.label}</InlineLabel>
                        <Select
                          width={15}
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
                      </InlineFieldRow>
                      // <div key={dp.value} className="gf-form">
                      //   <label className="gf-form-label width-13" title={dp.description}>
                      //     {dp.value}
                      //   </label>
                      //   <label className="gf-form-label width-18" title={dp.description}>
                      //     {dp.label}
                      //   </label>
                      //   <Select
                      //     width={12}
                      //     options={this.dataProviderVersionsOptions[i]}
                      //     defaultValue={{ value: 'LATEST', label: 'Latest' }}
                      //     value={
                      //       jsonData.dataProviderConfigs && dp && dp.value && jsonData.dataProviderConfigs[dp.value]
                      //         ? jsonData.dataProviderConfigs[dp.value].version
                      //         : undefined
                      //     }
                      //     onChange={(item) => {
                      //       this.onDPVersionChange(item, i);
                      //     }}
                      //   />
                      // </div>
                    );
                  })}
                </VerticalGroup>
              </InlineField>
            </InlineFieldRow>
          </div>
        </div>
      </>
    );
  }
}
