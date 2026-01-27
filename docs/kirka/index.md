---
id: index
title: Kirka — MLflow-compatible service for Hadoop
sidebar_position: 1
---

Kirka is an MLFlow compatible service optimized for the Hadoop ecosystem. It uses HDFS for artifact storage and HBase for metadata and metrics tracking.

## Features

- **MLFlow API Compatibility**: Supports standard MLFlow clients (Python, Java, R).
- **HBase Backend**: High-scalability tracking for experiments, runs, parameters, and metrics.
- **HDFS Artifact Storage**: Native storage for models, logs, and plots.
- **Kerberos Security**: Optional Kerberos authentication for secure Hadoop clusters.

## Project Structure

- `groupId`: `varga.foundation`
- `artifactId`: `kirka`
- `package`: `varga.kirka`

## What you'll find here

- [Prerequisites and resources](./prerequisites-resources.md)
- [Installation and deployment](./installation-deployment.md)
- [Configuration](./configuration.md)
- [Examples](./examples.md)
- [Security](./security.md)
- [Operations](./operations.md)
- [Compatibility](./compatibility.md)
- [FAQ](./faq.md)
- [Troubleshooting](./troubleshooting.md)

Make MLflow tracking seamless in Hadoop environments, leveraging HDFS and HBase for scalable ML experiment management.