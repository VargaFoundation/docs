---
id: configuration
title: Configuration
sidebar_position: 5
---

Kirka reads its settings from Spring Boot's usual sources (`application.properties` on the
classpath, env vars, `--spring.config.location=...`). The Helm chart exposes all of the
important values through `values.yaml` → env vars on the Deployment.

## HBase and HDFS

```properties
hbase.zookeeper.quorum=zk1:2181,zk2:2181,zk3:2181
hbase.zookeeper.property.clientPort=2181
hadoop.hdfs.uri=hdfs://namenode:9000
```

## MLflow wire format

```properties
# snake_case matches the official MLflow REST API and Python/Java/R clients.
# Keep the default; the `camel_case` escape hatch exists only for legacy consumers.
kirka.api.naming=snake_case
```

## Authentication and authorization

```properties
security.enabled=true
security.authentication.type=basic        # basic | knox | kerberos

# Basic auth — passwords compared with BCryptPasswordEncoder, file managed by ops.
security.users.file=/etc/kirka/users.htpasswd

# Knox header X-Forwarded-User is honoured only from these CIDRs.
# Leave blank to refuse all Knox-style headers (recommended when Kirka is reachable directly).
security.trusted.proxies=10.20.0.0/16

# Admin role mapping: users listed here receive ROLE_ADMIN *after* successful auth.
# This is NOT an authentication shortcut — bad passwords still fail, even for "admin".
security.admin.users=alice,ops-bot

# Owner-based authz: a resource's creator always retains access.
security.authorization.owner.enabled=true
```

## Apache Ranger

```properties
ranger.service.name=kirka                 # must match the service in Ranger Admin
ranger.admin.url=http://ranger-admin:6080
ranger.policy.cache.dir=/var/lib/kirka/ranger-cache
```

The actual plugin settings — refresh interval, audit destination, SSL — live in
`ranger-kirka-security.xml` and `ranger-kirka-audit.xml` on the classpath. See
[Ranger setup](./ranger-setup.md).

## Kerberos

```properties
security.kerberos.enabled=true
security.kerberos.principal=kirka/kirka-host@REALM.COM
security.kerberos.keytab=/etc/kirka/kerberos.keytab
security.kerberos.krb5conf=/etc/krb5.conf
```

Mount the keytab through a Kubernetes `Secret` — the Helm chart supports
`kerberos.existingSecret` for that.

## Actuator / metrics / OpenAPI

```properties
# Only health, info and the Prometheus scrape are exposed publicly.
# env/loggers/beans are admin-only (guarded by ROLE_ADMIN in SecurityConfig).
management.endpoints.web.exposure.include=health,info,prometheus,env,loggers,beans
management.endpoint.health.show-details=when_authorized
management.endpoint.health.probes.enabled=true
```

OpenAPI schema is served at `/v3/api-docs` and the browsable UI at `/swagger-ui.html` —
both publicly reachable because they do not contain any secret material.

## Graceful shutdown and multipart

```properties
server.shutdown=graceful
spring.lifecycle.timeout-per-shutdown-phase=30s

spring.servlet.multipart.max-file-size=5GB
spring.servlet.multipart.max-request-size=5GB
```

## Logging

```properties
# INFO in production; the default pattern includes [%X{request_id:-}] — the MDC key set by
# MdcCorrelationFilter for per-request tracing.
logging.level.varga.kirka=INFO
logging.level.varga.kirka.security=INFO
```

Switch to `SPRING_PROFILES_ACTIVE=prod` to enable the JSON (Logstash) encoder shipped in
`logback-spring.xml`.

## Observability

`RepositoryTimingAspect` publishes latency for every repository call; no configuration
required. See [Observability](./observability.md) for the panel and alert bundle.

## Audit log retention

The audit trail table has no built-in expiry — set the HBase TTL during provisioning (90
days in the example below) or let the cold-storage exporter rotate the data:

```bash
# In the HBase shell — tune to your retention policy
create 'mlflow_audit', {NAME => 'info', VERSIONS => 1, TTL => 7776000}
```

See [Audit log](./audit-log.md) for the full write / read story.

## Overriding through Helm

All of the above surface as entries under `config:` in `values.yaml`. The Helm chart renders
them into a ConfigMap consumed by the Deployment as env vars
(`SECURITY_ENABLED`, `KIRKA_API_NAMING`, …). A commented example:

```yaml
config:
  hbaseZookeeperQuorum: "zk1:2181,zk2:2181,zk3:2181"
  hdfsUri: "hdfs://namenode:9000"
  kirkaApiNaming: "snake_case"
  securityEnabled: "true"
  securityUsersFile: "/etc/kirka/users.htpasswd"
  securityTrustedProxies: "10.20.0.0/16"
  securityAdminUsers: "alice,ops-bot"
  kerberosEnabled: "true"
  kerberosPrincipal: "kirka/kirka-host@REALM.COM"
  kerberosKeytab: "/etc/kirka/kerberos.keytab"
  rangerServiceName: "kirka"
  rangerAdminUrl: "http://ranger-admin:6080"
```
