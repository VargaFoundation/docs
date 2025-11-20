---
id: troubleshooting
title: Troubleshooting
sidebar_position: 7
---

Common symptoms, likely causes, and remediation steps.

Pod in CrashLoopBackOff:

- Check logs: `kubectl logs <pod> -n <ns> --previous`
- Common causes: missing HDFS variables, invalid image, insufficient Kubernetes permissions

Cannot connect to HDFS:

- Verify HDFS_URL and DNS resolution of the NameNode
- Test connectivity from a debug pod: `kubectl run -it debug --image=busybox --restart=Never -- nslookup namenode`
- Firewalls/NetworkPolicies: open required ports (NameNode/DataNodes)

Dynamic provisioning fails (PVC Pending):

- Ensure the StorageClass provisioner matches the driver
- Check events: `kubectl describe pvc <name>` and `kubectl describe sc <name>`
- Inspect logs of csi-provisioner and controller

Volume not mounted in the Pod:

- `kubectl describe pod <pod>` to see mount errors
- Check csi-node-driver-registrar and the Node service
- Validate HDFS permissions on the target path

HDFS permission errors:

- Confirm configured HDFS user (HDFS_USER)
- Adjust ACL/ownership on directories

Poor performance:

- Check network latency and bandwidth to HDFS
- Tune CPU/Memory requests/limits and Java GC if needed
- Avoid excessive small files (anti-pattern in HDFS)

Kerberos issues (secured clusters):

- Mount keytabs and krb5.conf via Secrets/volumes
- Validate ticket acquisition (kinit) in a debug pod

Information to collect:

- `kubectl get pods,svc,deploy,ds -n <ns>`
- `kubectl logs` of CSI sidecars (provisioner, attacher, livenessprobe)
- Kubernetes events and system metrics
