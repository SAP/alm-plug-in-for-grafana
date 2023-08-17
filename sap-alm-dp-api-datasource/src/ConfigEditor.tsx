import defaults from 'lodash/defaults';
import React, { PureComponent, ChangeEvent } from 'react';
import { 
  DataSourceHttpSettings, 
  InlineField, 
  InlineFieldRow, 
  InlineLabel, 
  InlineSwitch, 
  Input, 
  Select, 
  VerticalGroup, 
  TabsBar, 
  Tab, 
  TabContent } from '@grafana/ui';
import {
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  DataSourceSettings,
  SelectableValue,
} from '@grafana/data';
import { DPResponse, MyDataSourceOptions, MySecureOptions, DEFAULT_DSO } from './types';
import { Resolution } from 'format';
import { FetchResponse, getBackendSrv } from '@grafana/runtime';
import _ from 'lodash';
import { lastValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';

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
const predefAlias = 'zudr';

interface Props extends DataSourcePluginOptionsEditorProps<MyDataSourceOptions, MySecureOptions> {};

export class ConfigEditor extends PureComponent<Props> {
  dataProviderOptions: Array<SelectableValue<string>> = [];
  dataProviderVersionsOptions: Array<Array<SelectableValue<string>>> = [];
  tabs: any[] = [{
    label: "Connection",
    active: true
  }, {
    label: "Global Query Settings",
    active: false
  }];

  constructor(props: Readonly<Props>) {
    super(props);

    this.getDPList();
  }

  async getDPList(): Promise<void | FetchResponse<void | DPResponse[]>> {
    let url = '';
    if (this.props.options.jsonData.isFRUN) {
      url = `/api/datasources/proxy/${this.props.options.id}${dpListPath}`;
    } else if (!this.props.options.jsonData.isPredefined) {
      url = `/api/datasources/proxy/${this.props.options.id}/${predefAlias}${routePath}${dpListPath}`;
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

    if (dp?.value) {
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

  onIsPredefinedChange = (e: { currentTarget: { checked: any } }) => {
    const { onOptionsChange, options } = this.props;
    const jsonData = {
      ...options.jsonData,
      isPredefined: e.currentTarget.checked,
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

  onAPIURLChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const jsonData = {
      ...options.jsonData,
      apiUrl: event.target.value,
    };
    onOptionsChange({ ...options, jsonData });
  };

  onTokenURLChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const jsonData = {
      ...options.jsonData,
      tokenUrl: event.target.value,
    };
    onOptionsChange({ ...options, jsonData });
  };

  onClientIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const secureJsonData = {
      ...options.secureJsonData,
      cId: event.target.value,
    };
    onOptionsChange({ ...options, secureJsonData });
  };

  onResetClientId = () => {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({ 
      ...options,
      secureJsonFields: {
        ...options.secureJsonFields,
        cId: false,
      },
      secureJsonData: {
        ...options.secureJsonData,
        cId: ""
      }
    });
  };

  onClientSecChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const secureJsonData = {
      ...options.secureJsonData,
      cSec: event.target.value,
    };
    onOptionsChange({ ...options, secureJsonData });
  };

  onResetClientSec = () => {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({ 
      ...options,
      secureJsonFields: {
        ...options.secureJsonFields,
        cSec: false,
      },
      secureJsonData: {
        ...options.secureJsonData,
        cSec: ""
      }
    });
  };

  render() {
    const { options } = this.props;
    const { secureJsonData, secureJsonFields } = options;
    const jsonData = defaults(options.jsonData, DEFAULT_DSO);

    return (
      <>
      <div className="gf-form-group">
        <TabsBar>
          {this.tabs.map((tab, index) => {
            return (
              <Tab
                key="index"
                label={tab.label}
                active={tab.active}
                onChangeTab={() => { this.tabs = this.tabs.map((tab, idx) => ({ ...tab, active: idx === index })); this.props.onOptionsChange({...this.props.options}) }} />
            );
          })}
        </TabsBar>
      </div>
      <TabContent>
        { this.tabs[0].active && 
          <div className="gf-form-group">
            <h3 className="page-heading">Destination System</h3>
            <div className="gf-form-group">
              <InlineFieldRow>
                <InlineField labelWidth={26} label="SAP Cloud ALM">
                  <InlineSwitch id="swIsCALM" value={!jsonData.isFRUN} onChange={this.onIsCALMChange} />
                </InlineField>
                <InlineField labelWidth={26} label="SAP Focused Run">
                  <InlineSwitch id="swIsFRUN" value={jsonData.isFRUN} onChange={this.onIsFRUNChange} />
                </InlineField>
              </InlineFieldRow>
            </div>
            <h3 className="page-heading">Parameters</h3>
            {jsonData.isFRUN ? (
              <DataSourceHttpSettings
                defaultUrl={'http://localhost:8080'}
                dataSourceConfig={options}
                showAccessOptions={true}
                onChange={this.onHTTPSettingsChange}
              />
            ) : (
              <>
              <div className="gf-form-group">
                <InlineFieldRow>
                  <InlineField labelWidth={26} label="Predefined" tooltip="URL and authentication method are predefined in plugin.json as route. If so, provide route name in Alias field.">
                    <InlineSwitch id="swIsPredef" value={jsonData.isPredefined} onChange={this.onIsPredefinedChange} />
                  </InlineField>
                  {jsonData.isPredefined ? (
                    <InlineFieldRow>
                      <InlineField labelWidth={26} label="Alias">
                        <Input id="inAlias" placeholder="Enter route name" value={jsonData.alias} onChange={this.onAliasChange} />
                      </InlineField>
                    </InlineFieldRow>
                  ) : (
                    <InlineFieldRow>
                      <InlineField labelWidth={26} label="Alias" tooltip="Default route 'zudr' is required. Please refer to documentation for the configuration.">
                        <Input id="inZUDRAlias" value="zudr" disabled={true} />
                      </InlineField>
                    </InlineFieldRow>
                  )}
                </InlineFieldRow>
              </div>
              <div className="gf-form-group">
                {jsonData.isPredefined ? (
                  <></>
                ) : (
                  <>
                  <div className="gf-form-group">
                    <h3 className="page-heading">HTTP</h3>
                    <InlineFieldRow>
                      <InlineField labelWidth={26} label="URL" tooltip="URL to your Cloud ALM API Service." grow>
                        <Input id="inAPIURL" placeholder="Enter API Service URL" value={jsonData.apiUrl} onChange={this.onAPIURLChange} />
                      </InlineField>
                    </InlineFieldRow>
                  </div>
                  <h3 className="page-heading">OAuth 2.0</h3>
                  <InlineFieldRow>
                    <InlineField labelWidth={26} label="Token URL" tooltip="URL to your Cloud ALM Token Provider Service." grow>
                      <Input id="inTokenURL" placeholder="Enter Token URL" value={jsonData.tokenUrl} onChange={this.onTokenURLChange} />
                    </InlineField>
                  </InlineFieldRow>
                  <InlineFieldRow>
                    <InlineField labelWidth={26} label="Client Id" tooltip="Client Id in OAuth2 Authentication." grow>
                      <Input id="inCId" 
                        type="password"
                        placeholder={secureJsonFields?.cId ? "configured" : "Enter Client Id"} 
                        value={secureJsonData?.cId ?? ""} 
                        onChange={this.onClientIdChange} />
                    </InlineField>
                  </InlineFieldRow>
                  <InlineFieldRow>
                    <InlineField labelWidth={26} label="Client Secret" tooltip="Client Secret in OAuth2 Authentication."grow>
                      <Input id="inCSec" 
                        type="password"
                        disabled={!!secureJsonFields?.cSec}
                        placeholder={secureJsonFields?.cSec ? "configured" : "Enter Client Secret"} 
                        value={secureJsonData?.cSec ?? ""} 
                        onChange={this.onClientSecChange} />
                    </InlineField>
                  </InlineFieldRow>
                  </>
                )}
              </div>
              </>
            )}
          </div>
        }

        { this.tabs[1].active && 
          <div className="gf-form-group">
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
                      );
                    })}
                  </VerticalGroup>
                </InlineField>
              </InlineFieldRow>
            </div>
          </div>
        }
      </TabContent>
      </>
    );
  }
}
