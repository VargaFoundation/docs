---
id: ranger-setup
title: Apache Ranger integration
sidebar_position: 8
---

Kirka delegates authorization to [Apache Ranger](https://ranger.apache.org/). Every API
call flows through a real `RangerBasePlugin` instance that fetches policies from Ranger
Admin and evaluates them locally, which means:

- Ranger Admin being temporarily unreachable does **not** break Kirka. The last cached
  policy set is reused until the next refresh succeeds.
- Access decisions are audited through Ranger's standard pipeline (Solr / HDFS / log4j,
  depending on `ranger-kirka-audit.xml`), alongside every other service in the Hadoop stack.
- Policies are authored in Ranger Admin exactly like they are for HDFS, Hive, HBase, etc.

When Ranger is not configured, Kirka falls back to **owner-only** authorization (the
creator of a resource retains access; everyone else is denied). There is no fallback to the
string-matching heuristics that earlier versions used — those have been removed.

## 1. Register the Kirka service definition

Import `src/main/resources/ranger/ranger-servicedef-kirka.json` once into Ranger Admin:

```bash
curl -u admin:${RANGER_ADMIN_PASSWORD} \
     -H "Content-Type: application/json" \
     -X POST http://<ranger-admin>:6080/service/plugins/definitions \
     -d @ranger-servicedef-kirka.json
```

The file defines six resource types (`experiment`, `run`, `model`, `gateway`, `scorer`,
`prompt`) and the access types Kirka evaluates at runtime (`read`, `write`, `delete`,
`admin`, with implied grants between them).

## 2. Create a Kirka service instance

In Ranger Admin → **Access Manager → Resource Based Policies → Add Service**, choose
`Kirka` (the service type defined above):

| Config                      | Value                                                        |
|-----------------------------|--------------------------------------------------------------|
| Service name                | `kirka` (must match `ranger.service.name` in Kirka)         |
| Kirka Service URL           | `http://<kirka-host>:8080`                                  |
| Admin Username / Password   | credentials the Ranger UI uses to browse resources (optional) |

## 3. Configure the Kirka side

Two files on Kirka's classpath drive the plugin:

- `src/main/resources/ranger/ranger-kirka-security.xml` — Ranger Admin URL, policy refresh
  interval, local cache directory, SSL.
- `src/main/resources/ranger/ranger-kirka-audit.xml` — audit destination (Solr / HDFS /
  log4j).

The application properties tuned most often:

```properties
security.enabled=true
security.authorization.owner.enabled=true    # owners always retain access to their resources
ranger.service.name=kirka
ranger.admin.url=http://ranger-admin:6080
ranger.policy.cache.dir=/var/lib/kirka/ranger-cache
```

In Helm the same values flow through `values.yaml` → ConfigMap → env vars. The
`ranger-kirka-security.xml` can be swapped for a Kubernetes Secret volume mount when
credentials need rotation.

## 4. Write policies

Ranger policies target `(resource-type, resource-id)` pairs:

- `experiment` / `exp-123` — a specific experiment.
- `experiment` / `*` — all experiments.
- `run` / `exp-123` — runs under a specific experiment (`run` is a child of `experiment`
  in the service-def).
- `model` / `credit-scoring` — a specific registered model.
- `gateway` / `openai-chat` — a specific gateway route.

Typical policy patterns:

- **Owner + team read**: allow `read` on `experiment:*` for group `risk-team`; deny on
  `experiment:credit-scoring` except for group `risk-lead`.
- **Production stage protection**: allow `transition` on `model:*` only for group
  `ml-platform`.
- **Gateway PII lockdown**: deny `invoke` on `gateway:openai-*` for group `intern`.

## 5. Verify end-to-end

```bash
# Kirka pod logs should show periodic successful policy refreshes
kubectl logs deploy/kirka | grep Ranger

# A denied request returns 403 in the MLflow error format
curl -u alice:... https://kirka.example.com/api/2.0/mlflow/experiments/get?experiment_id=exp-123
# -> {"error_code":"PERMISSION_DENIED","message":"...","request_id":"..."}
```

Policy decisions are recorded as audit events in Ranger's configured back-end. The Kirka
audit log (see [Audit log](./audit-log.md)) records what Kirka did, and the Ranger audit
records why it was allowed — both streams correlate on the same user and timestamp.

## What if Ranger is down?

- **At startup**, `RangerBasePlugin.init()` logs a warning and `isInitialized()` returns
  `false`. Every subsequent authorization check returns `false` (deny) unless the
  owner-only fallback kicks in.
- **At runtime**, once the plugin has successfully loaded a policy set at least once, it
  keeps evaluating against its local cache even if Ranger Admin goes offline. The refresh
  thread backs off and retries until Admin recovers.
