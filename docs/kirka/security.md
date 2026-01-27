---
id: security
title: Security
sidebar_position: 6
---

## Kerberos Authentication

Enable in `application.properties`:

```properties
security.kerberos.enabled=true
security.kerberos.principal=user@REALM.COM
security.kerberos.keytab=/path/to/user.keytab
security.kerberos.krb5conf=/etc/krb5.conf
```

- Ensure keytab file permissions: `chmod 400 /path/to/user.keytab`
- Service must run as principal owner or use kinit.
- HBase/HDFS must be Kerberized consistently.

## Access Control

- HBase: Namespace ACLs for experiments/runs tables.
- HDFS: Directory ACLs for artifacts (e.g., /user/kirka/artifacts).
- Application-level: MLflow permissions if extended.

## Gateway (Knox)

Kirka integrates with Apache Knox for proxying and auth. See [Examples](./examples.md).

## Best Practices

- Rotate keytabs regularly.
- Use TLS for all endpoints.
- Audit logs for access.