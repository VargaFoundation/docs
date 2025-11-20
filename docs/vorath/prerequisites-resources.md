---
id: prerequisites-resources
title: Prerequisites and resources
sidebar_position: 3
---

Technical prerequisites:

- Kubernetes: v1.24+ (recommended 1.26–1.30)
- Cluster access: kubectl configured with a valid context
- Helm 3.x
- Container registry (if you build/push your own image)
- HDFS reachable from Kubernetes worker nodes (open NameNode/DataNode ports)

HDFS prerequisites:

- HDFS URL (e.g., hdfs://namenode:8020)
- Dedicated HDFS service user (e.g., hdfs_csi) with appropriate ACL/permissions on target paths
- Quota/ACL policy aligned with your isolation requirements
- Kerberos environment if your HDFS is secured: a service principal and a keytab are required for this CSI driver

Minimum resources per driver pod:

- CPU: 100m–250m (controller), 50m–200m (node)
- Memory: 128Mi–512Mi depending on load/logging
- Ephemeral storage: 100Mi+ (logs, sidecars)

Network requirements and bandwidth recommendations:

- Stable, low-latency connectivity between K8s nodes and NameNode/DataNodes
- DNS resolution for NameNode(s)
- Open HDFS ports (commonly 8020/9000 for NameNode RPC; DataNode ports often 50010/50075/50475, depending on your distro)
- Throughput: at least 1 Gbps end-to-end for general-purpose workloads; 10 Gbps or higher recommended for data-intensive jobs
- Follow Hadoop client best practices: avoid excessive small files, batch I/O when possible, tune io.file.buffer.size, and size client thread pools appropriately for your workload

Storage and functionality notes:

- The driver exposes HDFS as a filesystem for workloads. It does not provide POSIX guarantees beyond HDFS semantics. Validate app compatibility (append semantics, file-level atomicity, rename patterns).

External components:

- Required CSI sidecars (deployed with the chart)
- Optional: centralized logging (ELK/OpenSearch), metrics (Prometheus)

Capabilities and limitations:

- Snapshots/clones: depend on your HDFS policies; not natively managed by the driver
- Volume expansion: logically supported via parameters; verify against your HDFS governance and quotas
