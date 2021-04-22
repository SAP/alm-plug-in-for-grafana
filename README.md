# ALM plug-in for Grafana

- [Introduction](#heading)
  * [Sub-heading](#sub-heading)
    + [Sub-sub-heading](#sub-sub-heading)
- [Installation](#heading-1)
  * [Sub-heading](#sub-heading-1)
    + [Sub-sub-heading](#sub-sub-heading-1)


## Introduction
The ALM plug-in for Grafana (alm-plug-in-for-grafana) lets you extend your analytics solutions for application life-cycle management 

This plugin is based on the SAP Cloud ALM Analytics API documented here: https://api.sap.com/api/CALM_ANALYTICS/overview. 
This API enables you to build dashboards and reports aggregating all types of data managed by SAP Cloud ALM. It comes with OData and Rest endpoints exposing analytics data.

With the SAP ALM Plugin for Rest interface you are able to connect your **SAP Cloud ALM tenants**. and get data in Table format or Time-series format to get new insights on your different ALM processes.

The goals of the SAP Cloud ALM Analytics API are:

- Access SAP Cloud ALM analytics through a generic single-entry point.
- Mix analytics data from all SAP Cloud ALM components (use-cases) via standard API.
- Access time series as well as table data through the same interface.
- Consume SAP Cloud ALM analytics from SAP Analytics Cloud or from an OData consumer without coding.
- Consume SAP Cloud ALM analytics from third-party frontend applications


The SAP Cloud ALM Analytics API relies on the following concepts:

- **Providers**: Data providers are analytics data sources corresponding to the different objects or scenarios managed in SAP Cloud ALM. They could be Tasks, Projects, Alerts, Integration Monitoring, ..
- **Dimensions**: The Dimensions are the characteristics of SAP Cloud ALM entities. The Dimensions correspond to the different fields of the CALM entities. (ex: Name of Projects, Phase Status for CALM tasks).
- **Metrics**: Metrics are the quantitative measurements of SAP Cloud ALM analytics data sources. (ex: total number of tasks, average response time, ...). Different optional aggregation methods can be supported for each metrics (ex: avg, sum, max, min, Last, ....)
Output Format

The CALM analytics API supports 2 output formats:

Series:
- **Time series**: A series of data points indexed in time order.
- **Categorical value series**: The values of measures are represented on the y-axis, while dimensions provide the axis of the chart.

Table: 
- **Row-column** structured data format representing SAP Cloud ALM dimensions in columns.


**Time Dimensions**

ALM analytics are constructed on a time dimension containing two attributes:

- **period**: The duration of the measurements (Ex: Today, Last 6 Months, ..). This is in general a dynamic rolling-time dimension.
- **resolution**: The scale of the data points. (Ex: hour, Month,..)

**Queries**

Queries are the central mechanism of the SAP Cloud ALM Anlaytics API to format and retrieve data from SAP Cloud ALM.  A query is responsible to return either a set of measures (series) or a row-column structured data format (table) for a specific data provider and a given period based on filters and columns identified by selected dimensions of the data sources.



