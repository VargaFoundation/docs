---
id: bi-tools
title: BI tools
sidebar_position: 8
---

Which BI tools can reach Argus, what each one needs, and what Argus ships for it.

## The short version

Most BI tools need **nothing but the driver and a DSN**. Only two justify a packaged connector: Power BI (because generic ODBC cannot fold `LIMIT`/`TOP`) and Tableau (because a named connector fixes the SQL dialect and can be published). Everything else either speaks generic ODBC — in which case a correct driver is the whole answer — or does not speak ODBC at all.

| Tool | Speaks | Argus artifact | Status |
|---|---|---|---|
| Power BI Desktop / Service | ODBC via a custom connector | `Argus.mez` / `Argus.pqx` | shipped with each [release](https://github.com/VargaFoundation/argus/releases) |
| Tableau Desktop / Server | ODBC via a `.taco`, or generic ODBC | `argus-{trino,hive,impala,mysql,bigquery}.taco` | shipped |
| Tableau Cloud | ODBC **through Tableau Bridge only** | `.taco` + Bridge | limited — see below |
| Excel (Windows / Mac) | generic ODBC only | none possible | driver only |
| Qlik Sense (Windows) / QlikView | ODBC Connector Package | none needed | driver only |
| Qlik Sense SaaS | no ODBC | — | out of scope |
| Alteryx / MicroStrategy / SSIS / SSRS / SAS | generic ODBC | none needed | driver only |
| KNIME / Dataiku / Spotfire | ODBC or JDBC | none needed | driver only, via ODBC |
| DBeaver | JDBC only | — | out of scope |
| Apache Superset | SQLAlchemy | — | separate project |
| Metabase | JDBC driver plugin | — | separate project |
| Looker / Looker Studio / Amazon QuickSight | managed, no local driver | — | out of scope |

## Escape sequences: why generic ODBC works

Tableau, Excel, Qlik and Alteryx read the driver's `SQLGetInfo` capability bitmaps and then emit ODBC escape sequences — `{fn UCASE(x)}`, `{ts '...'}`, `{oj ...}`. The driver translates them into each backend's grammar:

- **Translated**: `{fn ...}` (scalar functions), `{d ...}` / `{t ...}` / `{ts ...}` (date/time/timestamp literals), `{escape ...}` (LIKE escape), `{oj ...}` (outer joins), `{interval ...}`.
- **Rejected with `HYC00`**: `{call ...}` — Argus exposes no procedures, consistent with `SQLProcedures` returning an empty set.
- **Rejected with `42000`** (naming the function): an escape the backend's dialect cannot render. It is never forwarded — `SQLGetInfo` never advertised it, and a clear driver error beats an opaque server syntax error.

The scalar-function bitmaps in `SQLGetInfo` (`SQL_STRING_FUNCTIONS`, `SQL_NUMERIC_FUNCTIONS`, `SQL_TIMEDATE_FUNCTIONS`, `SQL_SYSTEM_FUNCTIONS`) are **derived from the same per-backend dialect table** that drives the translator, so the driver cannot advertise a function it has no rendering for. Read the driver's answer via `SQLGetInfo` rather than trusting a table in a document.

The same dialect table drives `SQL_IDENTIFIER_QUOTE_CHAR`: ANSI double-quote for Trino/Phoenix/Pinot/Druid, backtick for Hive/Impala/MySQL-wire/BigQuery.

The function set differs per backend: Trino, Pinot, MySQL-wire and BigQuery dialects are verified against live servers; Hive/Impala are written from each engine's documented functions; Phoenix, Druid, Flight SQL and Kudu deliberately advertise a minimal set (`UCASE`, `LCASE`, `ABS`) until verified. If a server rejects a `{fn ...}` the driver advertised, that is a driver bug — please report it.

:::note ClickHouse
`BACKEND=mysql` deliberately omits `LOCATE`, `SPACE` and `DAYOFWEEK`: MariaDB/StarRocks/Doris support them, but ClickHouse (also reached with `BACKEND=mysql`) spells or numbers them differently. The driver refuses those three rather than send a query that would mean something else on ClickHouse.
:::

## Power BI

Power BI's generic **ODBC** source already works with Argus in Import mode: filters and GROUP BY fold to SQL. But no generic ODBC source can fold `LIMIT`/`TOP` — a Power Query architecture limit. The **Argus custom connector** declares, via `SqlCapabilities.LimitClauseKind`, how to emit top-N for each backend's dialect, which unlocks top-N folding and **DirectQuery**. (Snowflake, Databricks and Dremio ship the same driver-plus-connector pair.)

### Install

1. Install the Argus ODBC driver (64-bit, matching 64-bit Power BI Desktop).
2. Download `Argus.mez` (or the signed `Argus.pqx`) from the [releases](https://github.com/VargaFoundation/argus/releases) and copy it to `Documents\Power BI Desktop\Custom Connectors\`. Restart Power BI Desktop.
3. Either:
   - **Unsigned `.mez`** — Options → Security → Data Extensions → *"(Not Recommended) Allow any extension to load..."*, or
   - **Signed `.pqx`** (preferred) — trust its certificate thumbprint via the `TrustedCertificateThumbprints` registry/GPO setting under `HKLM\Software\Policies\Microsoft\Power BI Desktop`; no security downgrade required.

### Use

**Get Data → Argus**, then supply Server, Port, Backend (`hive`, `impala`, `trino`, `phoenix`, `pinot`, `druid`, `mysql`, `bigquery`, `flightsql`; StarRocks/Doris/ClickHouse via `mysql`, Spark/Flink via `hive`) and optionally a database/catalog. Pick the authentication kind (Anonymous, Username/Password, or Windows for Kerberos via SSPI).

Apply a filter and a "Keep Top N" in Power Query — both **fold** (check *View Native Query*) — and you can switch the model to **DirectQuery**.

### The ADBC transition does not affect Argus

Power BI and Fabric are [moving away from embedded ODBC drivers](https://learn.microsoft.com/en-us/power-query/transition-to-adbc) toward ADBC (service end of 2026, Desktop spring 2027). Microsoft states this "doesn't change behavior for the ODBC connector when you use a separately installed ODBC driver" — which is what Argus is. Notably, Power BI's built-in **Hive** connector is deprecated with no replacement driver; Argus's `BACKEND=hive` serves HiveServer2 (and Spark and Flink) through a connector Microsoft is not retiring. See also the [Argus ADBC driver](./adbc.md).

## Tableau

Use the `.taco` where one exists — each connector fixes one SQL dialect:

| Connector | `BACKEND=` | Default port | Base dialect |
|---|---|---|---|
| `argus-trino` | `trino` | 8080 | `PrestoDialect` |
| `argus-hive` | `hive` (also Spark, Flink) | 10000 | `Hive12Dialect` |
| `argus-impala` | `impala` | 21050 | `Impala23Dialect` |
| `argus-mysql` | `mysql` (StarRocks/Doris — **not** ClickHouse) | 9030 | `MySQL8Dialect` |
| `argus-bigquery` | `bigquery` | — (REST) | `BigQuerySQLDialect` |

Install: copy the `.taco` to `Documents\My Tableau Repository\Connectors` — the driver itself must be installed separately. A `.taco` must be **signed with a public-CA code-signing certificate and timestamped** to load normally; unsigned connectors load only with verification disabled (`-DDisableVerifyConnectorPluginSignature=true` — development only).

- **ClickHouse** is reached with `BACKEND=mysql` but is not covered by `argus-mysql` (its SQL is not MySQL's) — use generic ODBC for it.
- Backends with no `.taco` (phoenix, pinot, druid, flightsql) work through Tableau's generic **Other Databases (ODBC)** — functional, but Tableau [does not guarantee feature compatibility](https://help.tableau.com/current/pro/desktop/en-us/examples_otherdatabases.htm) with it, and every machine opening the workbook needs the same DSN. Only 64-bit drivers are supported (Tableau 2023.3+).
- **Tableau Cloud** cannot host an ODBC driver: a Cloud workbook reaches Argus only through **Tableau Bridge** running on a machine with the driver and DSN installed.

## Excel

Excel **cannot load Power Query custom connectors** (`.mez`/`.pqx` are Power BI Desktop and the on-premises data gateway only). Excel reaches Argus through generic ODBC:

1. Install the Argus ODBC driver.
2. Create a DSN (64-bit `odbcad32.exe` on Windows).
3. **Data → Get Data → From Other Sources → From ODBC**, and pick the DSN.

Excel emits `{fn ...}`, so this depends entirely on the driver's escape translation — which is exactly what it is there for.

## Qlik

Qlik Sense on Windows and QlikView reach Argus through the built-in **Qlik ODBC Connector Package** — create a DSN and select it in the Data load editor. No Qlik-specific artifact is needed. **Qlik Sense SaaS** has no ODBC path.

## Alteryx, MicroStrategy, SSIS, SAS

Generic ODBC against a DSN. Nothing Argus-specific to install beyond the driver.

## DBeaver, Superset, Metabase, Looker

Out of reach for an ODBC driver: DBeaver is JDBC-only; Superset needs a SQLAlchemy dialect; Metabase needs a JDBC plugin; Looker/Looker Studio/QuickSight are managed services with no local driver hook. Several Argus target engines (Trino, Hive, Impala, StarRocks, BigQuery) have first-party JDBC drivers these tools support directly.
