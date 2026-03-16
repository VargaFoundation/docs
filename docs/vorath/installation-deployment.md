---
id: installation-deployment
title: Installation and deployment
sidebar_position: 4
---

This page describes how to install the HDFS CSI driver on Kubernetes using Helm.

Prerequisites:

- Helm 3.x and kubectl configured
- Known HDFS settings (URL, user) and Kerberos artifacts if applicable (service principal and keytab)

## Docker image

The Docker image is automatically built and published to GitHub Container Registry on every push to `main`:

```bash
docker pull ghcr.io/varga-foundation/vorath:latest
```

To build from source:

```bash
docker build -t vorath:latest .
```

## Install from the OCI registry

The Helm chart is published to GitHub Container Registry as an OCI artifact.

```bash
helm install vorath oci://ghcr.io/varga-foundation/charts/hdfs-csi-plugin --version 1.0.0 \
  --namespace vorath --create-namespace
```

## Install from local sources

```bash
helm install vorath ./kubernetes -n vorath --create-namespace
```

## Configuration

Create a custom values file (e.g., `values.override.yaml`):

```yaml
hdfs:
  url: "hdfs://namenode:8020"
  user: "hdfs_csi"

image:
  repository: ghcr.io/varga-foundation/vorath
  tag: latest

resources:
  limits:
    memory: "512Mi"
    cpu: "500m"
  requests:
    memory: "256Mi"
    cpu: "250m"
```

Then install with overrides:

```bash
helm install vorath oci://ghcr.io/varga-foundation/charts/hdfs-csi-plugin --version 1.0.0 \
  -f values.override.yaml -n vorath --create-namespace
```

Resources deployed:

- `ConfigMap` for HDFS configuration
- `DaemonSet` for the CSI plugin pods
- `Service` for the plugin
- `CSIDriver` registration
- RBAC resources (ClusterRole, ClusterRoleBinding, ServiceAccount)

## Verify

```bash
kubectl get pods -n vorath
kubectl get csidrivers.storage.k8s.io
kubectl logs -l app=hdfs-csi-plugin -n vorath
```

## Upgrade

```bash
helm upgrade vorath oci://ghcr.io/varga-foundation/charts/hdfs-csi-plugin --version 1.1.0 \
  -f values.override.yaml -n vorath
```

## Rollback

```bash
helm history vorath -n vorath
helm rollback vorath <REVISION> -n vorath
```

## Uninstall

```bash
helm uninstall vorath -n vorath
```

## CI/CD

GitHub Actions automatically:
1. Builds the Maven project and runs tests.
2. Builds and pushes the Docker image to `ghcr.io/varga-foundation/vorath`.
3. Packages and pushes the Helm chart to `oci://ghcr.io/varga-foundation/charts/hdfs-csi-plugin`.

Triggers: push/PR to `main`/`master`, or manual workflow dispatch.

## Deployment best practices

- Use a dedicated namespace (e.g., `vorath` or `storage`)
- Set CPU/Memory requests and limits on the driver and sidecars
- Version your values files and deploy via CI/CD
- Validate in staging connected to a test HDFS cluster before production
