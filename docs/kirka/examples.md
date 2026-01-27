---
id: examples
title: Examples
sidebar_position: 7
---

Kirka can be exposed through Apache Knox to provide a single point of entry, authentication, and service discovery.

### 1. Service Definition

Add the files in the `knox/` directory to your Knox installation (assuming provided in source):
- Copy `knox/service.xml` and `knox/rewrite.xml` to `{KNOX_HOME}/data/services/kirka/0.0.1/`

### 2. Topology Configuration

Add to your Knox topology file (e.g., `default.xml`):

```xml
<service>
    <role>KIRKA</role>
    <url>http://{kirka-host}:{kirka-port}</url>
</service>
```

### 3. Accessing Kirka via Knox

Tracking URI: `https://<knox-host>:<knox-port>/gateway/<topology-name>/kirka`

#### Python Example

```python
import mlflow
import os

# Set tracking URI via Knox
knox_uri = "https://knox-gateway:8443/gateway/sandbox/kirka"
mlflow.set_tracking_uri(knox_uri)

# Knox Basic Auth (if enabled)
os.environ['MLFLOW_TRACKING_USERNAME'] = 'your_username'
os.environ['MLFLOW_TRACKING_PASSWORD'] = 'your_password'

# Skip SSL if self-signed
os.environ['MLFLOW_TRACKING_INSECURE_TLS'] = 'true'

# Usage
with mlflow.start_run():
    mlflow.log_param("param1", 5)
    mlflow.log_metric("foo", 1.0)
```

#### Environment Variables

```bash
export MLFLOW_TRACKING_URI=https://knox-gateway:8443/gateway/sandbox/kirka
export MLFLOW_TRACKING_USERNAME=admin
export MLFLOW_TRACKING_PASSWORD=admin-password
export MLFLOW_TRACKING_INSECURE_TLS=true
```

## Direct Usage Example

Set `MLFLOW_TRACKING_URI=http://kirka-host:8080` and use standard MLflow clients.