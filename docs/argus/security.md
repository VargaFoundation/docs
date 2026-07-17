---
id: security
title: Security
sidebar_position: 6
---

## SSL/TLS

Argus supports SSL/TLS for all backends. Enable via the connection string:

```
SSL=1;SSLCAFile=/etc/ssl/certs/ca.pem;SSLVerify=1
```

### Trino / Phoenix / Pinot / Druid

- Full HTTPS with certificate verification (libcurl)
- Client certificate and key support (mutual TLS)

```
HOST=trino.example.com;PORT=8443;
SSL=1;SSLVerify=1;
SSLCertFile=/opt/certs/client-cert.pem;
SSLKeyFile=/opt/certs/client-key.pem;
SSLCAFile=/opt/certs/root-ca.pem;
BACKEND=trino
```

### Hive/Impala

- TLS on the Thrift transport, with CA certificate configuration
- On Windows the GIO transport uses the bundled `glib-networking` TLS module — loaded automatically by the driver

```
HOST=hive.example.com;PORT=10000;
SSL=1;SSLCAFile=/etc/ssl/certs/ca-bundle.crt;SSLVerify=1;
BACKEND=hive
```

### BigQuery

- HTTPS to the API and token endpoints; `SSLCAFile` is honoured for **both** — required for sovereign clouds whose private PKI is not in the system trust store
- Mutual TLS via `SSLCertFile`/`SSLKeyFile`

### MySQL-wire

- TLS via libmariadb: `SSL=1` with `SSLCertFile`/`SSLKeyFile`/`SSLCAFile`, `SSLVerify` honored

### Flight SQL

- `SSL=1` uses a TLS gRPC channel

## Authentication

Set via the `AUTHMECH` connection string parameter (see the [full table](./configuration.md#authentication-mechanisms)).

### Username / password

- **Hive/Impala**: `PLAIN`/`LDAP` — SASL PLAIN negotiated during Thrift session open.
- **Trino**: `LDAP`/`PLAIN`/`BASIC` (or simply supplying `PWD`) — HTTP Basic; **requires TLS** (`SSL=1`).
- **Pinot/Druid**: optional HTTP Basic via `UID`/`PWD`.
- **MySQL-wire**: native MySQL authentication.
- **Flight SQL**: `UID`+`PWD` → Flight handshake (basic token).

### Kerberos

`AuthMech=KERBEROS` (alias `GSSAPI`) for Hive, Impala and Trino:

- **Linux/macOS**: system GSSAPI — a `kinit` ticket or keytab.
- **Windows**: **native SSPI** using the logged-in domain user's credentials — no MIT Kerberos install required.
- **Trino** and Hive over HTTP transport use SPNEGO/Negotiate via libcurl.

The service principal defaults to `hive/<host>` (`impala/<host>` for Impala), with the realm resolved from the Kerberos config. Override with:

- `KrbServiceName` — the SPN service (default `hive`/`impala`).
- `KrbHostFQDN` — the SPN host, when it differs from the connection `HOST` (load balancer, connection by IP).
- `KrbRealm` — an explicit realm, producing `service/host@REALM` (cross-realm, or no `domain_realm` mapping).

```
DRIVER=Argus;BACKEND=hive;HOST=hive.example.com;PORT=10000;AuthMech=KERBEROS;KrbServiceName=hive
```

### Bearer tokens (JWT / Databricks)

`AuthMech=JWT` (aliases `BEARER`, `DATABRICKS`, `TOKEN`) sends the token in `PWD` as `Authorization: Bearer <token>`:

- **Trino**: any JWT-gated cluster.
- **Hive over HTTP** (`TransportMode=HTTP`): Databricks SQL warehouses (personal access tokens), or any token-gated HiveServer2/Spark endpoint (e.g. behind Apache Knox).

### OAuth2 (Trino)

- **`OAUTH2` / `CLIENT_CREDENTIALS`** — machine-to-machine: Argus fetches a token from the IdP token endpoint and uses it as the bearer. Params: `OAuth2TokenEndpoint`, `ClientId`, `ClientSecret`, optional `Scope`. The token is **re-fetched automatically** on `401` (expiry) and the request retried transparently.
- **`DEVICE_CODE`** — device authorization grant (RFC 8628) for headless/no-browser logins: Argus prints the verification URL and user code, polls the token endpoint until authorized. Params: `OAuth2DeviceEndpoint`, `OAuth2TokenEndpoint`, `ClientId`, optional `Scope`.
- **`AUTH_CODE` / `BROWSER` / `SSO`** — authorization-code grant with PKCE and a browser + loopback redirect (the standard interactive cloud-BI flow): Argus opens the system browser (honoring `$BROWSER`), listens on `127.0.0.1:<ephemeral>`, exchanges the code at the token endpoint. Params: `OAuth2AuthEndpoint`, `OAuth2TokenEndpoint`, `ClientId`, optional `ClientSecret`/`Scope`.
- **OIDC discovery** — instead of giving each endpoint, set `OAuth2Issuer` and Argus fetches `<issuer>/.well-known/openid-configuration` to discover them. Works with all three flows.

```
DRIVER=Argus;BACKEND=trino;HOST=trino;PORT=8443;SSL=1;AuthMech=OAUTH2;OAuth2Issuer=https://idp.example.com;ClientId=cid;ClientSecret=csec;Scope=trino
```

### BigQuery service accounts

`BQKeyFile` points at a service-account JSON key; Argus performs the RS256 JWT-bearer grant against the (configurable) token endpoint. Alternatively, `AccessToken` supplies a pre-fetched bearer token. See [Configuration](./configuration.md#google-bigquery-backendbigquery).

## Query tracking

Use `ApplicationName` to identify queries in backend audit logs:

- **Trino**: Sets `X-Trino-Source` HTTP header
- **Hive**: Sets `hive.query.source` session configuration
- **Phoenix**: Sent in Avatica connection properties

```
ApplicationName=MyETLPipeline
```

## Best practices

- Use SSL/TLS in production (`SSL=1;SSLVerify=1`).
- Use absolute paths for certificate and key files.
- Never leave `SSLVerify=0` outside a test bench.
- Prefer Kerberos or OAuth2 to static passwords where the cluster supports them.
- Never put `PWD` (passwords or tokens) in a world-readable DSN file; on Windows the ODBC Manager refuses `UID`/`PWD` in DSN properties — supply them at connect time.
- Rotate certificates, tokens and service-account keys on a regular schedule.
- Use `ApplicationName` for audit trail.
