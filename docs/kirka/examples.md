---
id: examples
title: Examples
sidebar_position: 7
---

Everything in this page assumes Kirka is reachable at `$MLFLOW_TRACKING_URI`. Set that
variable up front:

```bash
export MLFLOW_TRACKING_URI=https://kirka.example.com          # direct
# or via Knox:
export MLFLOW_TRACKING_URI=https://knox.example.com/gateway/default/kirka
export MLFLOW_TRACKING_USERNAME=alice
export MLFLOW_TRACKING_PASSWORD=...
```

## Python (official `mlflow` client)

```python
import mlflow
import os

mlflow.set_tracking_uri(os.environ["MLFLOW_TRACKING_URI"])

# Every standard MLflow operation works unchanged.
with mlflow.start_run(experiment_id="exp-42", run_name="baseline") as run:
    mlflow.log_param("learning_rate", 0.01)
    mlflow.log_metric("accuracy", 0.925, step=10)
    mlflow.log_metric("loss", 0.18, step=10)
    mlflow.log_artifact("model.pkl", artifact_path="model")

# Model registry
model_uri = f"runs:/{run.info.run_id}/model"
mlflow.register_model(model_uri, name="credit-scoring")
```

## Java (official `mlflow-client`)

```java
import org.mlflow.tracking.MlflowClient;

MlflowClient client = new MlflowClient(System.getenv("MLFLOW_TRACKING_URI"));
String experimentId = client.createExperiment("demo");
var run = client.createRun(experimentId);
client.logParam(run.getRunId(), "lr", "0.01");
client.logMetric(run.getRunId(), "acc", 0.92);
```

## Search filters

Kirka supports MLflow's filter DSL: conjunction-only, with `tags`, `params`, `metrics` and
`attributes` prefixes plus comparison, `LIKE`, `ILIKE`, `IN` and `NOT IN`.

```python
# Python — high-performing runs of the production experiment
runs = mlflow.search_runs(
    experiment_ids=["exp-42"],
    filter_string="metrics.accuracy > 0.9 AND tags.env = 'prod'"
)

# Runs that have NOT succeeded
dead = mlflow.search_runs(
    experiment_ids=["exp-42"],
    filter_string="attributes.status IN ('FAILED', 'KILLED')"
)

# Experiments by name prefix
exps = mlflow.search_experiments(filter_string="name LIKE 'nlp_%'")
```

## Model aliases (MLflow 2.6+)

```python
from mlflow import MlflowClient
client = MlflowClient()

# Promote version 3 of "credit-scoring" as the "champion"
client.set_registered_model_alias("credit-scoring", alias="champion", version=3)

# Resolve the alias to a pinned version
champion = client.get_model_version_by_alias("credit-scoring", "champion")

# Retire the alias
client.delete_registered_model_alias("credit-scoring", alias="champion")
```

## Log inputs (datasets, MLflow 2.4+)

```python
from mlflow.data.pandas_dataset import from_pandas

with mlflow.start_run() as run:
    ds = from_pandas(training_df, source="hdfs:///warehouse/credit/train.parquet",
                     name="credit-train-2026-q1")
    mlflow.log_input(ds, context="training")
```

## Get a model's artifact URI

```bash
curl -s "$MLFLOW_TRACKING_URI/api/2.0/mlflow/model-versions/get-download-uri?name=credit-scoring&version=3"
# {"artifact_uri": "hdfs:///warehouse/kirka/runs/abc123/model"}
```

## Pagination

Every `list` / `search` endpoint returns `next_page_token` when more data is available:

```bash
curl -s "$MLFLOW_TRACKING_URI/api/2.0/mlflow/experiments/list?max_results=1000" | jq .
```

Re-send the token:

```bash
TOKEN="eyJyb3ciOiJleHAtMjAyNi0wNC0yNC0xMjM0NX0="
curl -s "$MLFLOW_TRACKING_URI/api/2.0/mlflow/experiments/list?max_results=1000&page_token=$TOKEN"
```

## Audit trail (admin)

```bash
curl -u admin:... "$MLFLOW_TRACKING_URI/api/2.0/kirka/audit/search?max_results=50" | jq .
```

Sample response entry:

```json
{
  "event_id": "8f1c-...",
  "timestamp": 1703001234567,
  "user": "alice",
  "client_ip": "10.20.5.12",
  "action": "delete",
  "resource_type": "experiment",
  "resource_id": "exp-42",
  "outcome": "allowed",
  "reason": null,
  "request_id": "req-abc-123"
}
```

## GDPR hard-delete (admin)

```bash
curl -u admin:... -X POST "$MLFLOW_TRACKING_URI/api/2.0/kirka/gdpr/hard-delete" \
  -H "X-Kirka-Confirm-Hard-Delete: exp-42" \
  -H "Content-Type: application/json" \
  -d '{"resource_type": "experiment", "resource_id": "exp-42"}'
# {"resourceType":"experiment","resourceId":"exp-42","childRowsDeleted":37,"artifactPathsDeleted":38}
```

The `X-Kirka-Confirm-Hard-Delete` header must echo the `resource_id` verbatim — this
prevents accidental `curl` mistakes. Hard delete is irreversible; prefer the standard
soft-delete endpoints (`/experiments/delete`, `/runs/delete`, …) for everyday cleanup.

## Through Apache Knox

Deploy the service definition shipped under `knox/` in the source tree:

```bash
cp knox/service.xml knox/rewrite.xml $KNOX_HOME/data/services/kirka/0.0.1/
```

Topology snippet:

```xml
<service>
    <role>KIRKA</role>
    <url>http://kirka.kirka.svc.cluster.local:8080</url>
</service>
```

Knox then advertises the MLflow API at
`https://<knox>:<port>/gateway/<topology>/kirka/api/2.0/mlflow/...`, authenticating the
caller and forwarding the identity via `X-Forwarded-User`. Kirka accepts that header only
from the Knox IP (`security.trusted.proxies`).
