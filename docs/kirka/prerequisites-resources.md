---
id: prerequisites-resources
title: Prerequisites and resources
sidebar_position: 3
---

## Host and JVM

- Java 17 (any OpenJDK distribution; `eclipse-temurin:17-jre-jammy` is the base image used
  by the official Docker build).
- Maven 3.9+ for source builds.

## Backend services

| Service        | Version | Notes                                                          |
|----------------|---------|----------------------------------------------------------------|
| Apache HBase   | 2.5.x   | ZooKeeper quorum reachable from the pod                        |
| Apache Hadoop  | 3.3.x   | HDFS namenode for artifact storage                             |
| Apache Ranger  | 2.4.x   | Optional but recommended; see [Ranger setup](./ranger-setup.md) |
| Apache Knox    | latest  | Optional, for auth + routing in front of Kirka                 |

The service account running Kirka needs:

- HBase: permission to read and write the tables listed in
  [Installation and deployment](./installation-deployment.md#hbase-tables).
- HDFS: write permission on the tree referenced by experiment `artifact_location` values
  (defaults to the run's `artifact_uri`).
- Ranger Admin: the HTTP client credentials configured in `ranger-kirka-security.xml`.

## Optional

- Kerberos KDC + service principal + keytab (see [Security](./security.md)).
- Prometheus + Grafana for the shipped observability bundle
  (see [Observability](./observability.md)).
- Apache Solr or Ranger-managed HDFS path for the Ranger audit sink.

## Resource sizing

A single Kirka replica handles roughly 1 k requests/s of read-heavy MLflow traffic on:

- **CPU**: 1-2 cores baseline, burst to 4 during backfills.
- **Memory**: 2 GB heap for workloads up to 10 M runs; 4 GB for 100 M runs with wide
  metric history scans.
- **Network**: primarily HBase RPC (several MB/s at peak); egress to HDFS for artifact
  reads can spike when clients download model tarballs.
- **Ephemeral storage**: 100 MB — Kirka writes nothing but logs and temp multipart files.

The default Helm values (`resources.requests: cpu 500m / memory 512Mi`, `limits: cpu 1 /
memory 1Gi`) fit small to medium clusters; scale horizontally with the shipped HPA
template (`autoscaling.enabled=true`) for larger footprints.
