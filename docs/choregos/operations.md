---
id: operations
title: Operations and runbooks
sidebar_position: 11
---

# Operations and runbooks

A runbook is read at 3 a.m. by someone who did not write the code. This page gives the operating model, the
essential procedures and the list of full runbooks, which live in the
[repository](https://github.com/VargaFoundation/choregos/tree/main/docs/runbooks).

## What to watch

The API exposes `/metrics` (Prometheus text format, computed from the database) and `/healthz`, `/readyz`.
The chart ships a scrape object (`ServiceMonitor`, or the VictoriaMetrics equivalent), alerting rules and six
Grafana dashboards; a test keeps them honest by letting them name only metrics the API exports. Optionally,
set `global.tracing.otlpEndpoint` to export OpenTelemetry GenAI traces, one per run.

Multi-node behaviour is built in: a `PodDisruptionBudget` per component, soft pod anti-affinity, bounded
database connection pools (size PostgreSQL's `max_connections` as replicas times pool size plus overflow),
and short tolerations so a worker does not stay attached to a dead node.

## The API returns 5xx

Check `/readyz` first: it says whether the database and Temporal answer. Three causes cover almost every case.

| Symptom in the logs | Cause | Action |
| :-- | :-- | :-- |
| `connection refused` to PostgreSQL | database down or saturated | check the pooler and connections; see the restore runbook if data is lost |
| `temporal` or `RPCError` | Temporal frontend unreachable | check the Temporal cluster |
| `alembic` or unknown column | migration not applied | rerun the migrations Job; rolling back one version is safe |

## A run stays Pending or never ends

Tell three cases apart: no node available (autoscaler or taints), a quota reached (raise it), or a pod
running with no event (the agent is stuck or the model does not answer; read the step logs). A run ends by
itself in almost every case: the budget cuts the session and the orchestrator retries. To force it:

```bash
choregos items action <work-item> stop
choregos items action <work-item> rerun_stage --top-up 5     # once the cause is fixed
```

With the `k8s_job` executor, a Job created suspended is waiting for a slot, not stuck.

## A ticket did not start

If the `agent-ready` label is on a ticket for minutes and nothing appears in Choregos, a webhook was probably
lost. A reconciliation loop per project re-reads the tracker every 60 seconds by default and creates what is
missing: waiting a minute settles most cases. To force it, signal the project's reconcile workflow
(`reconcile_now`) in Temporal; if the loop does not exist or stopped, restart the project's workers.

## A train is frozen

A train freezes when a person froze it or when a rollback froze it automatically (the platform refuses to
redeploy by reflex after an incident).

```bash
choregos trains status <project> --env prod
choregos trains unfreeze <project> --env prod        # after the cause is fixed
```

A critical finding with the evidence is created automatically on rollback. For an urgent fix, label the
ticket `hotfix` to use the express lane (shorter soak, its own approval).

## Rotating secrets

| Secret | Period | Effect of a failed rotation |
| :-- | :-- | :-- |
| GitHub App private key | 90 days | no webhooks, pull requests or run tokens |
| gateway master key | 90 days | no model call at all |
| run-token keys (ES256) | 30 days | runs in flight cannot post their result |
| webhook secrets | 180 days | webhooks rejected with 401 |
| connector secrets key (`secrets-keks`) | 365 days | none if rotated as below; losing it loses every sealed secret |

**Principle: two valid keys during the transition.** Run tokens live up to two hours, so a rotation in one go
breaks runs in flight; the API accepts two verification keys. To rotate `secrets-keks`, put the new key first,
redeploy, run `choregos admin secrets rewrap`, and drop the old key only once no database backup older than
the rewrap can still be restored. To rotate the session secret, move the old value to
`session-secret-previous`, set the new one, redeploy, and remove the old one after eight hours.

## Backups and restores

- **PostgreSQL**: restore point-in-time into a **new** cluster, never over the existing one. Stop writes first
  (scale the API and the workers to zero), note the target instant in UTC, restore, point the platform at the
  new cluster. Target objectives in the runbook are 5 minutes of data and 30 minutes of recovery.
- **Temporal** holds the position of every work item in flight; the runbook says what to copy, what a loss
  costs and how to reconcile afterwards.

## Retention and purges

| Data | Retention |
| :-- | :-- |
| runs (metadata, result) | indefinite |
| `run_events` (the run transcript) | 90 days |
| internal event bus | 180 days |
| cost ledger, audit log | indefinite |
| reports and context packs (object store) | 180 days (lifecycle) |
| received webhook events | 90 days |
| assistant conversations (0.26) | the installation's `retention_days`, purged daily |

## MCP sign-in does not work

For claude.ai or Claude Code over OAuth, the identity provider needs a client scope that adds the door's
audience to access tokens, optional `mcp:read` and `mcp:write` scopes, one client per kind of MCP client, and
`offline_access` as an optional scope of both clients (otherwise the whole request fails with
`invalid_scope`). See [MCP and integrations](integrations.md#when-it-does-not-connect).

## Assistants (0.26)

- **An installation is `incomplete`**: read its readiness list; each item names the missing binding or
  configuration key and who may fix it.
- **`account_not_connected` or `identity_unavailable`**: the person has not connected the account (send them
  the link) or the identity provider refused the exchange; check the exchange client's permissions towards the
  source's audience.
- **A delegation was suspended**: the person left the audience, or the manifest changed the needs the task
  reads and a new agreement is needed.
- **Knowledge proposals waiting** after a plugin upgrade: the owners decide each one; the assistant keeps
  working meanwhile.

## All runbooks

The repository holds the complete runbooks: train frozen, API 5xx, PostgreSQL restore, Ecphoria quorum,
secret rotation, Temporal upgrade and backup, purging runs, stuck run, lost webhook, node loss, Azure
Container Apps live check, MCP sign-in with Keycloak, MCP gateway down, live eval matrix, refreshing the
shipped catalogues, and bringing a tenant forward to English names.
[Browse them on GitHub](https://github.com/VargaFoundation/choregos/tree/main/docs/runbooks).
