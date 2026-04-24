---
id: security
title: Security
sidebar_position: 6
---

Kirka ships three orthogonal layers — authentication, authorization and transport. None of
them are enabled in development defaults; flip `security.enabled=true` for any real
deployment.

## Authentication

`security.authentication.type` picks the default scheme. All three schemes can coexist
(e.g. Knox header for browser traffic + Basic Auth for scripts).

### Basic Auth (bcrypt)

Passwords are verified against a bcrypt htpasswd file mounted through a Kubernetes Secret:

```bash
# Generate a bcrypt hash (any htpasswd-compatible tool works)
htpasswd -B -n alice >> users.htpasswd
```

Configure Kirka:

```properties
security.enabled=true
security.authentication.type=basic
security.users.file=/etc/kirka/users.htpasswd
```

Anything but a successful bcrypt match (`$2a$`, `$2b$`, `$2y$` prefixes) fails with
`401`. Pre-existing stub that accepted any password is gone.

### Knox / proxied authentication

When Kirka sits behind Apache Knox (or another trusted gateway), the gateway authenticates
the user and forwards the identity via the `X-Forwarded-User` header. **Kirka only honours
this header from trusted proxy IPs**, guarding against clients that reach the pod directly:

```properties
security.authentication.type=knox
security.trusted.proxies=10.20.0.0/16,192.168.77.10/32
```

Leaving `security.trusted.proxies` blank effectively disables the header.

### Kerberos

```properties
security.kerberos.enabled=true
security.kerberos.principal=kirka/_HOST@REALM.COM
security.kerberos.keytab=/etc/security/keytabs/kirka.service.keytab
security.kerberos.krb5conf=/etc/krb5.conf
```

- **Automatic management**: when deployed via the Ambari Mpack, Kerberos identities and
  keytabs are provisioned automatically — the paths above match the Mpack convention.
- **Keytab permissions**: `chmod 400 /etc/security/keytabs/kirka.service.keytab`. In
  Kubernetes, mount the keytab through `kerberos.existingSecret` in the Helm values; the
  Deployment mounts the Secret at `kerberos.mountPath` read-only.
- The service account running the JVM must own (or `kinit`) the principal.
- HBase and HDFS must be Kerberized with consistent realm + cross-realm trust.

## Authorization

### Owner-based (always on)

When `security.authorization.owner.enabled=true` (default), the creator of a resource keeps
full access even if no Ranger policy grants it. This is the safety net that lets users
reach their own data if Ranger Admin is temporarily unreachable at startup.

### Apache Ranger (recommended)

The production default. Kirka embeds the real `RangerBasePlugin` — policies authored in
Ranger Admin flow into every authorization check. See [Ranger setup](./ranger-setup.md) for
the service-def install, policy examples and failure semantics.

Policies are organised by resource-type hierarchy (`experiment/run`, `model`, `gateway`,
`scorer`, `prompt`). Every access decision is written to Ranger's standard audit pipeline
(Solr/HDFS/log4j depending on `ranger-kirka-audit.xml`).

The `ROLE_ADMIN` grant needed for `/actuator/env`, `/api/2.0/kirka/audit`,
`/api/2.0/kirka/gdpr` is mapped outside of Ranger, via `security.admin.users` (a list of
usernames) — Ranger governs business resources, `ROLE_ADMIN` governs the control plane.

## Access control at the Hadoop layer

Ranger handles authorization for Kirka's REST surface, but the backing storage should also
enforce defence in depth:

- **HBase**: give the Kirka service user read/write only on the `mlflow_*` tables (ideally
  in a dedicated namespace `kirka:mlflow_*`).
- **HDFS**: ACL the artifact root (`/user/kirka/artifacts` or your chosen tree) so only
  the Kirka principal and Ranger-reviewed consumers can read/write.
- **Ranger audit sink**: scoping the Solr collection / HDFS path means Ranger admins can
  see Kirka events alongside the rest of the stack.

## Actuator endpoints

| Endpoint                | Access          |
|-------------------------|-----------------|
| `/actuator/health`      | Public          |
| `/actuator/info`        | Public          |
| `/actuator/prometheus`  | Public          |
| `/actuator/env`         | `ROLE_ADMIN`    |
| `/actuator/loggers`     | `ROLE_ADMIN`    |
| `/actuator/beans`       | `ROLE_ADMIN`    |
| `/v3/api-docs`          | Public          |
| `/swagger-ui.html`      | Public          |

`show-details=when_authorized` keeps health response bodies lean for anonymous callers.

## Transport

- Run Kirka behind a TLS-terminating ingress. The Helm chart includes an optional
  `Ingress` template with cert-manager annotations.
- The Dockerfile runs the JVM as UID 10001; the Helm pod `securityContext` sets
  `runAsNonRoot=true`, `readOnlyRootFilesystem=true`, `capabilities.drop: [ALL]`.
- Optional `NetworkPolicy` template restricts egress to HBase / HDFS / Ranger / Knox only.

## Best practices

- Rotate keytabs and bcrypt htpasswd files periodically; inject them through K8s Secrets,
  never bake them into images.
- Keep a Grafana alert on `kirka_basic_auth_failures_total` to catch brute-force attempts
  (shipped in `docs/observability/prometheus-rules.yaml`).
- Audit every GDPR hard-delete — the `/api/2.0/kirka/audit` endpoint records admin actions
  automatically via `AuditAspect`.
