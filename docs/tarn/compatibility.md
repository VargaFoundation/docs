---
id: compatibility
title: Compatibility
sidebar_position: 9
---

## Supported Platforms & Versions

| Component | Minimum Version | Notes |
|-----------|-----------------|-------|
| Hadoop/YARN | 3.3+ | Native Docker, Placement Constraints, GPU scheduling |
| Java | 17 | Application Master runtime |
| NVIDIA Triton Server | Any recent | Docker images (e.g., 24.09-py3 tested) |
| Docker | Latest | With NVIDIA Container Toolkit |
| ZooKeeper | Any stable | For Knox discovery |
| Apache Ranger | 2.0+ | For model authorization |
| Apache Knox | 1.6+ | HaProvider support |

## Enterprise Distributions
- **ODP (Clemlab)**: Supported via Maven repo override
- **Cloudera CDP**: Use matching `hadoop.version`

## Known Limitations
- **Storage**: HDFS/NFS only (no S3, local FS)
- **OS**: Linux NodeManagers (container-executor)
- **Networking**: AM must reach containers on ports
- **Multi-tenancy**: Relies on YARN queues/labels for isolation