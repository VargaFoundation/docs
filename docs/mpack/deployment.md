---
id: deployment
title: Deployment Guide
sidebar_position: 3
---

Once you have built the Mpack, you can install it on your Ambari Server and deploy the services.

## 1. Install Mpack on Ambari Server

Copy the generated `.tar.gz` to the Ambari Server host and run the following command as root:

```bash
ambari-server install-mpack --mpack=/path/to/varga-mpack-1.0.0.0.tar.gz --verbose
```

Restart Ambari Server to apply changes:

```bash
ambari-server restart
```

## 2. Add Services to Cluster

1.  Open the Ambari Web UI.
2.  Click on **Actions** -> **Add Service**.
3.  Select **Kirka** and/or **Tarn** from the list of available services.
4.  Follow the wizard to assign components to hosts:
    -   **Kirka Server**: Usually a single instance on a master node.
    -   **Tarn Server**: Can be deployed on multiple nodes (YARN Slaves).

## 3. Configuration Highlights

During the installation wizard, pay attention to the following settings:

### Kirka Settings
-   **HBase Zookeeper Quorum**: Ensure this matches your cluster's HBase configuration.
-   **HDFS URI**: The base URI for artifact storage (e.g., `hdfs://namenode:8020`).
-   **Security**: Enable Kerberos if your cluster is secured.

### Tarn Settings
-   **Triton Docker Image**: The Docker image used for model serving.
-   **YARN Mode**: Tarn runs as a YARN application. Ensure YARN has sufficient resources (CPU/Memory/GPU).
-   **Ranger Service**: Name of the Ranger service for authorization.

## 4. Verification

After installation, check the service status in Ambari.

-   **Kirka**: Try accessing the Kirka UI or API at `http://<kirka-host>:<port>`.
-   **Tarn**: Verify that the Tarn application is running in the YARN ResourceManager UI.
