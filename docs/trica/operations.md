---
id: operations
title: Operations
sidebar_position: 9
---

# Operations

## Health endpoints

| Path | Meaning | Use |
|---|---|---|
| `GET /healthz` | The process serves HTTP; does not touch the database | Liveness (and startup: migrations run before the server listens) |
| `GET /readyz` | Started, and the database answers within 2 s | Readiness |
| `GET /metrics` | Prometheus metrics, **unauthenticated** | Scrape; restrict who reaches it (the chart's NetworkPolicy) |
| `GET /api/v1/health/collection` | Last run of every collector and agent source (authenticated) | The **Health** page |

## Monitoring

| Metric | Alert when |
|---|---|
| `trica_collect_failures_total` | Its rate is above zero for a target |
| `trica_collect_last_success_timestamp_seconds` | `time() - …` exceeds a few intervals |
| `trica_collect_skipped_total` | It grows: runs take longer than their interval |
| `trica_absence_sweep_errors_total`, `trica_deduce_errors_total` | They grow |
| `trica_deduce_last_success_timestamp_seconds` | Stale |
| `trica_audit_head_regressions_total` | **Any increase**: the audit log lost or changed entries |
| `trica_audit_anchor_errors_total` | It grows |
| `trica_build_info` | Shows the running version |

Also exported: `trica_absence_sweeps_total`, `trica_objects_marked_absent_total`,
`trica_deduce_runs_total`, `trica_deduce_skipped_total`, `trica_deduce_cables`,
`trica_deduce_findings`, `trica_deduce_duration_seconds`, `trica_audit_head_id`, collector
duration histograms, remote collector spool gauges, and the Go and process collectors. The agent
writes its own metrics as a node-exporter textfile (spool size and age, last success). With the
Prometheus Operator, `serviceMonitor.enabled: true` in the chart.

Logs are JSON on stderr. They never contain the database URL, a token or a device credential.

## Backup and restore

PostgreSQL holds all of trica's state; the only other state is the transport CA directory
(`ca.pem`, `ca-key.pem`) when agents are used. **Back up both.** Losing the CA means re-enrolling
every agent and remote collector.

### With a PostgreSQL that has its own backups

An operator or a managed service with WAL archiving gives physical backups and point-in-time
recovery: use those, and leave the chart's backup CronJob off.

### Logical backups (`trica backup`)

`trica backup --dir DIR` takes one consistent `pg_dump` archive while the server runs; it records
the schema version and never overwrites a file. It needs the `trica-ops` image (PostgreSQL 17
client tools).

```bash
# Docker Compose
docker compose --profile ops run --rm ops backup --dir /backups
# Kubernetes: the chart's CronJob
#   backup: {enabled: true, schedule: "17 2 * * *", existingClaim: trica-backups,
#            image: {repository: registry.example.com/trica-ops}}
```

Nothing is ever pruned: rotate the archives and copy them off the machine yourself (a backup on the
same disk is not a backup).

### Restore

`trica restore --file ARCHIVE` loads an archive in one transaction (a failed restore changes
nothing). It refuses an archive from a newer release than the binary, migrates an older one up,
and refuses a database that already holds tables unless `--replace` is given; with `--replace`
the server must be stopped.

```bash
docker compose stop trica
docker compose --profile ops run --rm ops restore --file /backups/trica-20260301T021700Z.dump --replace
docker compose up -d trica && curl -fsS http://127.0.0.1:8080/readyz
```

On Kubernetes: scale the Deployment to 0, run the same command with the ops image and the database
Secret (`kubectl run` or a Job), scale back. Restore a copy now and then: an archive never restored
is a hope.

## Export and import

`trica export` writes the inventory (now, or `--at` a date, optionally with `--history`) as JSON
or YAML, without sensitive attributes. `trica import FILE` submits such a file as a declared batch
from `import:NAME`: it never overrides what collectors observe, `--dry-run` shows the counts, and
`--scope full` withdraws what an earlier import of the same name claimed and the file omits.
Useful for migrations from another CMDB and for seeding sites, racks and passive equipment.

## Upgrades

1. Read the release notes, and take a backup (or check the PostgreSQL backups are current).
2. Upgrade the image or the chart. At start the server applies pending migrations under an
   advisory lock: with several replicas, one migrates, the others wait.
3. Check `/readyz`, `trica_build_info` and the **Health** page.

Rolling back after a migration: `trica migrate down` rolls back the latest migration only. The
reliable path is to restore the pre-upgrade backup with the previous image (a restore refuses an
archive newer than the binary, so the backup must predate the upgrade). Trica is at 0.x: only the
latest minor release is supported.

## Verifying a release

Images published by the release workflow are signed keylessly with cosign:

```bash
cosign verify ghcr.io/vargafoundation/trica:X.Y.Z \
  --certificate-identity-regexp '^https://github.com/VargaFoundation/trica/\.github/workflows/release\.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

The binaries come with `SHA256SUMS` and its signature bundle. A release published by hand by a
maintainer (when CI is unavailable) is signed with that maintainer's identity instead, and the
release notes say so.

## Scaling

Any replica serves reads and writes; writes are serialised by the engine (a few batches per second
are plenty for a site of thousands of devices). The sweep, the deducer and the in-server collectors
run on one replica at a time. Set `replicaCount` above 1 with a PodDisruptionBudget for
availability; the transport CA claim must then be ReadWriteMany.
