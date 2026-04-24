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

Every option can also be set via the corresponding `UPPER_SNAKE_CASE` environment variable. CLI flags take precedence over env vars; validation runs after `parseArgs` and rejects invalid combinations fail-fast.

### Core Triton

| Flag | Env | Default | Description |
|---|---|---|---|
| `--model-repository` | `MODEL_REPOSITORY` | `hdfs:///models` | Path to model repo (`hdfs://…` copies to local, `/…` used directly as NFS mount). Strictly validated — no shell metacharacters allowed. |
| `--image` | `TRITON_IMAGE` | `nvcr.io/nvidia/tritonserver:24.09-py3` | Docker image for Triton. |
| `--port` | `TRITON_PORT` | `8000` | Triton HTTP port. |
| `--grpc-port` | `GRPC_PORT` | `8001` | Triton gRPC port. |
| `--metrics-port` | `METRICS_PORT` | `8002` | Triton Prometheus metrics port. |
| `--address` | `BIND_ADDRESS` | `0.0.0.0` | Bind address. |
| `--tp` / `--pp` | `TENSOR_PARALLELISM` / `PIPELINE_PARALLELISM` | `1` / `1` | Tensor / pipeline parallelism (multi-GPU via MPI). |

### Application Master

| Flag | Env | Default | Description |
|---|---|---|---|
| `--am-port` | `AM_PORT` | `8888` | AM HTTP(S) port. |
| `--token` | `TARN_TOKEN` | _(none)_ | API token. Constant-time comparison on the header `X-TARN-Token`; query-string tokens are refused. |
| `--client-port` | `CLIENT_PORT` | `8889` | YARN Client daemon health endpoint. |
| `--jar` | — | — | Local path to the AM JAR; auto-uploaded to HDFS as a LocalResource. |

### TLS (P0.5)

| Flag | Env | Default | Description |
|---|---|---|---|
| `--tls-enabled` | `TLS_ENABLED` | `false` | Serve AM endpoints over HTTPS. Required for HSTS header. |
| `--tls-keystore` | `TLS_KEYSTORE_PATH` | — | HDFS or local path to keystore (JKS/PKCS12). |
| `--tls-keystore-type` | `TLS_KEYSTORE_TYPE` | `JKS` | Keystore type. |
| `--tls-keystore-password-alias` | `TLS_KEYSTORE_PASSWORD_ALIAS` | `tarn.tls.keystore.password` | Credential-provider alias for the keystore password. |

### ZooKeeper (Knox discovery)

| Flag | Env | Default | Description |
|---|---|---|---|
| `--zk-ensemble` | `ZK_ENSEMBLE` | — | Comma-separated ZK ensemble (e.g. `zk1:2181,zk2:2181`). |
| `--zk-path` | `ZK_PATH` | `/services/triton/instances` | Parent znode for ephemeral instance registrations. |
| `--zk-required` | `ZK_REQUIRED` | `true` when `--zk-ensemble` is set | Refuse to start if ZK is unreachable. |

### Ranger authorization

| Flag | Env | Default | Description |
|---|---|---|---|
| `--ranger-service` | `RANGER_SERVICE` | — | Ranger service name (e.g. `triton_prod`). |
| `--ranger-app-id` | `RANGER_APP_ID` | `tarn` | Application ID for audit. |
| `--ranger-audit` | `RANGER_AUDIT` | `true` | Enable auditing. |
| `--ranger-strict` | `RANGER_STRICT` | `true` when `--ranger-service` is set | Deny-by-default if the plugin fails to initialize. Marks AM unhealthy. |

### Scaling (P1.5)

| Flag | Env | Default | Description |
|---|---|---|---|
| `--scale-up` / `--scale-down` | `SCALE_UP_THRESHOLD` / `SCALE_DOWN_THRESHOLD` | `0.7` / `0.2` | Normalized load thresholds. |
| `--min-instances` / `--max-instances` | `MIN_CONTAINERS` / `MAX_CONTAINERS` | `1` / `10` | Bounds. |
| `--cooldown` | `SCALE_COOLDOWN_MS` | `60000` | Cooldown between scaling actions. |
| `--scale-mode` | `SCALE_MODE` | `composite` | `gpu_util` (legacy) · `queue_depth` (LLM) · `composite` (max of both). |
| `--queue-capacity-per-container` | `QUEUE_CAPACITY_PER_CONTAINER` | `16` | Pending requests per container considered "full". Size to your batching width. |
| `--monitor-interval-ms` | `MONITOR_INTERVAL_MS` | `15000` | Scaling evaluation interval. |
| `--drain-timeout-ms` | `DRAIN_TIMEOUT_MS` | `30000` | Max wait for in-flight inferences before SIGTERM on scale-down. |

### Warmup (P1.6)

| Flag | Env | Default | Description |
|---|---|---|---|
| `--warmup-timeout-ms` | `WARMUP_TIMEOUT_MS` | `120000` | Max wait for `/v2/health/ready` before ZK registration. |
| `--warmup-poll-interval-ms` | `WARMUP_POLL_INTERVAL_MS` | `2000` | Warmup probe interval. |

### OpenAI-compatible proxy (P1.1)

| Flag | Env | Default | Description |
|---|---|---|---|
| `--openai-proxy-enabled` | `OPENAI_PROXY_ENABLED` | `false` | Enable `/v1/…` endpoints on a dedicated port. Each Triton container must run the `openai_frontend` (Triton ≥ 24.04). |
| `--openai-proxy-port` | `OPENAI_PROXY_PORT` | `9000` | Port for the OpenAI-compatible HTTP(S) server. |

### Observability

| Flag | Env | Default | Description |
|---|---|---|---|
| `--otel-endpoint` | `OTEL_EXPORTER_OTLP_ENDPOINT` | — | Read by the OpenTelemetry Java agent when attached. TARN itself uses the API only. |

### Quotas & rate limiting (P2.3 / P2.8)

| Flag | Env | Default | Description |
|---|---|---|---|
| `--quotas` | `QUOTAS_PATH` | — | HDFS or local path to a quotas JSON file (`{rules: [{user?, group?, model, requestsPerMinute}]}`). |

Live quota updates: write to the ZK znode at `{zk-path-parent}/config/quotas`, or POST to `/admin/quotas`.

### Accelerators (P2.6 / P2.7)

| Flag | Env | Default | Description |
|---|---|---|---|
| `--accelerator-type` | `ACCELERATOR_TYPE` | `nvidia_gpu` | One of `nvidia_gpu` (→ `yarn.io/gpu`), `amd_gpu` (→ `amd.com/gpu`), `intel_gaudi` (→ `habana.ai/gaudi`), `aws_neuron` (→ `aws.amazon.com/neuron`), `cpu_only`. |
| `--gpu-slice-size` | `GPU_SLICE_SIZE` | — | MIG profile (`1g.10gb`, `2g.20gb`, …) or decimal fraction for MPS time-sharing. |

### Shadow traffic (P2.4)

| Flag | Env | Default | Description |
|---|---|---|---|
| `--shadow-endpoint` | `SHADOW_ENDPOINT` | — | Backend URL for asynchronous A/B comparison (e.g. `http://triton-v2:8000`). |
| `--shadow-sample-rate` | `SHADOW_SAMPLE_RATE` | `0.0` | Fraction of inferences mirrored to the shadow endpoint (0.0 – 1.0). |

### Docker runtime

| Flag | Env | Default | Description |
|---|---|---|---|
| `--docker-network` | `DOCKER_NETWORK` | `host` | YARN Docker network. |
| `--docker-privileged` | `DOCKER_PRIVILEGED` | `false` | Privileged container. |
| `--docker-delayed-removal` | `DOCKER_DELAYED_REMOVAL` | `false` | Delay Docker rm for post-mortem. |
| `--docker-mounts` | `DOCKER_MOUNTS` | — | Comma-separated mounts. |
| `--docker-ports` | `DOCKER_PORTS` | — | `host:container,…` port mapping. |
| `--placement-tag` | `PLACEMENT_TAG` | `nvidia` | YARN anti-affinity tag. |

### Other

| Flag | Env | Default | Description |
|---|---|---|---|
| `--env KEY=VALUE` | — | — | Passthrough env var for the Triton container (repeatable). |
| `--secrets` | `SECRETS_PATH` | — | HDFS path to a JKS/JCEKS credential file (see below). |

## Secret Management

TARN supports secret management via JKS/JCEKS files on HDFS:

- The `huggingface.token` alias is automatically mapped to `HUGGING_FACE_HUB_TOKEN`.
- Any alias starting with `tarn.env.` is automatically mapped to an environment variable (e.g., `tarn.env.AWS_SECRET_KEY` becomes `AWS_SECRET_KEY`).
- The TLS keystore password is looked up by alias (`tarn.tls.keystore.password` by default, overridable via `--tls-keystore-password-alias`).

Create a credential file:

```bash
hadoop credential create huggingface.token -provider jceks://hdfs/user/secrets/hf.jceks
hadoop credential create tarn.tls.keystore.password -provider jceks://hdfs/user/secrets/hf.jceks
```

then submit TARN with `--secrets hdfs:///user/secrets/hf.jceks`.