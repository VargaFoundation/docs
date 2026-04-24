---
id: troubleshooting
title: Troubleshooting
sidebar_position: 13
---

Every response body carries the MDC `request_id` echoed by the `X-Request-Id` header — grep
for it in Kirka's logs to reconstruct a single request across threads.

## HBase / ZooKeeper connection fails

Symptoms: `KeeperErrorCode = ConnectionLoss for /hbase`, `RpcRetryingCaller` retries.

- Check `HBASE_ZOOKEEPER_QUORUM` env var / `hbase.zookeeper.quorum` property.
- `kubectl run --rm -it --image=alpine/socat -- sh -c "nc -zv zk1 2181"` from inside the
  namespace.
- The readiness probe returns 503 until the initial connection succeeds; look at
  `kubectl describe pod` events.

## HDFS write denied

- Kerberized? Run `klist -k /etc/kirka/kerberos.keytab` inside the pod and check the
  principal listed there matches what HDFS Namenode expects.
- Non-Kerberized? The pod runs as UID 10001 — either set the HDFS dir `umask` to `0000`
  or change the dir owner.

## MLflow client receives 4xx unexpectedly

- The `filter_string` is likely not parseable. The response body includes
  `"error_code": "INVALID_PARAMETER_VALUE"` with the column where the parser choked. See
  [Examples / search filters](./examples.md#search-filters).
- Passed camelCase? Default wire format is snake_case (`experiment_id`, not `experimentId`).
  Set `kirka.api.naming=camel_case` only for legacy clients.

## MLflow client receives 401 / 403

- 401: `security.users.file` is empty, the bcrypt hash has a non-supported prefix
  (only `$2a$`, `$2b$`, `$2y$` are accepted), or the password is wrong.
- 403: Ranger policy doesn't allow the caller. `kirka.authorization.denied` counter on the
  Prometheus endpoint increments on every denial; check the Ranger audit dashboard too.

## `/invocations` returns 501

Expected. Kirka doesn't serve models — deploy the registered model on a dedicated
runtime and point the client at that serving endpoint.

## Gateway `/query/{name}` returns 501

Expected. Route registration works but upstream LLM proxying is tracked as a roadmap item
(see [Compatibility](./compatibility.md)).

## The `mlflow_audit` table fills up

Set an HBase TTL at creation time or `alter 'mlflow_audit', {NAME => 'info', TTL => N}` for
an existing table — see [Audit log](./audit-log.md#retention).

## Scheduler complains about orphan index rows

`kirka_repair_orphans_total` is the counter; `ExperimentIndexReconciler` runs hourly to
clean them. Some churn is normal after a RegionServer bounce; a sustained high rate (>50
orphans/hour for more than 30 minutes) is what the `KirkaOrphanIndexBuildingUp` alert
monitors.

## Pod fails to start with "read-only root filesystem"

The Helm `containerSecurityContext.readOnlyRootFilesystem=true` blocks any write outside
the mounted `/tmp` emptyDir. If you set a custom `SPRING_CONFIG_LOCATION` or keytab path
outside `/tmp` and `/etc/kirka`, mount a writable volume for it.

## Log levels debugging

Bump logging at runtime (admin required):

```bash
curl -u admin:... -X POST http://kirka:8080/actuator/loggers/org.apache.hadoop.hbase \
  -H 'Content-Type: application/json' -d '{"configuredLevel":"DEBUG"}'
```

Revert with `{"configuredLevel":null}`.

## Where to look next

- `/actuator/env` for the effective property set (admin).
- `/actuator/beans` to confirm Jackson / Ranger / audit beans exist (admin).
- `/actuator/prometheus` for the metric feed consumed by the Grafana pack.
- `mlflow_audit` HBase table / `/api/2.0/kirka/audit/search` for the last N mutations.
