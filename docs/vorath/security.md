---
id: security
title: Security and best practices
sidebar_position: 8
---

General principles:

- Least privilege for Kubernetes ServiceAccounts (minimal RBAC)
- Network isolation with NetworkPolicies when needed
- Manage HDFS/Kerberos material via Kubernetes Secrets

ServiceAccount is required:

- The CSI driver must run with a dedicated ServiceAccount. Ensure it has permissions to read the Kerberos Secret if your HDFS is secured.

Minimal RBAC (illustrative):

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: hdfs-csi
  namespace: storage
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: hdfs-csi-role
rules:
  - apiGroups: [""]
    resources: ["pods", "secrets"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["storage.k8s.io"]
    resources: ["volumeattachments", "storageclasses"]
    verbs: ["get", "list", "watch", "update"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: hdfs-csi-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: hdfs-csi-role
subjects:
  - kind: ServiceAccount
    name: hdfs-csi
    namespace: storage
```

Secret management:

- Store sensitive materials (keytabs, passwords) in a Secret
- Mount them as readOnly volumes and restrict access with RBAC
- Consider enabling encryption at rest for Secrets (KMS provider)

Images and supply chain:

- Use minimal, scanned images (trivy/grype)
- Sign images (Cosign) and enforce admission policies (Policy Controller/Kyverno)

Network:

- Restrict egress from driver pods to HDFS hosts only
- Monitor and log connections to NameNode/DataNodes

Logging and retention:

- Avoid logging secrets
- Set retention according to internal policies
