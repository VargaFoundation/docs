---
id: installation-deployment
title: Installation and deployment
sidebar_position: 4
---

## Build from source

```bash
mvn clean package
```

The fat JAR is produced under `target/kirka-*.jar`. Tests run with
`mvn test -Dtest='!*IntegrationTest'` (skip the HBase/HDFS mini-clusters); the full suite
including `MLFlowE2EIntegrationTest` needs a Linux host with enough resources to spin up
an HBase + HDFS mini-cluster.

## Run directly

```bash
mvn spring-boot:run
# or
java -jar target/kirka-*.jar --spring.config.location=/etc/kirka/
```

Recommended JVM options at scale: `-Xmx4g -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError`.

## Docker

The shipped Dockerfile is a three-stage build (`deps` → `build` → `runtime`) with Buildkit
layer caching, runs as non-root UID 10001 and adds a curl-based HEALTHCHECK.

```bash
docker build -t kirka:local .
docker run --rm -p 8080:8080 \
  -v /path/to/users.htpasswd:/etc/kirka/users.htpasswd:ro \
  ghcr.io/varga-foundation/kirka:latest
```

Pre-built images are pushed to GitHub Container Registry on every merge to `main`:

```bash
docker pull ghcr.io/varga-foundation/kirka:latest
```

Images are signed with Cosign (keyless OIDC); verify with:

```bash
cosign verify --certificate-identity-regexp 'https://github.com/varga-foundation/.+' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  ghcr.io/varga-foundation/kirka:latest
```

## Kubernetes (Helm)

```bash
helm install kirka oci://ghcr.io/varga-foundation/charts/kirka --version 1.0.0 \
  --namespace kirka --create-namespace \
  --set config.hbaseZookeeperQuorum=zk1:2181 \
  --set config.hdfsUri=hdfs://namenode:9000
```

Or install from local sources:

```bash
helm install kirka ./helm -n kirka --create-namespace
```

The chart produces:

- `Deployment` with two replicas (non-root, read-only root FS, seccomp RuntimeDefault).
- `Service` (ClusterIP).
- `ConfigMap` for the env-var surface.
- `PodDisruptionBudget` with `minAvailable: 1` (tunable).
- Optional `HorizontalPodAutoscaler` (`autoscaling.enabled=true`).
- Optional `Ingress` (`ingress.enabled=true`, works with cert-manager).
- Optional `NetworkPolicy` (`networkPolicy.enabled=true`).
- Optional `ServiceMonitor` for Prometheus Operator (`serviceMonitor.enabled=true`).
- Optional `Secret` for the bcrypt htpasswd when `basicAuth.create=true`.

### Minimal production values

```yaml
replicaCount: 3

image:
  repository: ghcr.io/varga-foundation/kirka
  # tag defaults to .Chart.AppVersion for reproducibility — override to pin a SHA
  pullPolicy: IfNotPresent

config:
  hbaseZookeeperQuorum: "zk1:2181,zk2:2181,zk3:2181"
  hdfsUri: "hdfs://namenode:9000"
  securityEnabled: "true"
  securityAuthType: "basic"
  securityUsersFile: "/etc/kirka/users.htpasswd"
  securityTrustedProxies: "10.20.0.0/16"
  kirkaApiNaming: "snake_case"
  rangerServiceName: "kirka"
  rangerAdminUrl: "http://ranger-admin:6080"

basicAuth:
  create: true
  htpasswd: |
    alice:$2a$10$xxxxxxxxxxxxxxxxxxxxxx

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 6
  targetCPUUtilizationPercentage: 70

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: kirka.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - hosts: [kirka.example.com]
      secretName: kirka-tls

networkPolicy:
  enabled: true

serviceMonitor:
  enabled: true
  labels:
    release: kube-prometheus-stack
```

Apply with `-f values.override.yaml`:

```bash
helm install kirka oci://ghcr.io/varga-foundation/charts/kirka --version 1.0.0 \
  -f values.override.yaml -n kirka --create-namespace
```

### Verify

```bash
kubectl get pods -n kirka
kubectl port-forward svc/kirka 8080:8080 -n kirka
curl -f http://localhost:8080/actuator/health
curl -f http://localhost:8080/actuator/prometheus
curl -f http://localhost:8080/v3/api-docs         # OpenAPI schema
```

### Upgrade and uninstall

```bash
helm upgrade kirka oci://ghcr.io/varga-foundation/charts/kirka --version 1.1.0 \
  -f values.override.yaml -n kirka

helm uninstall kirka -n kirka
```

Because `replicaCount` default is 2 and the chart ships a `PodDisruptionBudget` with
`minAvailable: 1`, a rolling upgrade never drops the API offline.

## HBase tables

Kirka expects these tables to exist; create them once before first start:

```
create 'mlflow_experiments', 'info', 'tags'
create 'mlflow_experiments_name_index', 'info'
create 'mlflow_runs', 'info', 'params', 'metrics', 'tags', 'inputs'
create 'mlflow_metric_history', 'info'
create 'mlflow_registered_models', 'info', 'tags', 'aliases'
create 'mlflow_model_versions', 'info', 'tags'
create 'mlflow_prompts', 'info'
create 'mlflow_scorers', 'info'
create 'mlflow_gateway_routes', 'info'
create 'mlflow_gateway_secrets', 'info'
create 'mlflow_gateway_endpoints', 'info'
create 'mlflow_audit', {NAME => 'info', VERSIONS => 1, TTL => 7776000}  # 90 days
```

A Helm hook (pre-install Job) doing this is on the roadmap; in the meantime the CLI above
is idempotent.

## CI/CD

GitHub Actions automatically:

1. Runs the Maven test suite (non-integration tiers).
2. Builds the Docker image, scans it with Trivy, generates an SBOM (SPDX via syft), and
   pushes to `ghcr.io/varga-foundation/kirka`.
3. Signs the image with Cosign (keyless OIDC).
4. Lints and packages the Helm chart, pushes to `oci://ghcr.io/varga-foundation/charts/kirka`.

Triggers: push and pull requests targeting `main` / `master`, or manual workflow dispatch.

## Production deployment on bare metal

When Kubernetes is not an option:

- Run as a `systemd` service or inside a process manager (`supervisord`, `runit`).
- Point `--spring.config.location=/etc/kirka/` at an externalised configuration directory.
- Expose behind a TLS-terminating reverse proxy (HAProxy, Nginx, Envoy) or directly via
  Apache Knox (see [Examples](./examples.md#through-apache-knox)).
- Tune JVM: `-Xmx4g -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError` at minimum.
- Wire logs to the host's journald / rsyslog and rotate; `SPRING_PROFILES_ACTIVE=prod`
  switches the app to JSON output for log-shipping friendliness.
