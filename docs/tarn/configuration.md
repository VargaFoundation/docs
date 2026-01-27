---
id: configuration
title: Configuration
sidebar_position: 4
---

## Model Repository Storage

TARN supports two ways to provide the model repository to Triton:

### 1. HDFS (Copy to Local)
If your model repository path starts with `hdfs:///`, TARN will automatically copy the models from HDFS to a local directory (`/models`) inside the container before starting Triton.
- **Pros**: Easy to set up, no extra configuration on nodes.
- **Cons**: High latency on startup for large models, consumes local disk space.

### 2. NFS (Direct Access - Recommended)
If your path starts with `/`, TARN will use the path directly. This is the recommended method for performance, as it avoids data copying. However, it requires an **NFS Gateway** to be installed and mounted on all NodeManagers.
- **Pros**: Instant startup, no data duplication.
- **Cons**: Requires NFS infrastructure.

#### How to install HDFS NFS Gateway

To use the NFS method, you must deploy an HDFS NFS Gateway on your DataNodes and mount it locally.

1. **Configure HDFS for NFS**:
   Add the following to `core-site.xml`:
   ```xml
   <property>
     <name>hadoop.proxyuser.hdfs.groups</name>
     <value>*</value>
   </property>
   <property>
     <name>hadoop.proxyuser.hdfs.hosts</name>
     <value>*</value>
   </property>
   ```

2. **Start the NFS Gateway**:
   On each DataNode (or dedicated nodes):
   ```bash
   # Start portmap (requires root)
   hdfs portmap
   # Start nfs3
   hdfs nfs3
   ```

3. **Mount HDFS via NFS**:
   On all NodeManagers:
   ```bash
   mkdir -p /mnt/hdfs
   mount -t nfs -o vers=3,proto=tcp,nolock,noacl <NFS_GATEWAY_HOST>:/ /mnt/hdfs
   ```

Now you can point TARN to your models using the local mount path:
`--model-repository /mnt/hdfs/user/models/my-model`

## Command Line Options

Refer to the [deployment example](../installation-deployment.md) for the full command. Key options include:

- `--model-repository`: Path to Triton model repository (hdfs:/// or /)
- `--image`: Docker image for Triton (e.g., nvcr.io/nvidia/tritonserver:24.09-py3)
- `--port`: Triton HTTP port (default 8000)
- `--metrics-port`: Triton metrics port (default 8002)
- `--am-port`: Application Master web port (default 8888)
- `--address`: Bind address (default 0.0.0.0)
- `--token`: Security token for AM API
- `--tp`, `--pp`: Tensor/Pipeline parallelism
- `--secrets`: HDFS path to JKS/JCEKS secrets file
- `--placement-tag`: YARN placement tag for anti-affinity
- `--scale-up`, `--scale-down`: Scaling thresholds
- `--min-instances`, `--max-instances`: Instance limits
- `--cooldown`: Scaling cooldown (ms)
- `--env KEY=VALUE`: Pass env vars to containers
- `--ranger-service`: Ranger service name (for authorization)
- `--zk-ensemble`, `--zk-path`: ZooKeeper config for Knox discovery

## Secret Management

TARN supports secret management via JKS/JCEKS files on HDFS:
- The `huggingface.token` alias is automatically mapped to `HUGGING_FACE_HUB_TOKEN`.
- Any alias starting with `tarn.env.` is automatically mapped to an environment variable (e.g., `tarn.env.AWS_SECRET_KEY` becomes `AWS_SECRET_KEY`).