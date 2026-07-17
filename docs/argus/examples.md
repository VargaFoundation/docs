---
id: examples
title: Examples
sidebar_position: 7
---

## DSN connections (SQLConnect)

```c
SQLConnect(dbc, "ArgusHive", SQL_NTS, "hive", SQL_NTS, "", SQL_NTS);
```

## DSN-less connections (SQLDriverConnect)

### Hive

```
HOST=hive-server;PORT=10000;UID=admin;PWD=secret;DATABASE=mydb;BACKEND=hive
```

### Impala

```
HOST=impala-server;PORT=21050;UID=admin;PWD=secret;DATABASE=mydb;BACKEND=impala
```

### Trino

```
HOST=trino-server;PORT=8080;UID=admin;DATABASE=hive;BACKEND=trino
```

### Phoenix

```
HOST=phoenix-server;PORT=8765;UID=admin;DATABASE=myschema;BACKEND=phoenix
```

### Pinot

```
HOST=pinot-broker;PORT=8000;BACKEND=pinot
```

### Druid

```
HOST=druid-router;PORT=8888;BACKEND=druid
```

### BigQuery

```
BACKEND=bigquery;Project=my-project;Database=my_dataset;BQKeyFile=/etc/argus/sa-key.json;BQLocation=EU
```

### StarRocks / Doris / ClickHouse (MySQL-wire)

```
HOST=starrocks-fe;PORT=9030;UID=root;DATABASE=analytics;BACKEND=mysql
HOST=doris-fe;PORT=9030;UID=admin;PWD=secret;DATABASE=ods;BACKEND=mysql
HOST=clickhouse;PORT=9004;UID=default;DATABASE=default;BACKEND=mysql
```

### Dremio / InfluxDB 3 (Flight SQL)

```
HOST=dremio;PORT=32010;UID=user;PWD=secret;BACKEND=flightsql
HOST=influxdb3;PORT=443;SSL=1;PWD=token;DATABASE=mydb;BACKEND=flightsql
```

### Spark Thrift Server / Flink SQL Gateway (via the Hive backend)

```
HOST=spark-thrift;PORT=10000;UID=spark;AUTHMECH=NOSASL;BACKEND=hive
HOST=flink-gateway;PORT=10000;UID=flink;AUTHMECH=NOSASL;BACKEND=hive
```

## Authentication examples

### Hive with Kerberos

Linux/macOS use the system GSSAPI (`kinit` ticket or keytab); Windows uses the logged-in domain user via SSPI.

```
HOST=hive.example.com;PORT=10000;BACKEND=hive;
AUTHMECH=KERBEROS;KrbServiceName=hive;
SSL=1;SSLCAFile=/etc/ssl/certs/ca-bundle.crt
```

### Databricks SQL warehouse (personal access token)

```
HOST=<workspace>.cloud.databricks.com;PORT=443;SSL=1;BACKEND=hive;
TransportMode=HTTP;HTTPPath=/sql/1.0/warehouses/<id>;
AUTHMECH=DATABRICKS;PWD=dapi...
```

### Trino with LDAP (HTTP Basic over TLS)

```
HOST=trino.example.com;PORT=8443;SSL=1;BACKEND=trino;
UID=analyst;PWD=secret;AUTHMECH=LDAP
```

### Trino with OAuth2 client credentials

```
HOST=trino.example.com;PORT=8443;SSL=1;BACKEND=trino;
AUTHMECH=OAUTH2;OAuth2Issuer=https://idp.example.com;
ClientId=svc-trino;ClientSecret=***;Scope=trino
```

### Trino with browser SSO (authorization code + PKCE)

```
HOST=trino.example.com;PORT=8443;SSL=1;BACKEND=trino;
AUTHMECH=SSO;OAuth2Issuer=https://idp.example.com;ClientId=trino-desktop
```

## Production configurations

### Hive with SSL and logging

```
HOST=hive.example.com;PORT=10000;UID=admin;PWD=secret;
SSL=1;SSLCAFile=/etc/ssl/certs/ca-bundle.crt;SSLVerify=1;
LogLevel=4;LogFile=/var/log/argus-hive.log;
BACKEND=hive;ApplicationName=ETL-Pipeline
```

### Impala with retry and timeout

```
HOST=impala.example.com;PORT=21050;UID=admin;PWD=secret;
DATABASE=warehouse;BACKEND=impala;
RetryCount=3;RetryDelay=2;
ConnectTimeout=30;QueryTimeout=600;SocketTimeout=120;
FetchBufferSize=5000;ApplicationName=Analytics
```

### Trino with HTTPS and mutual TLS

```
HOST=trino.example.com;PORT=8443;UID=admin;PWD=secret;
SSL=1;SSLVerify=1;
SSLCertFile=/etc/ssl/certs/client-cert.pem;
SSLKeyFile=/etc/ssl/private/client-key.pem;
SSLCAFile=/etc/ssl/certs/trino-ca.pem;
BACKEND=trino;LogLevel=5;ApplicationName=Dashboard
```

### Trino with v2 spooling protocol

```
HOST=trino.example.com;PORT=8443;UID=admin;
SSL=1;SSLVerify=1;SSLCAFile=/etc/ssl/certs/trino-ca.pem;
BACKEND=trino;TrinoProtocol=v2;ApplicationName=DataPipeline
```

### BigQuery on a sovereign cloud (S3NS-style)

```
BACKEND=bigquery;Project=my-project;
BQEndpoint=https://bigquery.s3ns.example;
BQTokenEndpoint=https://iam.s3ns.example/token;
BQAudience=https://iam.s3ns.example/token;
BQKeyFile=/etc/argus/sa-key.json;
SSL=1;SSLVerify=1;SSLCAFile=/etc/argus/s3ns-ca.pem
```

### Phoenix with timeout

```
HOST=pqs.example.com;PORT=8765;UID=admin;
DATABASE=myschema;BACKEND=phoenix;
ConnectTimeout=30;QueryTimeout=300;
LogLevel=4;LogFile=/var/log/argus-phoenix.log;
ApplicationName=HBase-Analytics
```

## C/C++ usage

### Connect and query

```c
SQLHENV env;
SQLHDBC dbc;
SQLHSTMT stmt;

SQLAllocHandle(SQL_HANDLE_ENV, SQL_NULL_HANDLE, &env);
SQLSetEnvAttr(env, SQL_ATTR_ODBC_VERSION, (void*)SQL_OV_ODBC3, 0);
SQLAllocHandle(SQL_HANDLE_DBC, env, &dbc);

const char *conn_str =
    "HOST=hive-server;PORT=10000;UID=admin;PWD=secret;"
    "DATABASE=mydb;BACKEND=hive;LogLevel=5";

SQLDriverConnect(dbc, NULL, (SQLCHAR*)conn_str, SQL_NTS,
                 NULL, 0, NULL, SQL_DRIVER_NOPROMPT);

SQLAllocHandle(SQL_HANDLE_STMT, dbc, &stmt);
SQLExecDirect(stmt, (SQLCHAR*)"SELECT * FROM my_table", SQL_NTS);

SQLCHAR col1[256];
SQLLEN ind;
SQLBindCol(stmt, 1, SQL_C_CHAR, col1, sizeof(col1), &ind);

while (SQLFetch(stmt) == SQL_SUCCESS) {
    printf("%s\n", col1);
}

SQLFreeHandle(SQL_HANDLE_STMT, stmt);
SQLDisconnect(dbc);
SQLFreeHandle(SQL_HANDLE_DBC, dbc);
SQLFreeHandle(SQL_HANDLE_ENV, env);
```

### Block fetch (rowsets)

```c
#define ROWS 100
SQLCHAR names[ROWS][64];
SQLLEN inds[ROWS];
SQLULEN fetched = 0;

SQLSetStmtAttr(stmt, SQL_ATTR_ROW_ARRAY_SIZE, (SQLPOINTER)ROWS, 0);
SQLSetStmtAttr(stmt, SQL_ATTR_ROWS_FETCHED_PTR, &fetched, 0);
SQLBindCol(stmt, 1, SQL_C_CHAR, names, 64, inds);

while (SQLFetchScroll(stmt, SQL_FETCH_NEXT, 0) == SQL_SUCCESS) {
    for (SQLULEN i = 0; i < fetched; i++)
        printf("%s\n", names[i]);
}
```

### Query cancellation

```c
/* Execute in background thread */
SQLExecDirect(stmt, (SQLCHAR*)"SELECT * FROM huge_table", SQL_NTS);

/* Cancel from another thread */
SQLCancel(stmt);
```

## DSN configuration examples

### Hive DSN

```ini
[ArgusHive]
Driver = Argus
HOST = localhost
PORT = 10000
UID = hive
DATABASE = default
AUTHMECH = NOSASL
BACKEND = hive
```

### Trino DSN

```ini
[ArgusTrino]
Driver = Argus
HOST = trino-coordinator
PORT = 8080
UID = analyst
DATABASE = hive
BACKEND = trino
```

### StarRocks DSN

```ini
[ArgusStarRocks]
Driver = Argus
HOST = starrocks-fe
PORT = 9030
UID = root
DATABASE = analytics
BACKEND = mysql
```

### Windows DSN (PowerShell)

```powershell
Add-OdbcDsn -Name MyTrino -DriverName "Argus ODBC Driver" -DsnType User -Platform 64-bit `
    -SetPropertyValue @("BACKEND=trino", "HOST=trino.example.com", "PORT=8443", "SSL=1")
```

(`UID`/`PWD` cannot be set in DSN properties on Windows — supply them at connect time.)

## Testing with isql

```bash
isql -v ArgusHive

# SQL> SELECT 1;
```

## Cloud environments

### AWS EMR Hive

```
HOST=ec2-xx-xx-xx-xx.compute.amazonaws.com;PORT=10000;
UID=hadoop;DATABASE=default;BACKEND=hive;
ConnectTimeout=20;RetryCount=3;ApplicationName=AWS-ETL
```

### Kubernetes

```
HOST=trino-service.default.svc.cluster.local;PORT=8080;
UID=admin;BACKEND=trino;
ConnectTimeout=15;QueryTimeout=300;ApplicationName=K8s-App
```
