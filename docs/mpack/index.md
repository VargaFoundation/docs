---
id: index
title: Ambari Mpack Overview
sidebar_position: 1
---

The Varga Management Pack (Mpack) for Apache Ambari allows you to easily deploy and manage Kirka and Tarn services on a Hadoop cluster.

## Included Services

- **Kirka**: MLFlow compatible tracking service using HBase and HDFS.
- **Tarn**: Distributed model serving system running on YARN.

## Key Features

- **Automated Lifecycle Management**: Start, stop, and monitor Kirka and Tarn through the Ambari UI.
- **Centralized Configuration**: Manage all service parameters (ports, HDFS paths, security settings) in one place.
- **Kerberos Integration**: Automatic identity and keytab management for secure clusters.
- **Ranger Integration**: Easy configuration for Apache Ranger authorization.
- **Self-contained Bundle**: The Mpack includes the necessary JAR files for deployment.

## Next Steps

- [Building the Mpack](./build.md)
- [Deployment Guide](./deployment.md)
