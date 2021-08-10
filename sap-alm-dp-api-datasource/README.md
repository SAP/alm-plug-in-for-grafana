# Grafana Data Source Plug-In for SAP ALM

This Grafana data source plugin executes requests for analytical data from SAP ALM destinations by using Data Providers API REST service, and parsing the JSON result to the Grafana data frame.

## What is the Grafana data source Plug-In?
Grafana supports a wide range of data sources, including Prometheus, MySQL, and even Datadog. There’s a good chance you can already visualize metrics from the systems you have set up. In some cases, though, you already have an in-house metrics solution that you’d like to add to your Grafana dashboards. The Grafana Data source plug-in enables the integration of such solutions with Grafana.


## Compatibilities
The current version of the ALM plug-in for Grafana supports the following products:
- SAP Cloud ALM Analytics API.
- SAP Focused RUN 3.0 FP01 ALM Advanced Analytics API (Beta version).


## Pre-requisites
To get the list of Roles and Authorisations required to connect the ALM plug-in for Grafana, please refer to the SAP documentations for SAP Cloud ALM and SAP Focused RUN (Support Portal, master guide and security guides). Note the following:

- Technical users associated with the back-end access should have minimal roles for data display.
- Refer to roles and scopes description for each scenario in the corresponding security guides.


## Contents
- [Concepts](#SAP-ALM-API-Concepts)
   - [Output Format](#Output-Format)
   - [Time Dimensions](#Time-Dimensions)
   - [Queries](#Queries)
- [Package Assembly](#Package-Assembly)
- [Installation](#installation)
- [Setup](#setup)
- [Query Configuration](#query-configuration)
  - [Configuration Query](#configuration-query)
  - [Normal Query](#normal-query)
  - [Return Formats](#return-formats)
    - [Time Series Format](#time-series-format)
    - [Table Format](#table-format)
- [Query Variables](#query-variables)




## SAP Cloud ALM API Concepts
The SAP Cloud ALM Analytics API relies on the following concepts:

- **Providers**: Data providers are analytics data sources corresponding to the different objects or scenarios managed in SAP Cloud ALM. They could be Tasks, Projects, Alerts, Integration Monitoring, ..
- **Dimensions**: The Dimensions are the characteristics of SAP Cloud ALM entities. The Dimensions correspond to the different fields of the CALM entities. (ex: Name of Projects, Phase Status for CALM tasks).
- **Metrics**: Metrics are the quantitative measurements of SAP Cloud ALM analytics data sources. (ex: total number of tasks, average response time, ...). Different optional aggregation methods can be supported for each metrics (ex: avg, sum, max, min, Last, ....)


### Output Format
The CALM analytics API supports 2 output formats:
Series:
- **Time series**: A series of data points indexed in time order.
- **Categorical value series**: The values of measures are represented on the y-axis, while dimensions provide the axis of the chart.
- **Row-column** structured data format representing SAP Cloud ALM dimensions in columns.


### Time Dimensions
ALM analytics are constructed on a time dimension containing two attributes:
- **period**: The duration of the measurements (Ex: Today, Last 6 Months, ..). This is in general a dynamic rolling-time dimension.
- **resolution**: The scale of the data points. (Ex: hour, Month,..)

### Queries
Queries are the central mechanism of the SAP Cloud ALM Anlaytics API to format and retrieve data from SAP Cloud ALM.  A query is responsible to return either a set of measures (series) or a row-column structured data format (table) for a specific data provider and a given period based on filters and columns identified by selected dimensions of the data sources.


## Package Assembly

This section will help you build the plugin and install it manually in your Grafana instance.

### Prerequisites
- Grafana >= 7.0
- NodeJS >= 14
- yarn

### Assembly
- Open command and go to `sap-alm-dp-api-datasource` folder.
- Use command `yarn install` to install dependency libraries.
- Use command `yarn build` to build the plugin. This should create `dist` folder.
- Create `sap-alm-dp-api-datasource` folder in your Grafana plugins directory. Normally it should be in /data/plugins folder. For more information please refer to [Grafana Configuration Doc](https://grafana.com/docs/grafana/v7.5/administration/configuration).
- Copy the newly created `dist` folder into the newly created `sap-alm-dp-api-datasource` in Grafana plugins directory.
- Restart your Grafana or Grafana server to discover the plugin.
- Certain versions of Grafana require to disable the signature verification for unsigned plugins. In case the Data Source is not visible or is not working after the restart, add the following parameter to grafana.ini: allow_loading_unsigned_plugins=sap-alm-dp-api-datasource

## Installation

Normally you can install the plugin using `grafana-cli` tool. However, it is not possible for now. Please contact us for signed copy of the plugin by create issue with label `install`.

When it is available by using `grafana-cli` tool, you can do as follow:

```sh
 grafana-cli plugins install sap-alm-dp-api-datasource
 ```

## Setup

![Data Source Setup - URL](../../assets/SAP%20CALM%20DP%20API%20DS%20SETTINGS.png?raw=true)

When adding datasource, you need to provide your API end point for data source to make requests to. However there are differences when adding API endpoint with their respective authentication methods for the two types of destination. Details are as follow:

- For Cloud ALM:
    - Ask your Grafana administrator to add a route configuration in `routes` configuration of data source configuration file `plugin.json` with the properties as follow. It requires a restart of Grafana instance for the configuration to work.
    ![Data Source Setup - URL](../../assets/SAP%20CALM%20DP%20API%20DS%20PLUGIN%20CONFIG.png?raw=true)
        - `path`: Your destination alias. To be used in data source settings.
        - `url`: Your API end point. Path should be: `/api/calm-analytics/v1`.
        - `tokenAuth`: Authentication via Token.
            - `url`: Authentication end point.
            - `params`: Parameters for authentication.
                - `grant_type`: Type of token provider.
                - `client_id`: Your authentication client id.
                - `client_secret`: Your authentication client secret.
    - Use the value in the `path` field as `alias` field in data source settings.
    ![Data Source Setup - CALM Alias](../../assets/SAP%20CALM%20DP%20API%20DS%20CALM%20SYS%20SETTINGS.png?raw=true)

CALM REST Service may have different versions for specific data provider. You may choose the desired versions in table below.

![Data Source Setup - Data Providers Version Selection](../../assets/SAP%20CALM%20DP%20API%20DS%20DP%20Versions.png?raw=true)

Once data source setup has been done, you are ready to configure queries for data retrieval.

## Query Configuration

Before going into query configuration, let's have a general view on organization of DP API REST Serivce.

![Data Source Setup - DP REST API](../../assets/SAP%20CALM%20DP%20API%20DS%20DP%20API.png?raw=true)

The service provides data for different areas or applications of the destination. These areas or applications are called `Data Provider`s by the service.

Each `Data Provider` has its own set of attributes, dimensions, and measures which can be used to retrieve intended data.

Normally data will be requested for a specific time period with a specific resolution.

Resolution can be defined universally for all panels using data source in data source set up, or in `Configuration Query`. More on it can be found later.

![Data Source Setup - Global Resolution](../../assets/SAP%20CALM%20DP%20API%20DS%20Res%20Global.png?raw=true)

If no resolution is instructed, `Data Provider` will decide what's best.

These information are available to be configured in query. Query also need additional informations for better data format when returning from the serivce.

The query can be defined as normal query or `Configuration Query`. The difference is that Configuration Query is not used to retrieve data, but is used to have universal configuration for the panel's normal queries.

### Configuration Query
`Configuration Query` is declared by toggle the switch for it to on. You can toggle multiple queries switch on, but only the first one will be accounted for.

![Data Source Setup - Configuration Query](../../assets/SAP%20CALM%20DP%20API%20DS%20Config%20Query.png?raw=true)

`Configuration Query` can be used to defined requested resoution for all queries.

If `Automatic Resolution` is used, data source will decide resolution based on maximum number of points supported by panel, and the requested period.

Otherwise, data source will use provided `Default Resolution` as resolution for queries' request.

### Normal Query

This is where you configure the criterias by which the `Data Provider` uses to retrieve data.

![Data Source Setup - Query](../../assets/SAP%20CALM%20DP%20API%20DS%20Query.png?raw=true)

The information one query can hold is as follow:
- `Format As`: responded data should be formatted as provided. Options are:
    - `Time Series`: data is returned in time series format.
    - `Table`: data is returned in table format for the most recent time frame in the requested period.
    - `Raw Table`: data is returned in table format.
- `Legend`: name of query. It will be used as legend or part of legends if query is to retrieve multiple dataset.
- `Data Provider`: area or application of destination system to retrieve data from.
- `Filters`: provide attributes as filters for `Data Provider` to use as criterias for retrieving data.
    - Add new filter:
        - Click the plus `+` button to add new filter.
        - Select attribute name in first select list, or type custom attribute name.
        - Select value or values of attribute in the second select list as criterias for the attribute.
    - Edit filter:
        - Click on attribute name or attribute's values. Select list will appear.
        - Edit as before.
    - Delete filter:
        - Click on the `x` button on the filter to delete it.
- `Dimensions`: provide one or many dimensions to request.
    - Only CALM has this definition.
- `Measures`: provide the measures to request.
    - Only CALM has this definition.
    - Add new measure:
        - Click the plus `+` button to add new measure.
        - Select method of measurement in first select list.
        - Select measure variable in the second select list.
    - Edit measure:
        - Change values in respective select list.
    - Delete measure:
        - Click on the `x` button on the measure to delete it.

## Return Formats

Different formats are used for different use cases. Mostly it is depended on the type of visualization in Panel.

### Time Series Format

Time series format is used in general for chart visualization.

Returning format is as follow:

```json
[
    {
        "serieName": "Query1-TASK_STATUS_COUNTER",
        "attributes": [
            {
                "key": "PROJECT_GUID",
                "value": "guid1"
            },
            {
                "key": "PROJECT_NAME",
                "value": "project1"
            },
            {
                "key": "STATUS",
                "value": "in process"
            }
        ],
        "dataPoints": [
            [
                 20,
                 1621096874000            
           ]
        ]
    },
     ...,
    {
        "serieName": "Query1-NB_TOTAL_TASK",
        "attributes": [
            {
                "key": "PROJECT_GUID",
                "value": "guid1"
            },
            {
                "key": "PROJECT_NAME",
                "value": "project1"
            },
            {
                "key": "STATUS",
                "value": "in process"
            }
        ],
        "dataPoints": [
           [
                 15,
                 1621096874000            
           ]
        ]
    }
]
```

Return is list of datasets, where each dataset contains:
    -`serieName`: Name of time series. Can be a concatenation of query legend and series name for better differentiation.
    - `attributes`: List of related attributes of dataset.
    - `dataPoints`: List of data points. Each point is a list of value and UNIX time stamp.

### Table Format

Table format is used for table visualization of data. The format is organized as columns and rows to better display as table.

Returning format is as follow:

```json
[
    {
        "columns": [
            {
                "text": "timestamp",
                "type": "time"
            },
            {
                "text": "PROJECT_GUID",
                "type": "string"
            },
            {
                "text": "PROJECT_NAME",
                "type": "string"
            },
            {
                "text": "STATUS",
                "type": "string"
            },
            {
                "text": "TASK_STATUS_COUNTER",
                "type": "number"
            },
            {
                "text": "NB_TOTAL_TASK",
                "type": "number"
            }
        ],
        "rows": [
            [
                "1621096874000",
                "guid1",
                "project1",
                "open",
                10,
                15
            ],
            [
                "1621096874000",
                "guid1",
                "project1",
                "in process",
                20,
                15
            ]
        ]
    }
]
```

Return is a list of dataset, where each dataset contains:
- `columns`: list of columns which each column has a text and type of value. Value's types are `string` for simple text, `time` for UNIX time stamp, and `number` for number value.
- `rows`: list of rows. Each row has a list of values which correspond to the columns respectively.

## Query Variables

The plugin supports dashboard variables for query to provide a more dynamic approach to dashboard.

To configure query variables, go to `Dashboard Settings` (using cord wheel icon on top right corner), and select `Variables` tab.

![Dashboard Settings - Query Variables](../../assets/Query%20Variables.png?raw=true)

- Click `New` button to add a new variable, or select variable's name to edit.
- In `General` section of variable editor:
    - Provide `Name`. This is important as it will be used in query configuration.
    - Choose `Query` as option for `Type` field.
    - Provide `Label` for the display on dashboard.
- In `Query Options` of variable editor:
    - Provide `Data source` which is the added plugin data source.
    - Provide `Data Provider` for where the options of variable need to be retrieved from.
    - Provide `Type`. It can be `Attribute`, `Dimension`, or `Measure`.
    - Provide `Values of` if `Type` is `Attribute` or any other types that requires this field which only appears when needed.

So far you should be able to see possible options in `Preview of values` section.

For further flexibility, you can use `Multi-value` and/or `Include All option` in `Selection Options` section. The names are self-describing.

To use it in the query, type in the name of variable preceeding with `$` into the needed fields, for example: `$dimension`.

![Query Configuration - Query Variables](../../assets/Variable%20Usage.png?raw=true)

Now to can select variable in dashboard to see the effects.
