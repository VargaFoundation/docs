---
id: operations
title: Operations
sidebar_position: 6
---

Post-deployment checks:

- Pods: `kubectl get pods -n <namespace>`
- Logs: `kubectl logs <pod> -n <namespace> --tail=200`
- Events: `kubectl get events -n <namespace> --sort-by=.lastTimestamp`

Quick tests:

1) Create a StorageClass and a PVC (see “Configuration”), then mount the volume in a test Pod
2) Verify directory creation/permissions in HDFS for the volume

Logging and verbosity:

- Adjust log level via environment variables if supported by the image (e.g., LOG_LEVEL)
- Forward logs to your centralized stack

Metrics and liveness:

- CSI livenessprobe sidecar checks driver health
- Expose metrics (if enabled/added) to Prometheus via ServiceMonitor

Upgrades:

- Use `helm upgrade` with incremental changes
- Validate in staging before production

Backups/Restores:

- Data lives in HDFS; follow your HDFS backup procedures (HDFS snapshots if available, distcp, NameNode backups)
- Version Kubernetes manifests (chart and values) in Git

Monitoring and alerts:

- Monitor NameNode/DataNode availability, RPC latency, and authentication errors
- Alert on CSI pod crashloops, attachment/provisioning failures, and CSI error codes
