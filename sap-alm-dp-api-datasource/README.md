# Grafana Data Source Plugin for SAP ALM

This Grafana data source plugin executes requests for analytical data from SAP ALM destinations including SAP Cloud ALM and SAP Focused RUN by using Data Providers API REST service, and parses JSON result to Grafana data frame.

## What is Grafana Data Source Plugin?
Grafana supports a wide range of data sources, including Prometheus, MySQL, and even Datadog. There’s a good chance you can already visualize metrics from the systems you have set up. In some cases, though, you already have an in-house metrics solution that you’d like to add to your Grafana dashboards. Grafana Data Source Plugins enables integrating such solutions with Grafana.

## Compatibilties

- SAP Cloud ALM (CALM) Analytics API.
- SAP Focused RUN (FRUN) FP03 SP02 or later. (under development)

## Contents

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

--> Image for data providers

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
    - `Table`: data is returned in table format for recent period (today) disregard requested period.
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

To use it in query, type in the name of variable preceeding with `$` into the needed fields, for example: `$dimension`.

![Query Configuration - Query Variables](../../assets/Variable%20Usage.png?raw=true)

Now to can select variable in dashboard to see the effects.