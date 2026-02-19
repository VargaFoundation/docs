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

### Kudu

```
HOST=kudu-master;PORT=7051;DATABASE=default;BACKEND=kudu
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

### Phoenix with timeout

```
HOST=pqs.example.com;PORT=8765;UID=admin;
DATABASE=myschema;BACKEND=phoenix;
ConnectTimeout=30;QueryTimeout=300;
LogLevel=4;LogFile=/var/log/argus-phoenix.log;
ApplicationName=HBase-Analytics
```

### Kudu with query timeout

```
HOST=kudu-master.example.com;PORT=7051;
DATABASE=production;BACKEND=kudu;
ConnectTimeout=15;QueryTimeout=120;
LogLevel=4;LogFile=/var/log/argus-kudu.log;
ApplicationName=Kudu-Scanner
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

### Query cancellation

```c
// Execute in background thread
SQLExecDirect(stmt, (SQLCHAR*)"SELECT * FROM huge_table", SQL_NTS);

// Cancel from another thread
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

### Impala DSN

```ini
[ArgusImpala]
Driver = Argus
HOST = impala-host
PORT = 21050
UID = impala
DATABASE = default
BACKEND = impala
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

### Phoenix DSN

```ini
[ArgusPhoenix]
Driver = Argus
HOST = phoenix-qs
PORT = 8765
UID = admin
DATABASE = myschema
BACKEND = phoenix
```

### Kudu DSN

```ini
[ArgusKudu]
Driver = Argus
HOST = kudu-master
PORT = 7051
DATABASE = default
BACKEND = kudu
```

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
