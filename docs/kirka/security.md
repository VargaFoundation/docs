---
id: security
title: Security
sidebar_position: 6
---

## Kerberos Authentication

Enable in `application.properties`:

```properties
security.kerberos.enabled=true
security.kerberos.principal=kirka/_HOST@REALM.COM
security.kerberos.keytab=/etc/security/keytabs/kirka.service.keytab
security.kerberos.krb5conf=/etc/krb5.conf
```

- **Automatic management**: When deployed via Ambari Mpack, Kerberos identities and keytabs are managed automatically.
- **Keytab Permissions**: Ensure keytab file permissions are restrictive: `chmod 400 /path/to/kirka.service.keytab`.
- **Consistency**: HBase and HDFS must be Kerberized consistently for Kirka to operate in a secure cluster.

## Apache Ranger Integration

Kirka integrates with Apache Ranger for fine-grained access control.

### Configuration

Enable Ranger in `application.properties`:

```properties
ranger.service.name=kirka
ranger.admin.url=http://ranger-admin-host:6080
ranger.policy.cache.dir=/etc/kirka/conf/policycache
security.authorization.owner.enabled=true
```

### Features
- **Centralized Policy Management**: Define access policies for experiments and runs in Ranger Admin.
- **Resource Hierarchy**: Policies are based on `namespace/experiment/run`.
- **Owner-based Authorization**: If enabled, owners have full access to their own resources.
- **Audit Logs**: All access requests are logged and can be viewed in Ranger Audit.

## Access Control (Hadoop Level)

- HBase: Namespace ACLs for experiments/runs tables.
- HDFS: Directory ACLs for artifacts (e.g., /user/kirka/artifacts).
- Application-level: MLflow permissions if extended.

## Gateway (Knox)

Kirka integrates with Apache Knox for proxying and auth. See [Examples](./examples.md).

## Best Practices

- Rotate keytabs regularly.
- Use TLS for all endpoints.
- Audit logs for access.