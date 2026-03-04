---
id: faq
title: FAQ
sidebar_position: 10
---

- **Which ODBC driver manager is supported?** unixODBC on Linux/macOS, Windows ODBC Driver Manager on Windows.
- **Can I use Argus with PowerBI/Tableau?** Yes. Argus implements 50+ SQLGetInfo types for BI tool compatibility.
- **Do I need all backends installed?** No. Dependencies are optional per backend. Install only the libraries for backends you use.
- **Does Argus support Kerberos?** The Kudu backend supports Kerberos natively via the C++ client. For other backends, use a Kerberos-aware proxy or SASL PLAIN with delegated credentials.
- **How are complex types handled?** ARRAY, MAP, and STRUCT are serialized as JSON strings via SQL_VARCHAR.
- **Can I use Argus with connection pooling?** Yes. The driver is designed to be connection-pooling ready.
- **What is the default fetch batch size?** 1000 rows. Configurable via `FetchBufferSize`.
- **Does Argus support prepared statements?** SQLPrepare is implemented and dispatches to the backend's execute function.
- **What SQL does the Kudu backend support?** Kudu has no native SQL engine. The driver includes a minimal SQL parser that supports `SELECT ... FROM ... WHERE ... LIMIT`. Supported WHERE operators: `=`, `<`, `>`, `<=`, `>=`, `!=`, `IN (...)`, `IS NULL`, and `IS NOT NULL`. `JOIN`, `GROUP BY`, `ORDER BY`, subqueries, and DML statements (`INSERT`, `UPDATE`, `DELETE`) are not supported.
- **What is Phoenix Query Server?** Phoenix Query Server (PQS) is a standalone server that provides remote access to Apache Phoenix via the Avatica protocol over HTTP/JSON. The Argus Phoenix backend connects to PQS, not directly to HBase.
- **Can I use Argus with Phoenix without PQS?** No. The Argus Phoenix backend requires Phoenix Query Server running on the target host. It communicates exclusively via the Avatica HTTP/JSON protocol.
- **Does the Kudu backend support writes?** No. The Kudu backend is read-only and only supports SELECT queries via the KuduScanner API.
- **What is the difference between Trino v1 and v2 protocol?** v1 (default) returns data as flat JSON arrays inline in the REST response. v2 (spooling, Trino 466+) can offload large result sets to external storage and return them as segments. Use `TrinoProtocol=v2` to enable spooling. The driver handles both formats transparently, including mixed responses where some pages use v1 and others use v2.
- **When should I use Trino v2 spooling?** Use v2 when querying large result sets on Trino 466+. Spooling reduces coordinator memory pressure by offloading data to external storage. For small queries or older Trino versions, v1 is sufficient.
