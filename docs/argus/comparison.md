---
id: comparison
title: How Argus compares
sidebar_position: 2.5
---

Argus is measured against the commercial baseline — Simba/Magnitude's SimbaEngine
drivers (OEM'd as the Databricks/Spark, Impala, Hive, Athena and BigQuery ODBC
drivers) and Starburst's Trino driver — and against the generic **Other Databases
(ODBC)** entry that BI tools ship. Parity is judged on the **observable ODBC
contract** (what the driver advertises and can do), not on marketing.

## At a glance

| | **Argus** | Simba / Starburst (per engine) | Generic *Other Databases (ODBC)* |
|---|---|---|---|
| Engines per driver | **10 in one binary** | one driver per engine | any, but dialect-blind |
| Licensing | **open** (Varga Foundation) | proprietary, per-seat | bundled |
| ODBC level | 3.8, Level 1, SQL-92 Entry | 3.8, Level 1/2 | depends on driver |
| Exported ODBC entry points | **107** | 89 (SimbaEngine core) | n/a |
| Unicode (`W`) | full | full | varies |
| Async execution | **yes** (`SQL_AM_STATEMENT`) | yes | usually no |
| Auth | Kerberos (GSSAPI+SSPI), OAuth2 (M2M + device flow), JWT, LDAP, TLS | yes | varies |
| Connection pooling | yes | yes | driver-manager only |
| Tableau TDVT | **91.4 %** measured | certified (>90 %) | not applicable |
| Large-result decode | DOM-free JSON (~65 % faster), spooling, Arrow via ADBC | Arrow / Cloud Fetch | row-wise |
| Dialect correctness | per-backend dialect + ODBC escape translation | per-engine | **none** — SQL passed through |
| Arrow surface | ADBC driver + Flight SQL backend | JDBC/ODBC | no |

## Why Argus

- **One driver, ten engines.** Commercial connectivity means a separate licensed
  driver per engine — Simba Spark *and* Simba Impala *and* Starburst Trino, each
  with its own installer, DSN scheme and support contract. Argus is a single
  binary with one connection-string grammar and a per-backend dialect layer, so a
  BI deployment installs and governs **one** driver.

- **At parity on the contract that matters, open.** ODBC 3.8, full Unicode, Level 1
  conformance, real asynchronous execution, connection pooling, the full auth
  matrix, a **broader raw ODBC surface (107 vs 89 entry points)**, and a
  **91.4 % Tableau TDVT** pass rate on the same tests certified connectors run —
  with no per-seat licence.

- **Honest capabilities.** Argus advertises only what it can do. Where an engine
  has no foreign keys, stored procedures or row-version columns, the catalog
  functions return empty — exactly as Simba's drivers for those engines do —
  rather than inventing metadata a BI tool would then trust.

- **Fast where it counts.** The Trino fetch path decodes result pages **without
  building a JSON DOM** — proven byte-identical to the reference path and ~65 %
  faster on large extracts (300 k × 9 columns: 573 ms vs 948 ms; 523 k vs 316 k
  rows/s) — on top of Trino spooling and a numeric fast-path that avoids a text
  round-trip.

- **Dialect-correct, unlike the generic ODBC entry.** Tableau itself
  [warns](https://help.tableau.com/current/pro/desktop/en-us/examples_otherdatabases.htm)
  that with *Other Databases (ODBC)* "the outcome may vary and compatibility …
  is not guaranteed". Argus ships a per-backend SQL dialect and translates ODBC
  escape sequences (`{fn …}`, `{d}`, `{t}`, `{ts}`, `{oj}`) into each engine's own
  grammar, so `{fn}`-generating tools (Tableau, Excel, Qlik) get correct SQL.

- **Sovereign and configurable.** Every Google endpoint is configurable for
  BigQuery, including S3NS sovereign clouds — connectivity that closed vendor
  drivers do not expose.

- **Arrow-native.** The same backends are exposed through an [Arrow ADBC
  driver](./adbc.md), and Arrow Flight SQL is a first-class backend.

## How this was measured

The comparison is evidence-based, not asserted:

- **Black-box ABI inspection** of real SimbaEngine binaries (the Spark and Hive
  ODBC drivers shipped with Power BI Desktop) — their exported ODBC entry points
  via `objdump`. The Simba Hive and Spark drivers export an *identical* 89-function
  surface, confirming the shared SimbaEngine core; Argus exports 107.
- **A live Tableau TDVT run** of the Argus Trino connector (769 expression tests)
  against a real Trino server.
- **A source audit** of the driver across the axes above.

No decompilation of proprietary binaries is involved — only their public ABI,
published documentation, and Argus's own source. The full write-up lives in the
repository at `docs/SIMBA_PARITY.md`.

:::note
"Parity" here is the ODBC contract a BI tool exercises. Simba retains an edge on
one thing worth a roadmap item: a native columnar **Arrow wire format** (Cloud
Fetch). Argus's DOM-free decode removes the dominant cost today, and the same
Arrow surface is already available through its ADBC driver.
:::
