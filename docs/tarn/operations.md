---
id: operations
title: Operations
sidebar_position: 5
---

## Node Tagging and Placement

TARN uses YARN **Placement Constraints** to ensure optimal distribution of Triton instances. By default, it uses the tag `nvidia` for anti-affinity (at most one container per node).

### How to tag nodes in YARN

To use placement constraints effectively, you may want to tag your nodes. In YARN, this is typically done using **Node Labels** or by configuring the NodeManagers.

#### 1. Using Node Labels (Recommended for GPU isolation)
Node labels allow you to partition the cluster. For example, to label nodes with GPUs:
```bash
# Add the label
yarn rmadmin -replaceLabelsOnNode "node1:8041,GPU node2:8041,GPU"
```
Then, you can configure your queue to use these labels. Note that TARN also explicitly requests `yarn.io/gpu` resources.

#### 2. Anti-Affinity via Placement Constraints
TARN automatically handles anti-affinity. If you use the `--placement-tag` option, TARN will:
1. Tag all its Triton containers with this value.
2. Tell YARN to never place two containers with the same tag on the same node.

This ensures that even if you have multiple GPUs on a single node, a single Triton instance (which can manage multiple GPUs via TP/PP) will occupy that node, preventing resource contention between multiple Triton processes.

## Load Balancing Options

TARN provides two distinct strategies for service discovery and load balancing, allowing you to choose the best fit for your infrastructure. **The ZooKeeper-based approach with Apache Knox is highly recommended for production environments.**

### Comparison and Recommendation

| Feature | Apache Knox + ZooKeeper (Recommended) | HAProxy + Update Script |
|:---|:---|:---|
| **Primary Use Case** | Production, Multi-tenant clusters | Standalone, Simple environments |
| **Discovery Mechanism** | Native ZK Watches (Push-based) | AM Polling via Script (Pull-based) |
| **Security** | Kerberos, LDAP, Knox Dispatchers, Audit | Basic Token-based Discovery |
| **High Availability** | Built-in via Knox HaProvider | Requires External Script Management |
| **Complexity** | Higher (requires Knox & ZooKeeper) | Lower (requires HAProxy & socat) |

### Option 1: Apache Knox with ZooKeeper (Recommended)

This method leverages **Apache ZooKeeper** for real-time service discovery and **Apache Knox** as a secure perimeter gateway. 

#### How it Works:
1.  **Ephemeral Registration**: The TARN Application Master (AM) automatically registers every new Triton container as an **ephemeral znode** in ZooKeeper under the configured path (e.g., `/services/triton/instances/container_id`).
2.  **Liveness Monitoring**: If a container fails or is stopped by YARN, its znode is automatically removed from ZooKeeper by the cluster coordination.
3.  **Dynamic Discovery**: Apache Knox uses its `HaProvider` to watch the ZooKeeper namespace. As soon as a znode appears or disappears, Knox updates its internal list of backends without any manual intervention.
4.  **Secure Proxying**: Clients interact with Knox via HTTPS. Knox handles authentication (LDAP, Kerberos) and then forwards requests to the healthy Triton instances.

#### 1. AM Configuration for ZooKeeper

When submitting the application, provide the ZooKeeper ensemble and the base path where instances should register:

```bash
yarn jar tarn-orchestrator.jar varga.tarn.yarn.Client \
  ... \
  --zk-ensemble zk-host1:2181,zk-host2:2181 \
  --zk-path /services/triton/instances
```

#### 2. Knox Topology Configuration

Create a topology file (e.g., `/etc/knox/conf/topologies/tarn.xml`) and enable the `HaProvider`. This provider is responsible for talking to ZooKeeper and performing round-robin load balancing.

```xml
<topology>
    <gateway>
        <provider>
            <role>ha</role>
            <name>HaProvider</name>
            <enabled>true</enabled>
            <param>
                <name>TRITON</name>
                <value>
                    enabled=true;
                    maxFailoverAttempts=3;
                    failoverSleep=1000;
                    zookeeperEnsemble=zk-host1:2181,zk-host2:2181;
                    zookeeperNamespace=/services/triton
                </value>
            </param>
        </provider>
        <!-- Add your ShiroProvider or Kerberos authentication here -->
    </gateway>
    <service>
        <role>TRITON</role>
        <!-- No URL is needed here as it is discovered via ZooKeeper -->
    </service>
</topology>
```

### Option 2: HAProxy with Dynamic Update Script

This method is suitable for smaller deployments or environments where Apache Knox is not available. It relies on a sidecar script that polls the TARN Application Master.

#### How it Works:
1.  **AM Discovery**: The `update_haproxy.sh` script uses the YARN CLI to find the current host and port of the Application Master.
2.  **Instance Polling**: Every 30 seconds (configurable), the script queries the AM's `/instances` endpoint to get the list of active Triton containers.
3.  **Runtime API Update**: The script communicates with HAProxy via a Unix Socket using `socat`. It uses the **Runtime API** to update server addresses and ports in real-time.
4.  **Slot Management**: HAProxy must be configured with "placeholder slots". The script maps active containers to these slots. Unused slots are put into `MAINT` (maintenance) mode to stop traffic.

#### 1. HAProxy Installation

Ensure both HAProxy and `socat` are installed on the load balancer node:

```bash
# Ubuntu/Debian
sudo apt-get install haproxy socat
# RHEL/CentOS
sudo yum install haproxy socat
```

#### 2. HAProxy Configuration

Edit `/etc/haproxy/haproxy.cfg`. You **must** enable the stats socket with `level admin` to allow the script to make changes.

```haproxy
global
    # Mandatory for the update script
    stats socket /var/run/haproxy.sock mode 660 level admin
    stats timeout 30s

defaults
    mode http
    timeout connect 5s
    timeout client 50s
    timeout server 50s

frontend triton_frontend
    bind *:80
    default_backend triton_backend

backend triton_backend
    balance roundrobin
    # Define placeholder slots. 
    # Important: The number of slots must be >= your --max-instances setting.
    server triton-1 0.0.0.0:8000 check disabled
    server triton-2 0.0.0.0:8000 check disabled
    server triton-3 0.0.0.0:8000 check disabled
    server triton-4 0.0.0.0:8000 check disabled
```

#### 3. Permissions and Script Usage

The user running the script needs write access to the HAProxy socket:

```bash
sudo chown root:haproxy /var/run/haproxy.sock
sudo chmod 660 /var/run/haproxy.sock
sudo usermod -a -G haproxy $USER
```

Run the script in the background or as a systemd service:

```bash
./scripts/update_haproxy.sh /var/run/haproxy.sock <YOUR_TARN_TOKEN>
```

#### Running as a Service

A systemd unit file is provided in `services/tarn-haproxy-updater.service`. To install it:
1. Copy the script to `/usr/local/bin/update_haproxy.sh`.
2. Copy the service file to `/etc/systemd/system/`.
3. Update the `ExecStart` and `User` in the service file if necessary.
4. Run `systemctl daemon-reload && systemctl enable --now tarn-haproxy-updater`.

## Monitoring with Grafana

Prometheus scrapes `https://<AM_HOST>:<AM_PORT>/metrics` with the `X-TARN-Token` header. Tokens in the URL are refused — configure the scrape job to send the header instead:

```yaml
scrape_configs:
  - job_name: tarn
    scheme: https
    tls_config:
      insecure_skip_verify: false
    authorization:
      type: Bearer
      credentials_file: /etc/prometheus/secrets/tarn-token
    static_configs:
      - targets: ['tarn-host:8888']
```

The Helm chart ships a ready-to-use ServiceMonitor (`--set serviceMonitor.enabled=true`) that emits an equivalent Prometheus Operator resource.

### Core metrics (unchanged)

- `tarn_target_containers` — target number of containers for scaling.
- `tarn_running_containers` — actual number of running containers.
- `tarn_container_load{container_id, host}` — per-container normalized load.
- `tarn_gpu_*{container_id, host, gpu}` — NVIDIA GPU metrics (utilization, memory, …).
- `tarn_container_startup_ms`, `tarn_container_queue_depth`.

### New in the LLM / multi-tenant release

- **`tarn_inference_latency_seconds{model, le}`** — native Prometheus histogram with buckets `{5ms, 10ms, 25ms, 50ms, 100ms, 250ms, 500ms, 1s, 2.5s, 5s, 10s, 30s, 60s}`. Aggregatable across replicas with `histogram_quantile()`. The previous `tarn_inference_latency_p{50,95,99}_ms` gauges are kept as deprecated per-instance indicators.
- **`tarn_inference_requests_total{model, status}`** — counter split by `"success"` / `"error"`.
- **`tarn_tokens_in_total{user, model}`** / **`tarn_tokens_out_total{user, model}`** — prompt and completion token counters per (user, model) for chargeback. OpenAI responses are parsed automatically for the `usage` block; streaming clients can POST to `/v1/usage` to report out-of-band.
- **`tarn_model_error_rate{model}`** — gauge for quick dashboards.
- **`tarn_alerts_total`**, **`tarn_container_failures_total`**, **`tarn_scaling_events_total`** — audit counters backing `/alerts`.

### OpenTelemetry tracing

TARN depends only on `opentelemetry-api`. To ship traces, attach the standard Java agent at startup:

```bash
java -javaagent:/opt/otel/opentelemetry-javaagent.jar \
     -Dotel.exporter.otlp.endpoint=http://collector:4317 \
     -Dotel.service.name=tarn-am \
     ... varga.tarn.yarn.ApplicationMaster
```

The agent auto-configures the global provider and TARN's spans flow to OTLP, Jaeger, Zipkin, or any other supported backend. Spans created by TARN:

- `POST /v1/chat/completions` (SERVER) — one per inbound proxy request, with attributes `tarn.user`, `tarn.model`, `tarn.lora`, `tarn.stream`, `tarn.container_id`.
- `triton.upstream` (CLIENT) — the call to the Triton backend, with `http.url`, `http.status_code`.
- W3C `traceparent` is propagated both directions, so Knox → TARN → Triton traces stitch together.

### Structured JSON logs

Activate via `-Dlog4j.configuration=log4j-json.properties` (ships in the JAR). Each line is a JSON object with fields `ts`, `level`, `logger`, `thread`, `message`, plus every MDC key — so `trace_id` and `span_id` pushed by the tracer show up automatically for cross-log / cross-trace correlation.

## Scale-down drain

When the scaling policy decides to shrink, the AM runs this sequence on the victim container:

1. **Deregister from ZooKeeper** so Knox and any ZK watchers stop routing to it.
2. **Poll Triton queue depth** (`nv_inference_pending_request_count`) every 500 ms until it reaches 0 or `--drain-timeout-ms` elapses.
3. **SIGTERM via NodeManager** to stop the container.

If the drain window closes with requests still queued, a `drain_timeout` alert is emitted but the container is still stopped — capacity is preserved and no container is "leaked".

## Warmup

Triton's `/v2/health/ready` returns 200 as soon as all configured models are loaded. For large LLMs the CUDA kernels still need a first call before latency is nominal. TARN defers ZooKeeper registration of a new container until `/v2/health/ready` passes (`--warmup-timeout-ms`, default 120 s), so Knox never routes to a cold backend.

## Quotas (hot-reload)

Two paths:

1. **Admin REST API** (recommended for Ops tooling):
    - `GET /admin/quotas` — returns the live JSON rule set.
    - `POST /admin/quotas` (body = new JSON) — validates, writes to ZK, all replicas hot-reload.
2. **Direct ZooKeeper** — `zkCli.sh set /services/triton/config/quotas '{…}'` works for GitOps pipelines using a ZK sync controller.

Both paths update every AM replica within one Curator event; no restart needed.

## Kubernetes Operator

When TARN is deployed as a Kubernetes Operator (see the dedicated [Kubernetes Operator](./kubernetes-operator.md) page), operations are governed by CRs:

- `kubectl get tritondeployments` (or `td`) lists all CRs and their phase.
- `kubectl describe td <name>` shows Kubernetes Events for each reconcile transition (`Ready`, `Reconciling`, `InvalidSpec`, `ReconcileError`, `HTTPRouteFailed`, …).
- Traffic split via `spec.traffic[]` creates one Deployment per variant, optionally with a Gateway API HTTPRoute for precise routing.
- Leader election via `coordination.k8s.io/v1/leases` enables HA operator deployments (2+ replicas, 30 s failover).