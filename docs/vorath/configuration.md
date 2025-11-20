---
id: configuration
title: Configuration
sidebar_position: 5
---

The driver reads its configuration from environment variables and/or a ConfigMap/Secret injected via Helm.

Core parameters (env):

- HDFS_URL: NameNode URL (e.g., hdfs://namenode:8020)
- HDFS_USER: HDFS user the driver will use

Example Helm overrides (values.override.yaml):

```yaml
hdfs:
  url: "hdfs://namenode:8020"
  user: "hdfs_csi"

image:
  repository: <your-registry>/hdfs-csi-plugin
  tag: latest
```

Secrets and sensitive data:

- If your HDFS is secured with Kerberos, you must provide: a service principal and its keytab, plus Hadoop client configs (core-site.xml, hdfs-site.xml). Store them as a Kubernetes Secret and mount or reference them from the driver. See examples under examples/dynamic-provisioning/hdfs-secret.yaml and examples/static-provisioning/hdfs-secret.yaml.

Dynamic provisioning:

- Create a StorageClass that references the CSI provisioner and optional parameters.
- Point the StorageClass to your HDFS endpoint and secret with Kerberos materials when needed.

StorageClass example aligned with examples/dynamic-provisioning/hdfs-sc.yaml:

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: hdfs-sc
provisioner: hdfs.csi.varga
parameters:
  location: "hdfs://<namenode-host>:<port>"
  secretName: "hdfs-secret"
  secretNamespace: "expense"
reclaimPolicy: Delete # or Retain
volumeBindingMode: WaitForFirstConsumer # or Immediate
mountOptions:
  - -o allow_other
  - --file-cache-timeout-in-seconds=120
  - --use-attr-cache=true
```

PVC example using this StorageClass:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data-hdfs
spec:
  accessModes: [ "ReadWriteMany" ]
  storageClassName: hdfs-sc
  resources:
    requests:
      storage: 10Gi
```

Static provisioning:

- Pre-create the target directory in HDFS with correct permissions.
- Create a PersistentVolume that points to that HDFS path, then a PVC that binds to the PV.
- See a full example in docs/examples and under examples/static-provisioning.

Kerberos Secret example (required in secured clusters):

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: hdfs-secret
  namespace: expense
type: Opaque
data:
  principal: <BASE64_ENCODED_PRINCIPAL>
  keytab: <BASE64_ENCODED_KEYTAB_FILE>
  core-site.xml: <BASE64_ENCODED_CORE_SITE_XML>
  hdfs-site.xml: <BASE64_ENCODED_HDFS_SITE_XML>
```

Note: base64-encode the raw files/values before placing them in data. Ensure your ServiceAccount has access to read this Secret.
