---
id: faq
title: FAQ
sidebar_position: 8
---

- **What is the recommended load balancing method?** Apache Knox + ZooKeeper for production environments with multi-tenancy and high availability. HAProxy + update script for simpler standalone setups.

- **HDFS copy vs NFS mount for models?** NFS direct access (`/mnt/hdfs/...`) is recommended for performance (no copy latency). HDFS (`hdfs:///`) copies models locally but uses disk space and startup time.

- **Does TARN support multi-GPU inference?** Yes, configure Tensor Parallelism (`--tp N`) and Pipeline Parallelism (`--pp M`) to utilize multiple GPUs per Triton instance.

- **How does scaling work?** The Application Master monitors container load and GPU utilization, scaling up/down between `--min-instances` and `--max-instances` using `--scale-up`/`--scale-down` thresholds with `--cooldown` delay.

- **Is Apache Ranger required for security?** No, TARN works without it using token-based AM access. Ranger adds fine-grained model authorization (`list`, `metadata`, `infer`).

- **What ZooKeeper namespace to use?** Examples use `/services/triton/instances`; customize with `--zk-ensemble` and `--zk-path` for Knox HaProvider discovery.

- **Enterprise Hadoop support?** Yes, build with `-Dhadoop.version=3.3.6.1.2.4.0-32` and add distribution repos (e.g., ODP).