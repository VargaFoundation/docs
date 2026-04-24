---
id: audit-log
title: Audit log
sidebar_position: 11
---

Every mutating service call (create / update / delete / restore / transition / log / set /
rename) records a row in the Kirka audit log. The log is append-only, stored in HBase,
and queryable through an admin-only REST endpoint.

## Data model

| Field          | Description                                                             |
|----------------|-------------------------------------------------------------------------|
| `event_id`     | UUID of the event                                                       |
| `timestamp`    | Epoch millis when the event was recorded                                |
| `user`         | Authenticated caller, or `anonymous`                                    |
| `client_ip`    | Remote IP (honouring `X-Forwarded-For` when present)                    |
| `action`       | `create` / `update` / `delete` / `restore` / `transition` / `rename` / `log` / `set` |
| `resource_type`| `experiment` / `run` / `model-registry` / `prompt` / `scorer` / `artifact` / `gateway-*` |
| `resource_id`  | Identifier targeted by the action                                       |
| `outcome`      | `allowed` / `denied` / `error`                                          |
| `reason`       | Exception class + message when `outcome` is not `allowed`               |
| `request_id`   | Correlation id from `X-Request-Id` / MDC — joins logs + audit           |

## HBase schema

One table, `mlflow_audit`, with a single column family:

```bash
create 'mlflow_audit', {NAME => 'info', VERSIONS => 1, TTL => 2592000}
# ↑ defaults to 30 days of retention; adjust per your compliance policy.
```

Row key format: `<reversed-timestamp(19 digits)>_<event_id>`. A plain scan therefore
returns events newest-first and `PageToken` cursors remain stable even under heavy insert
load.

## Admin API

```http
GET /api/2.0/kirka/audit/search?max_results=100&page_token=<opaque>
Authorization: Basic <admin credentials>
```

Response:

```json
{
  "events": [
    {
      "event_id": "8f1c-...",
      "timestamp": 1703001234567,
      "user": "alice",
      "client_ip": "10.2.3.4",
      "action": "delete",
      "resource_type": "experiment",
      "resource_id": "exp-42",
      "outcome": "allowed",
      "reason": null,
      "request_id": "8f1c-..."
    }
  ],
  "next_page_token": "..."
}
```

The endpoint is guarded by `@PreAuthorize("hasRole('ADMIN')")` — only callers with
`ROLE_ADMIN` (listed in `security.admin.users` after successful authentication) can list
the trail. In production `security.enabled=true` is required for the endpoint to be
callable at all.

## What is not audited

- Pure reads (`get`, `list`, `search`) — volume high, value low. Turn on the Spring Boot
  access log or the Ranger audit pipeline if you need read-auditing.
- The audit service's own writes — the aspect excludes `AuditService` to avoid recursion.

## Failure handling

`AuditService.record(...)` **never** rolls back the calling business operation when the
HBase write fails. The event is logged at WARN so operators can notice via
`kirka_hbase_operations_seconds_count{repository="AuditRepository",outcome="failure"}`,
but a flaky HBase does not block model registrations. Trading off a missing audit row
against blocking a production mutation is deliberate.

## Retention

HBase's column-level TTL is the cheapest way to cap audit volume:

```bash
alter 'mlflow_audit', {NAME => 'info', TTL => 7776000}   # 90 days
```

For regulated environments (SOC 2, GDPR) that demand longer retention, export periodically
to cold storage (Parquet on S3 / HDFS). A simple nightly Spark job reading from
`mlflow_audit` works; reverse-timestamp row keys make incremental exports easy.
