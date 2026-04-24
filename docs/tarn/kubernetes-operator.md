---
id: kubernetes-operator
title: Kubernetes Operator
sidebar_position: 7
---

The **TARN Operator** is an alternative deployment paradigm to YARN submission: it watches `TritonDeployment` Custom Resources (CRs) and reconciles them into native Kubernetes Deployments + Services (and optionally Gateway API HTTPRoutes).

It is shipped as a separate Docker image so YARN-only installations pay no runtime overhead; the fabric8 client and Kubernetes model jars are `provided` dependencies on the main JAR and only layered into the operator image.

## When to use the Operator

| Use the Operator when… | Stick with YARN submission when… |
|---|---|
| Your cluster is Kubernetes-native. | Your cluster is Hadoop/YARN with HDFS data gravity. |
| You want `kubectl apply` style GitOps. | You want YARN queues and Ambari lifecycle. |
| You need Gateway API / Ingress precision. | You rely on Knox for perimeter security. |
| You use horizontal autoscaling via Prometheus Adapter + HPA. | You want TARN's composite queue-aware scaling. |

Both paradigms can run side-by-side against the same HDFS model repository.

## Install

1. Apply the CRD (shipped in the Helm chart under `crds/` — applied automatically on `helm install`):
    ```bash
    kubectl apply -f https://raw.githubusercontent.com/varga-foundation/tarn/main/helm/crds/tritondeployment.yaml
    ```
2. Deploy the operator via Helm:
    ```bash
    helm install tarn oci://ghcr.io/varga-foundation/charts/tarn \
      --namespace tarn-system --create-namespace \
      --set operator.enabled=true \
      --set operator.watchNamespace="" \
      --set operator.replicaCount=2
    ```
    - `operator.watchNamespace=""` watches every namespace (cluster-scoped RBAC is installed).
    - `operator.replicaCount=2` + leader election (on by default) gives 30-second failover.

## Minimal CR

```yaml
apiVersion: tarn.varga.io/v1alpha1
kind: TritonDeployment
metadata:
  name: resnet50
  namespace: default
spec:
  image: nvcr.io/nvidia/tritonserver:24.09-py3
  modelRepository: s3://my-bucket/models
  replicas: 3
```

The operator creates:

- A `Deployment` named `resnet50` with 3 Triton replicas.
- A `Service` `resnet50` exposing ports `http:8000`, `grpc:8001`, `metrics:8002`.
- Populates `status.phase` (`Pending` → `Reconciling` → `Ready`) and emits Kubernetes `Events` on phase transitions.

`kubectl get td`:

```
NAME        PHASE    READY   TARGET   IMAGE                                           AGE
resnet50    Ready    3       3        nvcr.io/nvidia/tritonserver:24.09-py3           2m
```

`kubectl describe td resnet50` shows reconciliation events:

```
Events:
  Type     Reason         Age    From             Message
  ----     ------         ----   ----             -------
  Normal   Reconciling    2m     tarn-operator    Waiting for 0/3 replicas
  Normal   Ready          45s    tarn-operator    All 3 replicas are ready
```

## Full spec

```yaml
apiVersion: tarn.varga.io/v1alpha1
kind: TritonDeployment
metadata:
  name: llama-3-70b
spec:
  image: nvcr.io/nvidia/tritonserver:24.09-py3
  modelRepository: s3://my-bucket/models
  replicas: 10                     # total across traffic variants

  tensorParallelism: 2
  pipelineParallelism: 1

  accelerator:
    type: nvidia_gpu               # or amd_gpu | intel_gaudi | aws_neuron | cpu_only
    count: 1
    sliceSize: "1g.10gb"           # optional MIG profile

  resources:
    memory: 64Gi
    cpu: "16"

  openaiProxy:
    enabled: true                  # expose /v1/chat/completions on port 9000
    port: 9000

  scaling:
    mode: composite                # or gpu_util | queue_depth
    minReplicas: 2
    maxReplicas: 20
    upThreshold: 0.75
    downThreshold: 0.20

  ranger:
    serviceName: triton_prod
    strict: true

  quotasRef:
    configMapName: tarn-quotas     # ConfigMap with key quotas.json
    key: quotas.json

  env:
    - name: OTEL_EXPORTER_OTLP_ENDPOINT
      value: http://collector.observability:4317

  traffic:                         # optional — canary / blue-green
    - name: v1
      weight: 90
    - name: canary
      weight: 10
      modelRepository: s3://my-bucket/models/v2
      image: nvcr.io/nvidia/tritonserver:25.03-py3

  gateway:                         # optional — precise weighted routing
    enabled: true
    parentRefs:
      - name: public-gw
        namespace: gateway-system
    hostnames:
      - chat.example.com
```

## Weighted traffic split

When `spec.traffic[]` is set, the operator distributes `spec.replicas` proportionally to variant weights using the largest-remainder method (deterministic, exact total). Each variant gets its own Deployment named `<cr>-<variant>` plus the `tarn.varga.io/variant` label.

### Service-level split (default)

A single `Service` named after the CR selects every variant pod (`tarn.varga.io/instance=<cr>`, no variant constraint). Traffic is **approximate** — K8s `Service` round-robins L4 endpoints, which maps to a 90/10 pod distribution for a 90/10 replica split.

### Precise split via Gateway API

Set `spec.gateway.enabled=true` with `parentRefs` to your Gateway. The operator additionally emits:

- Per-variant Services (`<cr>-<variant>`).
- An `HTTPRoute` (`gateway.networking.k8s.io/v1`) with `backendRefs` carrying the exact weights from `spec.traffic[i].weight`.

This delivers precise percentage routing regardless of replica counts — useful for edge cases like 95/5 splits with low replica counts where rounding error matters.

Requires a Gateway-class controller installed on the cluster (Istio, Cilium Gateway, Envoy Gateway, Contour, …). If the Gateway API CRDs are missing, the operator logs a warning, emits an `HTTPRouteFailed` event, and falls back to Service-only routing.

### Canary promotion workflow

```bash
# 1. Ship v2 as a 5% canary.
kubectl patch td llama -p '{"spec":{"traffic":[{"name":"v1","weight":95},{"name":"canary","weight":5,"modelRepository":"s3://models/v2"}]}}' --type=merge

# 2. Observe latency and error rate per variant (tarn_inference_latency_seconds, tarn_model_error_rate).

# 3. Promote canary to 100%.
kubectl patch td llama -p '{"spec":{"traffic":[{"name":"v2","weight":100,"modelRepository":"s3://models/v2"}]}}' --type=merge

# 4. The operator prunes the v1 Deployment automatically (no extra cleanup).
```

### Drained variant

Set `weight: 0` to keep a variant addressable (via header-targeted clients) without sending production traffic — useful for keeping a known-good rollback warm during risky promotions.

## RBAC

The Helm chart installs a `ClusterRole` with the minimum verbs the operator needs:

- `tarn.varga.io/tritondeployments` (+ `/status`): full CRUD.
- `apps/deployments`: full CRUD (managed resources).
- `core/services`, `core/configmaps`, `core/events`: full CRUD.
- `coordination.k8s.io/leases`: full CRUD (leader election).

To restrict the operator to a single namespace, use a `Role` + `RoleBinding` instead and set `operator.watchNamespace=<ns>`.

## Leader election

With `operator.replicaCount=2+` and `operator.leaderElection.enabled=true` (defaults), replicas race for a `Lease` object named `tarn-operator` in `operator.leaderElection.namespace`. Only the leader runs the watch+reconcile loop; passive replicas stand by and take over within `leaseDuration` (30 s) if the leader fails or loses the renewal race.

This lets you deploy the operator with a `PodDisruptionBudget` of `minAvailable: 1` for true HA.

## Tests

The operator reconciler ships with unit tests driven by fabric8's `KubernetesMockServer` (`@EnableKubernetesMockClient(crud=true)`) — no real cluster required. They cover:

- Deployment + Service creation with `OwnerReferences` (cascade delete).
- Accelerator resource mapping for NVIDIA / AMD / Intel / AWS / CPU-only.
- OpenAI proxy port + env wiring.
- Weighted traffic split + Gateway HTTPRoute emission.
- Pruning of removed variants and of the legacy single-Deployment when switching to multi-cohort.
- Warning events for invalid specs.

## Limitations

- The current reconciler is a direct watch loop (no JOSDK work queue + exponential backoff). Transient errors bubble up to Kubernetes Events but there's no rate limiter on retries — add one if you run the operator on a cluster that produces frequent spurious events.
- CRD updates require a re-apply (`kubectl apply -f crds/tritondeployment.yaml`); fabric8's model is generated at compile time so field additions are not instantly reflected without recompiling.
- Rolling update strategy is the Kubernetes default (`RollingUpdate` with 25 % max surge/unavailable) — not configurable via the CRD yet. For strict surge control, target the generated `Deployment` directly with a `kubectl patch`.
