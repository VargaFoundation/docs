---
id: faq
title: FAQ
sidebar_position: 10
---

### Does Kirka provide the MLflow UI?

No — Kirka is a headless tracking server. Point the upstream MLflow UI at Kirka
(`mlflow ui --backend-store-uri http://kirka:8080`) or build your own frontend against the
REST API. The OpenAPI schema at `/v3/api-docs` documents every endpoint.

### What HBase tables does it use?

`mlflow_experiments`, `mlflow_experiments_name_index`, `mlflow_runs`,
`mlflow_metric_history`, `mlflow_registered_models`, `mlflow_model_versions`,
`mlflow_prompts`, `mlflow_scorers`, `mlflow_gateway_routes`, `mlflow_gateway_secrets`,
`mlflow_gateway_endpoints`, and `mlflow_audit`. They are **not** auto-created — provision
them once before first start; the CLI is listed in
[Installation and deployment](./installation-deployment.md#hbase-tables).

### Can I use S3 instead of HDFS?

Today: no — Kirka uses the Hadoop FileSystem API with `hadoop.hdfs.uri` pointing at an
HDFS namenode. In practice `s3a://` URIs would work with the right Hadoop S3A JARs on the
classpath, but this combination is not part of the tested matrix.

### How does multi-tenancy work?

Use Ranger policies keyed on resource type + id (see [Ranger setup](./ranger-setup.md)). A
single Kirka instance can host many tenants — the authorization filter on list/search
endpoints only returns rows the caller can read.

For hard isolation, run separate Kirka Deployments per tenant (each with its own HBase
namespace). The Helm chart is designed to run in a namespace per tenant without collision.

### Is the gateway fully functional?

Not yet. Route registration, secrets, endpoint tagging and model attachments work; the
actual upstream invocation (`POST /gateway/query/{name}`) returns `501 Not Implemented`.
LLM proxying with PII masking, quotas and audit is on the roadmap.

### Is `/invocations` supported for model serving?

No — Kirka is the tracking + registry plane, not the serving plane. It records what models
exist and where their artefacts live; actual inference should run on `mlflow models serve`,
Seldon Core, KServe, Ray Serve or any runtime of your choice, fed the URI from Kirka's
`get-download-uri` endpoint.

### How do I rotate the admin password?

Update the bcrypt hash in the htpasswd file backing `security.users.file` — Kirka reloads
it at startup. In Kubernetes the Helm chart supports `basicAuth.existingSecret` so you can
swap the Secret and roll the Deployment.

### What happens if Ranger Admin is down?

The plugin keeps serving requests from its local policy cache (refreshed every 30 s by
default). If Ranger Admin is unreachable **at startup**, the plugin fails to initialise and
Kirka falls back to owner-only authorization — the creator of a resource can still access
it, everyone else is denied. This behaviour is logged at WARN on startup.

### Does the audit log cost a write per request?

Only per mutation. Reads (`get`, `list`, `search`) are not audited by Kirka itself — volume
is high and value is low. Enable Ranger audit for read tracking if you need it; it writes
to Solr/HDFS independently.

### Can I have Kirka auto-create the HBase tables?

Not yet. A Helm pre-install Job doing it is on the roadmap. The CLI in the install docs
is idempotent and runs in seconds, so operators typically wire it into their own
provisioning flow.
