---
id: configuration
title: Configuration
sidebar_position: 5
---

## Registering with unixODBC

### Automatic

```bash
sudo bash scripts/install_dsn.sh
```

(The `.deb` package registers the driver for you.)

### Manual

Add to `/etc/odbcinst.ini`:

```ini
[Argus]
Description = Argus ODBC Driver
Driver = /usr/local/lib/libargus_odbc.so
Setup = /usr/local/lib/libargus_odbc.so
```

Add a DSN to `/etc/odbc.ini` or `~/.odbc.ini`:

```ini
[ArgusHive]
Description = Hive via Argus
Driver = Argus
HOST = localhost
PORT = 10000
UID = hive
PWD =
DATABASE = default
AUTHMECH = NOSASL
BACKEND = hive
```

## Registering on Windows

The NSIS installer registers `Argus ODBC Driver` under `HKLM\SOFTWARE\ODBC\ODBCINST.INI` and bundles its DLLs. The driver reads DSNs from the registry: `HKCU\SOFTWARE\ODBC\ODBC.INI\<dsn>` first (user DSNs), then `HKLM` (system DSNs).

The driver setup has no configuration dialog, so create DSNs from PowerShell:

```powershell
Add-OdbcDsn -Name MyTrino -DriverName "Argus ODBC Driver" -DsnType User -Platform 64-bit `
    -SetPropertyValue @("BACKEND=trino", "HOST=trino.example.com", "PORT=8443", "SSL=1")

Remove-OdbcDsn -Name MyTrino -DsnType User -Platform 64-bit
```

:::caution
The Windows ODBC Manager rejects `UID`/`PWD` in a DSN's `-SetPropertyValue`. Supply credentials at connect time (the application's user/password fields) or in a DSN-less connection string instead.
:::

DSN-less connection strings (`DRIVER={Argus ODBC Driver};...`) need no DSN at all.

## Connection string parameters

| Parameter | Aliases | Default | Description |
|-----------|---------|---------|-------------|
| HOST | SERVER | localhost | Server hostname or IP |
| PORT | | Per backend | Server port |
| UID | USERNAME, USER | (empty) | Username |
| PWD | PASSWORD | (empty) | Password (or token, for `JWT`/`BEARER`/`DATABRICKS`) |
| DATABASE | SCHEMA | default | Initial database/catalog |
| BACKEND | DRIVER_TYPE | hive | `hive`, `impala`, `trino`, `phoenix`, `pinot`, `druid`, `bigquery`, `mysql`, `flightsql`, `kudu` |
| AUTHMECH | AUTH | NOSASL | Authentication mechanism (see below) |
| KRBSERVICENAME | SERVICEPRINCIPALNAME | hive/impala | Kerberos SPN service name |
| KRBHOSTFQDN | KRBHOST | (HOST) | Kerberos SPN host, if it differs from HOST |
| KRBREALM | REALM | (from krb5.conf) | Explicit Kerberos realm |
| TransportMode | | BINARY | Hive/Impala transport: `BINARY` or `HTTP` |
| HTTPPath | | - | HTTP transport path (e.g. Databricks `/sql/1.0/warehouses/<id>`) |
| OAuth2TokenEndpoint | TokenURI | - | OAuth2 token endpoint (Trino) |
| OAuth2AuthEndpoint | AuthURI | - | OAuth2 authorization endpoint (`AUTH_CODE`) |
| OAuth2DeviceEndpoint | DeviceAuthURI | - | OAuth2 device-authorization endpoint (`DEVICE_CODE`) |
| OAuth2Issuer | Issuer | - | OIDC issuer — endpoints discovered via `/.well-known/openid-configuration` |
| ClientId / ClientSecret / Scope | | - | OAuth2 client parameters |
| SSL | UseSSL | false | Enable SSL/TLS |
| SSLCertFile | | - | Client certificate path (mutual TLS) |
| SSLKeyFile | | - | Client key path |
| SSLCAFile | | - | CA certificate path |
| SSLVerify | | true | Verify server certificate |
| LogLevel | | 0 | Log level (0=OFF to 6=TRACE) |
| LogFile | | stderr | Log file path |
| ConnectTimeout | | 0 | Connection timeout in seconds |
| QueryTimeout | | 0 | Query timeout in seconds |
| SocketTimeout | | 0 | Socket timeout in seconds |
| RetryCount | | 0 | Retry attempts on connect failure |
| RetryDelay | | 2 | Delay between retries in seconds |
| ApplicationName | AppName | - | Application identifier for query tracking |
| FetchBufferSize | | 1000 | Rows per fetch batch |
| TrinoProtocol | TRINO_PROTOCOL | v1 | Trino protocol version: `v1` (classic) or `v2` (spooling) |

BigQuery has its own parameter set (`Project`, `BQEndpoint`, `BQKeyFile`, ...) — see [Google BigQuery](#google-bigquery-backendbigquery) below.

### Default ports by backend

| Backend | Default Port | Note |
|---------|-------------|------|
| hive | 10000 | |
| impala | 21050 | |
| trino | 8080 | |
| phoenix | 8765 | |
| pinot | 8000 | broker; table listing uses the controller on `:9000` |
| druid | 8888 | router; the broker is 8082 |
| bigquery | — | REST service, no host/port |
| mysql | 3306 | **set PORT explicitly**: StarRocks/Doris FE `9030`, ClickHouse `9004` |
| flightsql | 32010 | Dremio; InfluxDB 3 is `8181` |
| kudu | 7051 | deprecated |

### Authentication mechanisms

| `AUTHMECH` value | Backends | Description |
|-------|----------|-------------|
| NOSASL | hive, impala | No authentication (development/testing) |
| PLAIN / LDAP | hive, impala, trino | Username/password (SASL PLAIN for Thrift; HTTP Basic for Trino, requires `SSL=1`) |
| KERBEROS / GSSAPI | hive, impala, trino | Kerberos — system GSSAPI on Linux/macOS, **native SSPI on Windows** (no MIT Kerberos install). Trino uses SPNEGO/Negotiate |
| JWT / BEARER / DATABRICKS / TOKEN | hive (HTTP), trino | Bearer token taken from `PWD` |
| OAUTH2 / CLIENT_CREDENTIALS | trino | Machine-to-machine OAuth2; token auto-refreshed on `401` |
| DEVICE_CODE / DEVICE | trino | OAuth2 device authorization grant (RFC 8628), for headless logins |
| AUTH_CODE / BROWSER / SSO | trino | OAuth2 authorization code + PKCE, browser + loopback redirect |

See [Security](./security.md) for the details of each flow.

## Backend-specific notes

### Hive (BACKEND=hive)

```
DRIVER=Argus;BACKEND=hive;HOST=hive.example.com;PORT=10000;UID=hive;DATABASE=default;AUTHMECH=NOSASL
```

- Protocol: Thrift TCLIService (binary, protocol V10) or HTTP (`TransportMode=HTTP`)
- Database set via `use:database` config in OpenSession
- **Authentication**: `NOSASL` (default), `PLAIN`/`LDAP`, `KERBEROS`/`GSSAPI` (SPN defaults to `hive/<host>`; override with `KrbServiceName`, `KrbHostFQDN`, `KrbRealm`). Over HTTP transport, `KERBEROS` uses SPNEGO and `JWT`/`BEARER`/`DATABRICKS` send a token from `PWD`

#### Spark and Flink

Apache Spark (Thrift Server) and Apache Flink (SQL Gateway `hiveserver2` endpoint) speak the HiveServer2 protocol — use `BACKEND=hive`:

```
DRIVER=Argus;BACKEND=hive;HOST=spark-thrift;PORT=10000;UID=spark;AuthMech=NOSASL
DRIVER=Argus;BACKEND=hive;HOST=flink-gateway;PORT=10000;UID=flink;AuthMech=NOSASL
```

(Spark Connect is a gRPC DataFrame API, not a SQL wire protocol — use the Thrift Server.)

#### Databricks

Databricks SQL warehouses speak HiveServer2 over HTTP with a bearer token (personal access token or OAuth token):

```
DRIVER=Argus;BACKEND=hive;HOST=<workspace>.cloud.databricks.com;PORT=443;SSL=1;TransportMode=HTTP;HTTPPath=/sql/1.0/warehouses/<id>;AuthMech=DATABRICKS;PWD={dapi...}
```

The same bearer-over-HTTP path covers any token-gated HiveServer2/Spark endpoint (e.g. behind Apache Knox with a JWT).

### Impala (BACKEND=impala)

- Protocol: Thrift TCLIService (binary), protocol V6
- Database set via `USE <db>` statement after connect
- **Authentication**: same as Hive — `NOSASL`, `PLAIN`/`LDAP`, `KERBEROS`/`GSSAPI` (SPN defaults to `impala/<host>`)

### Trino (BACKEND=trino)

- Protocol: HTTP REST API (JSON)
- DATABASE maps to Trino catalog via `X-Trino-Catalog` header
- Catalog operations via `information_schema` queries
- **v1 (default)**: Classic protocol — data is returned as flat JSON arrays in the response body
- **v2 (spooling)**: Requires Trino 466+. Data may be returned as spooled segments (inline base64 or external URIs). Enable with `TrinoProtocol=v2`. The driver automatically handles both inline and spooled segments, including fetching external data and acknowledging consumed segments
- **Authentication**: `LDAP`/`PLAIN` (HTTP Basic, requires `SSL=1`), `JWT`/`BEARER`, `KERBEROS` (SPNEGO), and the OAuth2 flows (`OAUTH2`, `DEVICE_CODE`, `AUTH_CODE`) with OIDC discovery via `OAuth2Issuer`

```
DRIVER=Argus;BACKEND=trino;HOST=trino;PORT=8443;SSL=1;AuthMech=OAUTH2;OAuth2TokenEndpoint=https://idp/token;ClientId=cid;ClientSecret=csec;Scope=trino
```

### Phoenix (BACKEND=phoenix)

- Protocol: Avatica HTTP/JSON via Phoenix Query Server (PQS)
- DATABASE maps to the Phoenix/HBase schema
- Catalog operations via Avatica RPCs (`getTables`, `getColumns`, `getSchemas`, `getCatalogs`, `getTypeInfo`)
- Requires Phoenix Query Server running on the target host

### Apache Pinot (BACKEND=pinot)

Real-time OLAP datastore. Argus queries the Pinot **broker**'s synchronous SQL endpoint (`POST /query/sql`) and lists tables from the **controller** (`/tables`, port 9000 on the same host).

```
DRIVER=Argus;BACKEND=pinot;HOST=pinot-broker;PORT=8000
```

- The whole result arrives in one response
- Optional HTTP Basic auth via `UID`/`PWD`; `SSL=1` for HTTPS
- Query errors surface the real Pinot message

### Apache Druid (BACKEND=druid)

Real-time analytics database. Argus queries the broker/router's synchronous SQL endpoint (`POST /druid/v2/sql`, `resultFormat=array`) and uses Druid's `INFORMATION_SCHEMA` for catalog operations.

```
DRIVER=Argus;BACKEND=druid;HOST=druid-router;PORT=8888
```

- Optional HTTP Basic auth (`UID`/`PWD`); `SSL=1` for HTTPS
- Query errors surface the real Druid `errorMessage`

### Google BigQuery (BACKEND=bigquery)

REST API (`bigquery/v2`). **Every Google URL is configurable**, so the driver works unchanged on sovereign-cloud deployments — e.g. S3NS, the trusted-cloud GCP offer operated by Thales — and against the BigQuery emulator.

| Parameter | Description | Default |
|-----------|-------------|---------|
| `Project` / `BQProject` | GCP project id (**required**) | - |
| `Database` / `Schema` | Default dataset | - |
| `BQLocation` | Job location (`EU`, `europe-west9`, ...) | - |
| `BQEndpoint` | API base URL | `https://bigquery.googleapis.com` |
| `BQTokenEndpoint` | OAuth2 token endpoint | `https://oauth2.googleapis.com/token` or the key file's `token_uri` |
| `BQAudience` | JWT `aud` claim | the token endpoint |
| `BQScope` | OAuth2 scope | `https://www.googleapis.com/auth/bigquery` |
| `BQKeyFile` | Service-account JSON key path (RS256 JWT-bearer grant; needs OpenSSL) | - |
| `AccessToken` | Pre-fetched bearer token (skips the token flow) | - |

Public GCP with a service-account key:

```
Backend=bigquery;Project=my-project;Database=my_dataset;BQKeyFile=/etc/argus/sa-key.json;BQLocation=EU
```

Sovereign cloud (custom API + IAM endpoints, audience, private CA — `SSLCAFile` is honoured for **both** the API and the token endpoint):

```
Backend=bigquery;Project=my-project;
BQEndpoint=https://bigquery.s3ns.example;
BQTokenEndpoint=https://iam.s3ns.example/token;
BQAudience=https://iam.s3ns.example/token;
BQKeyFile=/etc/argus/sa-key.json;
SSL=1;SSLVerify=1;SSLCAFile=/etc/argus/s3ns-ca.pem
```

For mutual TLS, add `SSLCertFile=` / `SSLKeyFile=`. Emulator/tests (no auth): `Backend=bigquery;Project=test;BQEndpoint=http://localhost:9050`.

### MySQL-wire (BACKEND=mysql)

A single backend serves every engine that speaks the MySQL client/server protocol, via libmariadb: **StarRocks**, **Apache Doris**, **ClickHouse** (MySQL interface), and MySQL/MariaDB themselves.

```
DRIVER=Argus;BACKEND=mysql;HOST=starrocks-fe;PORT=9030;UID=root;DATABASE=analytics
DRIVER=Argus;BACKEND=mysql;HOST=clickhouse;PORT=9004;UID=default;DATABASE=default
```

- A database is reported as an ODBC **catalog** (`TABLE_CAT`); the schema column is left empty, following the MySQL Connector/ODBC convention
- Catalog operations run against `information_schema`
- `SSL=1` enables TLS (`SSLCertFile`/`SSLKeyFile`/`SSLCAFile`, `SSLVerify` honored)

### Arrow Flight SQL (BACKEND=flightsql)

Reaches any engine exposing an Arrow Flight SQL endpoint — **Dremio**, **InfluxDB 3** — over gRPC.

```
DRIVER=Argus;BACKEND=flightsql;HOST=dremio;PORT=32010;UID=user;PWD={secret}
DRIVER=Argus;BACKEND=flightsql;HOST=influxdb3;PORT=443;SSL=1;PWD={token}
```

- Record batches are **streamed** lazily (one block per fetch, bounded memory); numeric columns are kept as native typed values
- `DATABASE` is sent as the gRPC `database` call header (how InfluxDB 3 selects the target database)
- Auth: `UID`+`PWD` → Flight handshake (basic token); `PWD` alone → `Bearer` token (JWT)
- `SSL=1` uses a TLS gRPC channel

### Apache Kudu (BACKEND=kudu) — deprecated

:::caution Deprecated — use the Impala backend instead
Kudu is normally queried through Impala (which plans and executes SQL against Kudu tables natively), and `libkudu_client` is not packaged for any Ubuntu newer than 16.04. The `kudu` backend still builds where the client library is available, but is in maintenance mode.

```
DRIVER=Argus;BACKEND=impala;HOST=impalad;PORT=21050;DATABASE=default
```
:::

If used directly: HOST points to the Kudu master; only `SELECT` is supported through a minimal SQL parser (`SELECT ... FROM ... WHERE ... LIMIT`; operators `=`, `<`, `>`, `<=`, `>=`, `!=`, `IN`, `IS [NOT] NULL`). `JOIN`, `GROUP BY`, `ORDER BY`, subqueries and DML are not supported.

## Parameter priority

When the same parameter is specified multiple ways:

1. Connection string (highest)
2. DSN configuration
3. Environment variable
4. Default value (lowest)

## Environment variables

```bash
export ARGUS_LOG_LEVEL=5    # Log level
export ARGUS_LOG_FILE=/tmp/argus.log  # Log file
```
