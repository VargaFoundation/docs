---
id: examples
title: Examples
sidebar_position: 10
---

This page provides ready-to-use YAML manifests to test the HDFS CSI driver.

Kerberos Secret (required for secured HDFS):

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

Dynamic provisioning (StorageClass + PVC + Pod):

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
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
mountOptions:
  - -o allow_other
  - --file-cache-timeout-in-seconds=120
  - --use-attr-cache=true
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data-hdfs
spec:
  accessModes: [ "ReadWriteMany" ]
  storageClassName: hdfs-sc
  resources:
    requests:
      storage: 5Gi
---
apiVersion: v1
kind: Pod
metadata:
  name: app-hdfs
spec:
  containers:
    - name: app
      image: busybox
      command: ["sh", "-c", "echo hello > /data/hello.txt && sleep 3600"]
      volumeMounts:
        - name: data
          mountPath: /data
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: data-hdfs
```

Static provisioning (PV + PVC + Pod):

Prepare a directory in HDFS (e.g., /datasets/team1) and ensure permissions are correct.

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: hdfs-pv-team1
spec:
  capacity:
    storage: 100Gi
  accessModes: ["ReadWriteMany"]
  csi:
    driver: hdfs.csi.varga
    volumeHandle: team1-dataset
    volumeAttributes:
      path: "/datasets/team1"
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pvc-team1
spec:
  accessModes: ["ReadWriteMany"]
  volumeName: hdfs-pv-team1
  resources:
    requests:
      storage: 50Gi
---
apiVersion: v1
kind: Pod
metadata:
  name: reader-team1
spec:
  containers:
    - name: reader
      image: busybox
      command: ["sh", "-c", "ls -l /data && sleep 3600"]
      volumeMounts:
        - name: data
          mountPath: /data
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: pvc-team1
```

Repository example directories:

- examples/dynamic-provisioning
- examples/static-provisioning

Usage:

```bash
kubectl apply -f <file.yaml>
kubectl get pvc,pv,pod
kubectl logs pod/<name> --tail=100
```
