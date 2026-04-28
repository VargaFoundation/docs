---
id: examples
title: Examples
sidebar_position: 10
---

## Model Repository Structure

The Triton Inference Server organizes models in a model repository:

```
<model-repository-path>/
   <model-name>/
       [config.pbtxt]
       [<output-labels-file> ...]
       [configs/]
           [<custom-config-file> ...]
       <version>/
           <model-definition-file>
       <version>/
           <model-definition-file>
```

Example:
```
model_repository
|
+-- resnet50
    |
    +-- config.pbtxt
    +-- 1
        |
        +-- model.pt
+-- densenet_onnx
    |
    +-- config.pbtxt
    +-- 1
        |
        +-- model.onnx   
```

**config.pbtxt** (optional, auto-generated if missing):

Example for ONNX:
```
name: "text_detection"
backend: "onnxruntime"
max_batch_size: 256
input [
   {
       name: "input_images:0"
       data_type: TYPE_FP32
       dims: [ -1, -1, -1, 3 ]
   }
]
output [
   {
       name: "feature_fusion/Conv_7/Sigmoid:0"
       data_type: TYPE_FP32
       dims: [ -1, -1, -1, 1 ]
   }
]
```

## 0. Quickstart: Identity model (CPU smoke test)

A minimal Python-backend model that echoes its input. Use it as a smoke test of the
full TARN → YARN → Docker → Triton path before deploying a real LLM / vision model
— no GPU required, the HDFS payload is under 1 KB.

**1. Build the model repository locally**

```bash
mkdir -p identity-model/identity/1

cat > identity-model/identity/config.pbtxt <<'EOF'
name: "identity"
backend: "python"
max_batch_size: 0
input  [{ name: "INPUT0",  data_type: TYPE_FP32, dims: [-1] }]
output [{ name: "OUTPUT0", data_type: TYPE_FP32, dims: [-1] }]
instance_group [{ kind: KIND_CPU }]
EOF

cat > identity-model/identity/1/model.py <<'EOF'
import json
import triton_python_backend_utils as pb_utils


class TritonPythonModel:
    def initialize(self, args):
        self.model_config = json.loads(args["model_config"])

    def execute(self, requests):
        responses = []
        for request in requests:
            in_t = pb_utils.get_input_tensor_by_name(request, "INPUT0")
            out_t = pb_utils.Tensor("OUTPUT0", in_t.as_numpy())
            responses.append(pb_utils.InferenceResponse([out_t]))
        return responses

    def finalize(self):
        pass
EOF
```

**2. Stage on HDFS**

```bash
kinit ambari-qa@EXAMPLE.COM         # any user that can write under /tmp
hadoop fs -mkdir -p /tmp/tarn-models
hadoop fs -copyFromLocal -f identity-model/identity /tmp/tarn-models/
hadoop fs -ls -R /tmp/tarn-models
```

**3. Deploy via TARN**

Standalone (development):

```bash
yarn jar /usr/lib/tarn/tarn.jar varga.tarn.yarn.Client \
  --model-repository hdfs:///tmp/tarn-models \
  --image nvcr.io/nvidia/tritonserver:24.09-py3 \
  --accelerator-type cpu_only \
  --am-port 8888 --port 8000 --grpc-port 8001 --metrics-port 8002 \
  --min-instances 1 --max-instances 1
```

Or via Ambari: `tarn-site` → `tarn.model.repository=hdfs:///tmp/tarn-models`,
`tarn.accelerator.type=cpu_only`; then restart `TARN_SERVER`.

The AM registers each HDFS file as a YARN `LocalResource` and propagates the HDFS
delegation token to every Triton container. The NM localizes the model tree on
the host before `docker run`, and Docker bind-mounts it into the container at
`./models` — so Triton starts even though the
`nvcr.io/nvidia/tritonserver:24.09-py3` image has no `hadoop` CLI inside.

**4. Verify**

```bash
AM=<AM_HOST>:8888

# AM is alive and has at least one ready instance.
curl http://$AM/health
# OK

INSTANCE=$(curl -s http://$AM/instances | head -1)
echo "Triton at $INSTANCE"
# 159-106-159-51.example.com:8000

# Triton accepts requests and the identity model round-trips.
curl http://$INSTANCE/v2/health/ready -o /dev/null -w '%{http_code}\n'
# 200

curl -X POST http://$INSTANCE/v2/repository/index
# [{"name":"identity","version":"1","state":"READY"}]

curl -X POST http://$INSTANCE/v2/models/identity/infer \
  -H 'Content-Type: application/json' \
  -d '{"inputs":[{"name":"INPUT0","shape":[5],"datatype":"FP32",
       "data":[1.0,2.0,3.0,4.0,5.0]}]}'
# {"model_name":"identity","model_version":"1","outputs":[
#  {"name":"OUTPUT0","datatype":"FP32","shape":[5],"data":[1.0,2.0,3.0,4.0,5.0]}]}
```

If `/health` returns `NO_INSTANCES_READY`, check
`/data/hadoop_*/yarn/log/<appId>/container_*_000001/AppMaster.stderr` on the AM
host. The most common cause on a Kerberized cluster is missing HDFS delegation
tokens — the TARN client attaches them automatically when security is enabled,
so make sure the submitting user has run `kinit` and that
`yarn.resourcemanager.principal` is configured.

## 1. Stable Diffusion (Image Generation)

Deploy:
```bash
yarn jar target/tarn-orchestrator-0.0.1-SNAPSHOT.jar varga.tarn.yarn.Client \
  --model-repository hdfs:///models \
  --image nvcr.io/nvidia/tritonserver:24.09-py3 \
  --token secret-token
```

**Client (Python)**:
```python
import numpy as np
from PIL import Image
from tritonclient.http import InferenceServerClient, InferInput

# Connect to HAProxy or Triton instance
client = InferenceServerClient(url="localhost:8000")

prompt = "A futuristic city in the style of cyberpunk"
input_data = np.array([prompt], dtype=object)

inputs = [InferInput("PROMPT", [1], "BYTES")]
inputs[0].set_data_from_numpy(input_data)

response = client.infer("stable_diffusion", inputs)

image_data = response.as_numpy("IMAGES")[0]
image = Image.fromarray(image_data.astype(np.uint8))
image.save("generated_image.png")
```

## 2. ONNX Model (ResNet-50)

Deploy:
```bash
yarn jar target/tarn-orchestrator-0.0.1-SNAPSHOT.jar varga.tarn.yarn.Client \
  --model-repository hdfs:///models \
  --image nvcr.io/nvidia/tritonserver:24.09-py3
```

**Client (Python)**:
```python
import numpy as np
import tritonclient.http as httpclient

client = httpclient.InferenceServerClient(url="localhost:8000")

input_shape = (1, 3, 224, 224)
data = np.random.randn(*input_shape).astype(np.float32)

inputs = [httpclient.InferInput("input_0", input_shape, "FP32")]
inputs[0].set_data_from_numpy(data)

results = client.infer("onnx_resnet50", inputs)
output_data = results.as_numpy("output_0")
print(f"Inference result shape: {output_data.shape}")
```

## 3. PyTorch Model (LibTorch)

Deploy same as above.

**Client (Python)**:
```python
import numpy as np
import tritonclient.http as httpclient

client = httpclient.InferenceServerClient(url="localhost:8000")

data = np.random.randn(1, 3, 224, 224).astype(np.float32)

inputs = [httpclient.InferInput("INPUT__0", [1, 3, 224, 224], "FP32")]
inputs[0].set_data_from_numpy(data)

response = client.infer("pytorch_densenet", inputs)
probabilities = response.as_numpy("OUTPUT__0")
predicted_class = np.argmax(probabilities)
print(f"Predicted class ID: {predicted_class}")
```

## 4. OpenAI-compatible LLM (streaming + multi-LoRA)

Deploy Llama-3-70B with the OpenAI proxy enabled and a LoRA adapter manifest on HDFS:

```bash
hadoop fs -put lora.json hdfs:///models/lora.json
cat lora.json
# {"llama-3-70b": ["customer-support", "legal-contracts"]}

yarn jar target/tarn-orchestrator-0.0.1-SNAPSHOT.jar varga.tarn.yarn.Client \
  --model-repository hdfs:///models \
  --image nvcr.io/nvidia/tritonserver:24.09-py3 \
  --tp 4 \
  --openai-proxy-enabled \
  --openai-proxy-port 9000 \
  --scale-mode queue_depth \
  --queue-capacity-per-container 16 \
  --tls-enabled --tls-keystore hdfs:///tarn/certs/keystore.jks \
  --secrets hdfs:///tarn/certs/creds.jceks \
  --token my-secret-token
```

**Client (Python, OpenAI SDK)**:

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://tarn.example.com:9000/v1",
    api_key="ignored",              # TARN uses header-based token
    default_headers={"X-TARN-Token": "my-secret-token",
                     "X-Forwarded-User": "alice"},
)

# Base model (routed by lowest queue depth across Triton pods).
resp = client.chat.completions.create(
    model="llama-3-70b",
    messages=[{"role": "user", "content": "Explain PageRank in two sentences."}],
)
print(resp.choices[0].message.content)
print("prompt_tokens:", resp.usage.prompt_tokens,
      "completion_tokens:", resp.usage.completion_tokens)

# LoRA variant — same endpoint, different model name.
stream = client.chat.completions.create(
    model="llama-3-70b#customer-support",
    messages=[{"role": "user", "content": "My bill is wrong."}],
    stream=True,
)
for chunk in stream:
    delta = chunk.choices[0].delta.content or ""
    print(delta, end="", flush=True)
```

**Report streaming usage out-of-band** so token chargeback still works for streamed responses:

```python
# After stream completes, client reports back to /v1/usage.
import httpx
httpx.post(
    "https://tarn.example.com:9000/v1/usage",
    headers={"X-Forwarded-User": "alice"},
    json={"model": "llama-3-70b", "prompt_tokens": 42, "completion_tokens": 256},
)
```

## 5. Canary promotion with the Kubernetes Operator

Define a `TritonDeployment` with a 90 / 10 split. See the [Kubernetes Operator](./kubernetes-operator.md) page for the full spec.

```yaml
apiVersion: tarn.varga.io/v1alpha1
kind: TritonDeployment
metadata:
  name: llama
  namespace: default
spec:
  image: nvcr.io/nvidia/tritonserver:24.09-py3
  modelRepository: s3://models/v1
  replicas: 10
  tensorParallelism: 4
  accelerator: { type: nvidia_gpu, count: 1 }
  openaiProxy: { enabled: true, port: 9000 }

  traffic:
    - name: v1
      weight: 90
    - name: canary
      weight: 10
      modelRepository: s3://models/v2           # new finetune
      image: nvcr.io/nvidia/tritonserver:25.03-py3

  gateway:
    enabled: true
    parentRefs:
      - name: public-gw
        namespace: gateway-system
    hostnames:
      - chat.example.com
```

```bash
kubectl apply -f llama-canary.yaml
kubectl get td
# NAME    PHASE         READY   TARGET   IMAGE                                     AGE
# llama   Reconciling   0       10       nvcr.io/nvidia/tritonserver:24.09-py3     10s

# Watch each variant separately.
kubectl get deploy -l tarn.varga.io/instance=llama
# NAME           READY   UP-TO-DATE   AVAILABLE   AGE
# llama-v1       9/9     9            9           2m
# llama-canary   1/1     1            1           2m

# Inspect the HTTPRoute sent to your Gateway controller.
kubectl get httproute llama -o yaml | yq '.spec.rules[0].backendRefs'
# - name: llama-v1
#   port: 9000
#   weight: 90
# - name: llama-canary
#   port: 9000
#   weight: 10
```

Promote v2 to 100 %:

```bash
kubectl patch td llama --type=merge -p '
spec:
  traffic:
    - name: v2
      weight: 100
      modelRepository: s3://models/v2
      image: nvcr.io/nvidia/tritonserver:25.03-py3
'
```

The reconciler prunes `llama-v1` automatically and leaves `llama-v2` at 10 replicas.

## 6. Per-user quotas with hot-reload

Load an initial rule set:

```bash
cat > quotas.json <<'EOF'
{
  "rules": [
    { "user": "alice", "model": "llama-3-70b", "requestsPerMinute": 60 },
    { "group": "paying-customers", "model": "*", "requestsPerMinute": 300 },
    { "model": "*", "requestsPerMinute": 10 }
  ]
}
EOF

hadoop fs -put quotas.json hdfs:///tarn/quotas.json

yarn jar ... varga.tarn.yarn.Client \
  ... \
  --quotas hdfs:///tarn/quotas.json \
  --zk-ensemble zk1:2181,zk2:2181
```

Update live from any machine with `kubectl`-style tooling:

```bash
# Via the admin REST API (propagated to every AM replica via ZooKeeper).
curl -X POST https://tarn:8888/admin/quotas \
  -H "X-TARN-Token: my-secret-token" \
  -H "Content-Type: application/json" \
  -d @new-quotas.json
# → "published to ZooKeeper (will propagate to all AM replicas)"

# Verify the active rule set.
curl -H "X-TARN-Token: my-secret-token" https://tarn:8888/admin/quotas
```

Clients hitting the rate limit receive:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 42
Content-Type: application/json

{"error": {"message": "Request rate limit exceeded (rule[user=alice,model=llama-3-70b,rpm=60]). Retry after 42s.", "type": "rate_limited"}}
```

## 7. Shadow traffic for offline A/B

Mirror 1 % of production traffic to a separate Triton cluster running a candidate model — discarded responses, only latency and error metrics recorded under `shadow:<model>`:

```bash
yarn jar ... \
  --shadow-endpoint http://triton-v2.experiment:8000 \
  --shadow-sample-rate 0.01
```

Then compare:

```
histogram_quantile(0.95, rate(tarn_inference_latency_seconds_bucket{model="llama-3-70b"}[5m]))
histogram_quantile(0.95, rate(tarn_inference_latency_seconds_bucket{model="shadow:llama-3-70b"}[5m]))
```