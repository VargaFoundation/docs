---
id: installation-deployment
title: Installation & Deployment
sidebar_position: 3
---

## Build

Standard build using default Maven repositories:

```bash
mvn clean package
```

### Building with Enterprise Distributions (ODP by Clemlab, Cloudera...)

If you are using enterprise distributions like **ODP** (Open Source Data Platform) by **Clemlab**, or **Cloudera**, you need to configure specific Maven repositories to fetch the distribution-specific Hadoop binaries.

#### 1. Configure Repositories

Add the ODP public repository to your `pom.xml` or your `~/.m2/settings.xml`:

```xml
<repositories>
    <repository>
        <id>odp-public</id>
        <url>https://repo.opensourcedataplatform.com/repository/maven-public/</url>
    </repository>
</repositories>
```

#### 2. Specify Distribution Version

You should align the `hadoop.version` with your distribution's version. You can do this by overriding the property during the build:

```bash
mvn clean package -Dhadoop.version=3.3.6.1.2.4.0-32
```

#### 3. Testing with Distribution Binaries

To run tests using the distribution-specific dependencies:

```bash
mvn test -Dhadoop.version=3.3.6.1.2.4.0-32
```

## Docker

The Docker image is automatically built and published to GitHub Container Registry on every push to `main`.

Pull the pre-built image:

```bash
docker pull ghcr.io/varga-foundation/tarn:latest
```

Or build from source:

```bash
docker build -t tarn:latest .
```

## Deployment on Kubernetes (Helm)

Tarn is distributed as a Helm chart via an OCI registry on GitHub Container Registry.

### Install from the registry

```bash
helm install tarn oci://ghcr.io/varga-foundation/charts/tarn --version 1.0.0 \
  --namespace tarn --create-namespace \
  --set config.yarnResourceManagerAddress=rm:8032 \
  --set config.zookeeperQuorum=zk1:2181
```

### Install from local sources

```bash
helm install tarn ./helm -n tarn --create-namespace
```

### Helm values

Create a `values.override.yaml` to customize the deployment:

```yaml
config:
  hadoopConfDir: "/etc/hadoop/conf"
  yarnResourceManagerAddress: "rm:8032"
  zookeeperQuorum: "zk1:2181,zk2:2181,zk3:2181"
  tritonDockerImage: "nvcr.io/nvidia/tritonserver:24.09-py3"
  modelStoragePath: "hdfs:///models"

resources:
  limits:
    memory: "2Gi"
    cpu: "2000m"
  requests:
    memory: "1Gi"
    cpu: "1000m"

# Mount Hadoop configuration files
volumes:
  - name: hadoop-conf
    configMap:
      name: hadoop-config
volumeMounts:
  - name: hadoop-conf
    mountPath: /etc/hadoop/conf
```

Then install:

```bash
helm install tarn oci://ghcr.io/varga-foundation/charts/tarn --version 1.0.0 \
  -f values.override.yaml -n tarn --create-namespace
```

### Verify

```bash
kubectl get pods -n tarn
kubectl logs -l app.kubernetes.io/name=tarn -n tarn
```

### Uninstall

```bash
helm uninstall tarn -n tarn
```

## CI/CD

GitHub Actions automatically:
1. Builds the Maven project and runs tests.
2. Builds and pushes the Docker image to `ghcr.io/varga-foundation/tarn`.
3. Packages and pushes the Helm chart to `oci://ghcr.io/varga-foundation/charts/tarn`.

Triggers: push/PR to `main`/`master`, or manual workflow dispatch.

## Deployment on YARN

To submit the application directly to YARN:

```bash
yarn jar target/tarn-orchestrator-0.0.1-SNAPSHOT.jar varga.tarn.yarn.Client \
  --model-repository [model_path] \
  --image [triton_image] \
  --port [triton_port] \
  --metrics-port [metrics_port] \
  --am-port [am_port] \
  --address [bind_address] \
  --token [security_token] \
  --tp [tensor_parallelism] \
  --pp [pipeline_parallelism] \
  --secrets [hdfs_jks_path] \
  --placement-tag [tag] \
  --scale-up [threshold] \
  --scale-down [threshold] \
  --min-instances [count] \
  --max-instances [count] \
  --cooldown [ms] \
  --jar [local_jar_path] \
  --env KEY1=VALUE1 --env KEY2=VALUE2
```

**Example:**

```bash
yarn jar target/tarn-orchestrator-0.0.1-SNAPSHOT.jar varga.tarn.yarn.Client \
  --model-repository hdfs:///user/models \
  --image nvcr.io/nvidia/tritonserver:24.09-py3 \
  --port 8000 \
  --metrics-port 8002 \
  --am-port 8888 \
  --address 0.0.0.0 \
  --token my-secret-token \
  --tp 2 \
  --pp 1 \
  --secrets hdfs:///user/secrets/hf.jceks \
  --placement-tag nvidia \
  --scale-up 0.8 \
  --scale-down 0.2 \
  --min-instances 2 \
  --max-instances 8 \
  --cooldown 120000 \
  --jar target/tarn-orchestrator-0.0.1-SNAPSHOT.jar \
  --env TRITON_LOG_VERBOSE=1
```