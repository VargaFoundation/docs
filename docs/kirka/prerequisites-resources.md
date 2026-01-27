---
id: prerequisites-resources
title: Prerequisites and resources
sidebar_position: 3
---

## Technical prerequisites

- Java 17
- Maven 3.6+

## Backend prerequisites

- Apache HBase 2.5.x (with Zookeeper quorum accessible)
- Apache Hadoop 3.3.x (HDFS Namenode accessible)
- HBase table creation permissions for the service user
- HDFS write permissions on artifact storage path

## Security (optional)

- Kerberos KDC for secure clusters
- Service principal and keytab for Kirka

## Resources

- CPU: 1-2 cores depending on concurrent runs
- Memory: 2-4 GB heap recommended for production
- Disk: Minimal, as artifacts on HDFS; temp space for processing