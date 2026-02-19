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

### Trino

- Full HTTPS with certificate verification
- Client certificate and key support (mutual TLS)
- Implemented via libcurl SSL options

```
HOST=trino.example.com;PORT=8443;
SSL=1;SSLVerify=1;
SSLCertFile=/opt/certs/client-cert.pem;
SSLKeyFile=/opt/certs/client-key.pem;
SSLCAFile=/opt/certs/root-ca.pem;
BACKEND=trino
```

### Hive/Impala

- Thrift SSL sockets via OpenSSL integration
- CA certificate configuration
- Conditional compilation with `ARGUS_HAS_THRIFT_SSL` flag
- Graceful fallback when SSL not available

```
HOST=hive.example.com;PORT=10000;
SSL=1;SSLCAFile=/etc/ssl/certs/ca-bundle.crt;SSLVerify=1;
BACKEND=hive
```

### Phoenix

- Full HTTPS with certificate verification via Phoenix Query Server
- Same SSL options as Trino (libcurl-based)

```
HOST=pqs.example.com;PORT=8765;
SSL=1;SSLVerify=1;
SSLCAFile=/opt/certs/root-ca.pem;
BACKEND=phoenix
```

### Kudu

- Kudu supports Kerberos authentication natively via the C++ client
- SSL/TLS encryption is handled at the Kudu cluster level
- The Argus Kudu backend passes timeout settings to the client builder
- For secured clusters, ensure Kerberos tickets are available in the environment

## Authentication

| Mechanism | Description |
|-----------|-------------|
| NOSASL | No authentication (development/testing only) |
| PLAIN | Username/password over SASL PLAIN |

Set via the `AUTHMECH` connection string parameter.

### Trino

Authentication uses HTTP headers (`X-Trino-User`). For password-protected clusters, credentials are sent with each request.

### Hive/Impala

Authentication negotiated during Thrift session open. SASL PLAIN sends credentials in the initial handshake.

### Phoenix

Authentication is configured on the Phoenix Query Server side. The Argus driver sends the `UID` as the user in the Avatica `openConnection` request.

### Kudu

Kudu uses Kerberos for authentication in secured clusters. Ensure valid Kerberos credentials are available before connecting.

## Query tracking

Use `ApplicationName` to identify queries in backend audit logs:

- **Trino**: Sets `X-Trino-Source` HTTP header
- **Hive**: Sets `hive.query.source` session configuration
- **Phoenix**: Sent in Avatica connection properties
- **Kudu**: Logged locally via Argus logging

```
ApplicationName=MyETLPipeline
```

## Best practices

- Use SSL/TLS in production (`SSL=1;SSLVerify=1`).
- Use absolute paths for certificate files.
- Test with `SSLVerify=0` first, then enable verification.
- Set `AUTHMECH=PLAIN` with credentials for authenticated clusters.
- Rotate certificates on a regular schedule.
- Use `ApplicationName` for audit trail.
