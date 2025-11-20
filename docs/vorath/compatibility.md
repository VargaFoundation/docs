---
id: compatibility
title: Version compatibility
sidebar_position: 2
---

This page lists recommended versions of Kubernetes, CSI components, and Hadoop/HDFS for this driver.

Important notes:

- The driver implements CSI Controller and Node services to expose HDFS as storage. It relies on standard CSI sidecars deployed via the Helm chart (provisioner, attacher, registrar, liveness).
- The versions below are common recommendations. Validate with your environment and test in pre-production.

Kubernetes:

- Recommended: 1.26 to 1.30
- Minimum: 1.24 (CSI GA, Storage API v1)
  - Ensure CSI Migration features do not interfere (defaults are fine in most clusters).

CSI Sidecars (examples compatible at the time of writing):

- csi-provisioner: 3.x
- csi-attacher: 4.x
- csi-node-driver-registrar: 2.x
- livenessprobe: 2.x

Hadoop/HDFS:

- Recommended: Hadoop 3.3.x to 3.4.x (HDFS)
- Community support likely: 3.2.x (not recommended for new deployments)
- Java 17 works with Hadoop ≥ 3.3 in most distributions.

Runtime:

- Java Runtime: Java 17
- Docker/OCI: 20.x+
- Helm: 3.x

OS/Network compatibility:

- Linux nodes x86_64 (amd64) tested. ARM64 may work depending on your Hadoop/Java images.
- HDFS RPC connections must be reachable from worker nodes.

Best practices:

- Align CSI sidecar versions with your Kubernetes version (see SIG Storage release notes).
- Confirm your Hadoop distribution (Apache, Cloudera, etc.) compatibility with Java 17 and your embedded client libraries.
