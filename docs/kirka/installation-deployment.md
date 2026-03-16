---
id: installation-deployment
title: Installation and deployment
sidebar_position: 4
---

## Building the project

```bash
mvn clean package
```

The resulting JAR will be located in the `target/` directory (`kirka-<version>.jar`).

## Running the application

Run with Maven:

```bash
mvn spring-boot:run
```

Or directly:

```bash
java -jar target/kirka-*.jar
```

## Docker

The Docker image is automatically built and published to GitHub Container Registry on every push to `main`.

Pull the pre-built image:

```bash
docker pull ghcr.io/varga-foundation/kirka:latest
```

Or build from source:

```bash
docker build -t kirka:latest .
docker run -p 8080:8080 kirka:latest
```

## Deployment on Kubernetes (Helm)

Kirka is distributed as a Helm chart via an OCI registry on GitHub Container Registry.

### Install from the registry

```bash
helm install kirka oci://ghcr.io/varga-foundation/charts/kirka --version 1.0.0 \
  --namespace kirka --create-namespace \
  --set config.hbaseZookeeperQuorum=zk1:2181 \
  --set config.hdfsUri=hdfs://namenode:9000
```

### Install from local sources

```bash
helm install kirka ./helm -n kirka --create-namespace
```

### Helm values

Create a `values.override.yaml` to customize the deployment:

```yaml
replicaCount: 2

config:
  hbaseZookeeperQuorum: "zk1:2181,zk2:2181,zk3:2181"
  hbaseZookeeperPort: "2181"
  hdfsUri: "hdfs://namenode:9000"
  securityEnabled: "true"
  securityAuthType: "kerberos"
  kerberosEnabled: "true"
  kerberosPrincipal: "kirka/host@REALM.COM"
  kerberosKeytab: "/etc/security/keytabs/kirka.keytab"
  rangerServiceName: "kirka"
  rangerAdminUrl: "http://ranger:6080"

resources:
  limits:
    memory: "2Gi"
    cpu: "2000m"
  requests:
    memory: "1Gi"
    cpu: "1000m"
```

Then install:

```bash
helm install kirka oci://ghcr.io/varga-foundation/charts/kirka --version 1.0.0 \
  -f values.override.yaml -n kirka --create-namespace
```

### Verify

```bash
kubectl get pods -n kirka
kubectl port-forward svc/kirka 8080:8080 -n kirka
curl http://localhost:8080/actuator/health
curl http://localhost:8080/actuator/prometheus
```

### Upgrade

```bash
helm upgrade kirka oci://ghcr.io/varga-foundation/charts/kirka --version 1.1.0 \
  -f values.override.yaml -n kirka
```

### Uninstall

```bash
helm uninstall kirka -n kirka
```

## CI/CD

GitHub Actions automatically:
1. Builds the Maven project and runs tests.
2. Builds and pushes the Docker image to `ghcr.io/varga-foundation/kirka`.
3. Packages and pushes the Helm chart to `oci://ghcr.io/varga-foundation/charts/kirka`.

Triggers: push/PR to `main`/`master`, or manual workflow dispatch.

## Production deployment (bare metal)

- Deploy as a systemd service or container (Docker/Kubernetes).
- Ensure JVM options: `-Xmx2g -XX:+UseG1GC` or similar.
- Use process manager (systemd, supervisord) for restarts.
- Expose via load balancer or Knox gateway (see [Examples](./examples.md)).