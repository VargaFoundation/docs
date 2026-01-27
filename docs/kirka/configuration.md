---
id: configuration
title: Configuration
sidebar_position: 5
---

Kirka configuration is managed via `application.properties`. Customize before building or override at runtime with Spring Boot external config mechanisms (e.g., `--spring.config.location=/path/to/config/`).

## HBase and HDFS

```properties
# HBase Configuration
hbase.zookeeper.quorum=your-zookeeper-host
hbase.zookeeper.property.clientPort=2181

# HDFS Configuration
hadoop.hdfs.uri=hdfs://your-namenode-host:9000
```

## Kerberos (see [Security](./security.md))

Kerberos properties listed there.