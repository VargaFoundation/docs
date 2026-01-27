---
id: compatibility
title: Compatibility
sidebar_position: 2
---

## Tested Versions

| Component | Version |
|-----------|---------|
| Java | 17+ |
| Maven | 3.6+ |
| HBase | 2.5.x |
| Hadoop/HDFS | 3.3.x |
| MLflow Client | 2.0+ (REST API v2.0) |

## Supported MLFlow API Routes

### Experiments
- `POST /api/2.0/mlflow/experiments/create`
- `GET /api/2.0/mlflow/experiments/get`
- `GET /api/2.0/mlflow/experiments/get-by-name`
- `GET /api/2.0/mlflow/experiments/list`
- `GET /api/2.0/mlflow/experiments/search`
- `POST /api/2.0/mlflow/experiments/update`
- `POST /api/2.0/mlflow/experiments/delete`
- `POST /api/2.0/mlflow/experiments/restore`
- `POST /api/2.0/mlflow/experiments/set-experiment-tag`

### Runs
- `POST /api/2.0/mlflow/runs/create`
- `GET /api/2.0/mlflow/runs/get`
- `POST /api/2.0/mlflow/runs/update`
- `POST /api/2.0/mlflow/runs/delete`
- `POST /api/2.0/mlflow/runs/restore`
- `POST /api/2.0/mlflow/runs/search`
- `POST /api/2.0/mlflow/runs/log-parameter`
- `POST /api/2.0/mlflow/runs/log-metric`
- `POST /api/2.0/mlflow/runs/log-batch`
- `POST /api/2.0/mlflow/runs/set-tag`
- `POST /api/2.0/mlflow/runs/delete-tag`
- `GET /api/2.0/mlflow/runs/get-metric-history`

### Artifacts
- `GET /api/2.0/mlflow/artifacts/list`
- `POST /api/2.0/mlflow/artifacts/upload`
- `GET /api/2.0/mlflow/artifacts/download`

### Model Registry
- `POST /api/2.0/mlflow/registered-models/create`
- `GET /api/2.0/mlflow/registered-models/get`
- `GET /api/2.0/mlflow/registered-models/list`
- `GET /api/2.0/mlflow/registered-models/search`
- `POST /api/2.0/mlflow/registered-models/update`
- `POST /api/2.0/mlflow/registered-models/delete`
- `POST /api/2.0/mlflow/model-versions/create`
- `GET /api/2.0/mlflow/model-versions/get`
- `POST /api/2.0/mlflow/model-versions/update`
- `POST /api/2.0/mlflow/model-versions/delete`
- `POST /api/2.0/mlflow/model-versions/transition-stage`

Note: Full list as per MLflow v2.0 tracking server subset.