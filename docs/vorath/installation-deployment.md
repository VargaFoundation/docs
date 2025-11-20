---
id: installation-deployment
title: Installation and deployment
sidebar_position: 4
---

This page describes how to install the HDFS CSI driver on Kubernetes using Helm. You can use published images or build
and push your own image.

Prerequisites:

- Helm 3.x and kubectl configured
- Access to a container registry if you publish a custom image
- Known HDFS settings (URL, user) and Kerberos artifacts if applicable (service principal and keytab)

1) Optional: build the Docker image

If you want to build from sources:

```bash
docker build -t <your-registry>/hdfs-csi-plugin:latest .
docker push <your-registry>/hdfs-csi-plugin:latest
```

2) Prepare your Helm values

Create a custom values file (e.g., values.override.yaml):

```yaml
hdfs:
  url: "hdfs://namenode:8020"
  user: "hdfs_csi"

image:
  repository: <your-registry>/hdfs-csi-plugin
  tag: latest
```

3) Install

From the repository root (where the chart is located):

```bash
helm upgrade --install hdfs-csi-plugin ./hdfs-csi-plugin -n default -f values.override.yaml
```

Resources deployed (depending on the chart):

- ConfigMap/Secret for HDFS and Kerberos configuration
- Deployment/DaemonSet for Controller and Node components
+- Required CSI sidecars (provisioner, attacher, registrar, liveness)

4) Verify

```bash
kubectl get pods -n default
kubectl logs deploy/hdfs-csi-plugin -n default --tail=200
```

5) Upgrade

Update your values then run:

```bash
helm upgrade hdfs-csi-plugin ./hdfs-csi-plugin -n default -f values.override.yaml
```

6) Rollback

```bash
helm history hdfs-csi-plugin -n default
helm rollback hdfs-csi-plugin <REVISION> -n default
```

7) Uninstall

```bash
helm uninstall hdfs-csi-plugin -n default
```

Deployment best practices:

- Use a dedicated namespace (e.g., storage)
- Set CPU/Memory requests and limits on the driver and sidecars
- Version your values files and deploy via CI/CD
- Validate in staging connected to a test HDFS cluster before production
