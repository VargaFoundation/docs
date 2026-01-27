---
id: index
title: TARN — Triton on YARN
sidebar_position: 1
---

TARN is a scalable inference solution for running NVIDIA Triton Inference Server on a Hadoop/YARN cluster using Docker containers.

## Architecture

```mermaid
graph TB
    %% Client
    Client[Client]

    %% Perimeter Security & LB
    subgraph Perimeter ["Secure Gateway"]
        HA[HAProxy Instance]
        Knox[Apache Knox Gateway]
        Updater[HAProxy Updater Script]
    end

    %% ZooKeeper
    ZK((ZooKeeper))

    %% YARN Cluster
    subgraph YARN ["YARN Cluster"]
        RM[Resource Manager]

        subgraph NM1 ["Node Manager 1"]
            AM[Application Master]
        end

        subgraph NM2 ["Node Manager 2"]
            TC1[Triton Container 1
GPU Allocated]
            NFS1[HDFS NFS Gateway 1]
        end

        subgraph NM3 ["Node Manager 3"]
            TC2[Triton Container 2
GPU Allocated]
            NFS2[HDFS NFS Gateway 1]
        end

        TC1 -->|3. Load model| NFS1
        TC2 -->|3. Load model| NFS2
    end

    %% HDFS
    subgraph HDFS ["HDFS"]
        NN[NameNode]
        DN[DataNode]
    end

    %% Connexions principales (flux vertical)
    Client -->|Inference Request| HA
    Client -->|Secure Inference Request| Knox
    HA -->|Load Balances| TC1
    HA -->|Load Balances| TC2
    Knox -->|Dynamic LB via ZK| TC1
    Knox -->|Dynamic LB via ZK| TC2

    %% Interactions YARN
    AM -.->|1. Request Resources| RM
    RM -.->|2. Allocate Containers| NM2
    RM -.->|2. Allocate Containers| NM3

    %% ZooKeeper Registration
    AM -.->|Register Instances| ZK
    Knox -.->|Discover Instances| ZK

    %% Découverte et mise à jour HAProxy
    Updater -.->|4. Discover AM| RM
    Updater -->|5. Query Instances| AM
    Updater -->|6. Update backend servers
list via Runtime API| HA

    %% Accès HDFS via NFS Gateway
    NFS1 -.-> NN
    NFS2 -.-> NN
    NFS1 --> DN
    NFS2 --> DN

    %% Style pour forcer l'empilement vertical
    classDef cluster fill:#2d2d2d,stroke:#444,color:#fff;
    class Perimeter,YARN,HDFS cluster;
```

## What you'll find here

- Prerequisites and cluster sizing
- Building and deploying the orchestrator
- Model repository configuration (HDFS/NFS)
- Load balancing and service discovery
- Security with Apache Ranger
- Operations, monitoring, and scaling
- Examples using Open Inference Protocol

Goal: Run production Triton Inference Server on YARN with GPU support, auto-scaling, and ecosystem integration.