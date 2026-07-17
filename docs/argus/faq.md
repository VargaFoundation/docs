---
id: faq
title: FAQ
sidebar_position: 12
---

- **Which ODBC driver manager is supported?** unixODBC on Linux/macOS (driver v0.5.8+), Windows ODBC Driver Manager on Windows.
- **Can I use Argus with Power BI?** Yes. Generic ODBC works in Import mode, and the packaged **Argus custom connector** (`Argus.mez`/`.pqx`) additionally unlocks top-N query folding and DirectQuery. See [BI tools](./bi-tools.md#power-bi).
- **Can I use Argus with Tableau?** Yes. Packaged `.taco` connectors exist for Trino, Hive (also Spark/Flink), Impala, StarRocks/Doris and BigQuery; other backends work through Tableau's generic ODBC entry. See [BI tools](./bi-tools.md#tableau).
- **Can I use Argus with Excel / Qlik / Alteryx / SAS?** Yes, through generic ODBC with a DSN. The driver translates the ODBC escape sequences (`{fn ...}`, `{ts ...}`, `{oj ...}`) these tools emit, per backend dialect.
- **Does Argus support Kerberos?** Yes. Hive and Impala authenticate with `AuthMech=KERBEROS` — system GSSAPI on Linux/macOS (a `kinit` ticket or keytab), **native SSPI on Windows** (the logged-in domain user, no MIT Kerberos install). Trino uses SPNEGO/Negotiate. The Kudu backend uses Kerberos natively via its C++ client.
- **Does Argus support OAuth2 / SSO?** Yes, for Trino: client credentials, device code (RFC 8628), and authorization code with PKCE + browser SSO, with OIDC discovery (`OAuth2Issuer`). See [Security](./security.md#oauth2-trino).
- **Can I connect to Databricks?** Yes — Databricks SQL warehouses speak HiveServer2 over HTTP: `BACKEND=hive;TransportMode=HTTP;HTTPPath=/sql/1.0/warehouses/<id>;AuthMech=DATABRICKS` with the personal access token in `PWD`.
- **Can I connect to Spark or Flink?** Yes — Spark Thrift Server and Flink SQL Gateway speak the HiveServer2 protocol: use `BACKEND=hive`.
- **Can I connect to StarRocks, Doris or ClickHouse?** Yes — they speak the MySQL wire protocol: use `BACKEND=mysql` (StarRocks/Doris FE port `9030`, ClickHouse `9004`).
- **What is ADBC and does Argus support it?** Arrow ADBC is a columnar database API. Argus ships `libargus_adbc` over the same backends, returning results as Arrow C Data Interface streams. See [ADBC](./adbc.md). The Power BI/Fabric ADBC transition does not affect Argus's ODBC path (it only retires drivers Microsoft embeds).
- **Do I need all backends installed?** No. Dependencies are optional per backend and auto-detected at build time. Install only the libraries for backends you use.
- **How are complex types handled?** ARRAY, MAP, and STRUCT are serialized as JSON strings via SQL_VARCHAR.
- **Can I use Argus with connection pooling?** Yes. The driver is designed to be connection-pooling ready.
- **What is the default fetch batch size?** 1000 rows. Configurable via `FetchBufferSize`. Block fetch (`SQL_ATTR_ROW_ARRAY_SIZE` + `SQLFetchScroll`) and static scrollable cursors are supported.
- **Does Argus support prepared statements?** SQLPrepare is implemented and dispatches to the backend's execute function; `SQLBindParameter` binds `?` markers.
- **Does Argus support `{call ...}` (stored procedures)?** No — procedure escapes are rejected with `HYC00`, consistent with `SQLProcedures` returning an empty result set.
- **Why does Argus refuse a `{fn ...}` my tool generated?** The backend's dialect has no rendering for that function, so the driver rejects it with `42000` and the function's name instead of forwarding SQL that would fail (or silently mean something else) server-side. If the server actually supports the function, that is a dialect-table bug — please report it.
- **What is Phoenix Query Server?** Phoenix Query Server (PQS) is a standalone server that provides remote access to Apache Phoenix via the Avatica protocol over HTTP/JSON. The Argus Phoenix backend connects to PQS, not directly to HBase — and requires it.
- **What is the difference between Trino v1 and v2 protocol?** v1 (default) returns data as flat JSON arrays inline in the REST response. v2 (spooling, Trino 466+) can offload large result sets to external storage and return them as segments. Use `TrinoProtocol=v2` to enable spooling; the driver handles both formats transparently, including mixed responses.
- **When should I use Trino v2 spooling?** For large result sets on Trino 466+: spooling reduces coordinator memory pressure. For small queries or older Trino versions, v1 is sufficient.
- **Should I use the Kudu backend?** No — it is **deprecated**. Query Kudu tables through Impala (`BACKEND=impala`), which plans and executes SQL against Kudu natively. The direct backend remains read-only `SELECT` with a minimal SQL parser and only builds where `libkudu_client` is available.
