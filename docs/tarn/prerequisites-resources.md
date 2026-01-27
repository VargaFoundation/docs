---
id: prerequisites-resources
title: Prerequisites & Resources
sidebar_position: 2
---

## Prerequisites

### 1. Hadoop Cluster Requirements
- **Hadoop 3.3+**: Required for native Docker support and Placement Constraints.
- **YARN Docker Runtime**: Must be enabled and configured on all NodeManagers.
  - In `yarn-site.xml`, ensure `yarn.nodemanager.container-executor.class` is set to `org.apache.hadoop.yarn.server.nodemanager.LinuxContainerExecutor`.
  - Docker must be an allowed runtime: `yarn.nodemanager.runtime.linux.allowed-runtimes` should include `docker`.
  - The Triton image must be whitelisted in `yarn-site.xml` (`yarn.nodemanager.runtime.linux.docker.allowed-container-networks` and associated registries).
- **Linux Container Executor**: Requires a properly configured `container-executor.cfg` on all nodes, with a `[docker]` section defined.

### 2. GPU and NVIDIA Environment
- **NVIDIA Drivers**: Installed on all NodeManagers hosting GPUs.
- **NVIDIA Container Toolkit**: Installed and configured as the default runtime for Docker on NodeManagers.
- **YARN GPU Scheduling**:
  - `yarn.io/gpu` must be defined as a resource type in `resource-types.xml`.
  - The `DominantResourceCalculator` must be used in the scheduler configuration (e.g., `capacity-scheduler.xml`).
  - NodeManagers must be configured to discover and report GPUs (using `yarn.nodemanager.resource-plugins` and `yarn.nodemanager.resource-plugins.gpu.path-to-discovery-executables`).

### 3. Development and Runtime Tools
- **Java 17**: Required for building and running the Application Master.
- **Maven**: For building the project.
- **socat**: Required on the node running the HAProxy update script (if using Option 2).
- **ZooKeeper**: Required for service registration and Knox discovery (if using Option 1 - Recommended).

### 4. Network and Permissions
- **Connectivity**: The Application Master must be able to reach NodeManagers on the Triton HTTP/GRPC ports and metrics ports.
- **Permissions**: The user submitting the YARN application must have permissions to launch Docker containers via the Linux Container Executor.