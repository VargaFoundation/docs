---
id: security
title: Security
sidebar_position: 6
---

TARN implements a defense-in-depth security model:

**Authentication & transport**
- **API Token** on every AM endpoint, compared in constant time (`MessageDigest.isEqual` on SHA-256 digests) to defeat timing attacks. Query-string tokens (`?token=…`) are refused — use the `X-TARN-Token` header exclusively so tokens don't leak through access logs, referrers, or browser history.
- **TLS** (opt-in via `--tls-enabled`) for both the admin and OpenAI proxy ports. Keystore password resolved through Hadoop credential providers — never accepted on the CLI in plaintext. TLS 1.2 and 1.3 only; server picks cipher suites.
- **Kerberos SPNEGO** at the Knox edge propagates user identity into `X-Forwarded-User` headers that TARN honors for Ranger and audit.

**Authorization**
- **Apache Ranger** for fine-grained per-model authorization (see below). Defaults to **fail-closed** (`--ranger-strict=true`) when a Ranger service is configured: if the plugin can't initialize, inference is denied and `/health` returns `503 RANGER_UNAVAILABLE`.
- **Inference-level enforcement** on the OpenAI proxy — Ranger is checked both for the base model and for the combined `base#lora` resource, so a policy can grant the base while restricting specific adapters.
- **LoRA-aware policies**: adapter names are discovered from `lora.json` and surface as first-class resources.

**Defense-in-depth hardening**
- **Shell injection closed** in `--model-repository` and `--secrets`: path inputs are matched against a strict allowlist (no spaces, backticks, `$`, `&`, `|`, `;`, `()`, `<>`, quotes, wildcards) before entering the Triton launch command. Paths must start with `hdfs://` or `/`.
- **SSRF guard** on the metrics scraper: loopback, link-local (169.254/16), any-local, multicast addresses and any hostname containing shell metacharacters are rejected up-front.
- **Secret redaction**: the `/config` endpoint scrubs custom env vars whose key matches `KEY|TOKEN|PASSWORD|SECRET|CREDENTIAL|PASSPHRASE|AUTH` (case-insensitive) and never echoes the `apiToken`.
- **Security response headers** on every endpoint:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains` (TLS only)
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: no-referrer`
  - `Cache-Control: no-store`
- **URL decoding** of query parameters uses `URLDecoder.decode(UTF_8)` so Ranger policies matching on decoded names (e.g. `foo bar`) can't be bypassed with `foo%20bar`.
- **Ranger audit** receives the real client IP (from `X-Forwarded-For` when set by Knox/ingress, falling back to the peer socket), plus the authenticated user — no more `0.0.0.0` in audit logs.

**YARN / Kubernetes isolation**
- **YARN Isolation**: Leverages YARN's multi-tenancy and Docker isolation (anti-affinity via `--placement-tag`).
- **Non-root pods** (`runAsUser: 10000`, `runAsNonRoot: true`, read-only FS, `capabilities.drop: ALL`, `seccompProfile: RuntimeDefault`) in the Kubernetes Operator image.

## Quota admin & hot-reload

Regulated clusters need policy changes without operator restarts. TARN exposes both push and pull paths:

- **`POST /admin/quotas`** (token-protected) writes a new JSON rule set to ZooKeeper. Every AM replica hot-reloads within one Curator event (typically < 100 ms).
- **`GET /admin/quotas`** returns the currently active JSON — diffable against your policy git.
- Alternatively, write directly to the shared znode: `zkCli.sh set /services/triton/config/quotas '{"rules":[…]}'`.

Example quotas JSON:

```json
{
  "rules": [
    { "user": "alice", "model": "llama-3-70b", "requestsPerMinute": 60 },
    { "group": "paying-customers", "model": "*", "requestsPerMinute": 300 },
    { "user": "banned-user", "model": "*", "requestsPerMinute": 0 },
    { "model": "*", "requestsPerMinute": 10 }
  ]
}
```

Matching follows first-specific-match: exact user + exact model, exact user + `*`, group + exact model, group + `*`, default rule. `requestsPerMinute: 0` denies immediately without a bucket. Violations return `429 Too Many Requests` with a `Retry-After: <seconds>` header.

## Apache Ranger Integration

TARN integrates with **Apache Ranger** to provide fine-grained access control at the model level. This ensures that users only see and interact with the models they are authorized to use.

### 1. Create Ranger Service Definition

Before you can define policies, you must register the `triton` service definition in Ranger Admin.

1.  Use the following JSON to create a file named `triton-service-def.json`:
    ```json
    {
      "name": "triton",
      "id": 1001,
      "resources": [
        {
          "name": "model",
          "level": 1,
          "parent": "",
          "mandatory": true,
          "lookupSupported": true,
          "recursiveSupported": false,
          "matcher": "org.apache.ranger.plugin.resourcematcher.RangerDefaultResourceMatcher",
          "matcherOptions": { "wildCard": true, "ignoreCase": true },
          "label": "Triton Model",
          "description": "Triton Model Name"
        }
      ],
      "accessTypes": [
        { "name": "infer", "label": "Inference" },
        { "name": "metadata", "label": "Metadata" },
        { "name": "list", "label": "List" }
      ],
      "contextEnrichers": [],
      "policyConditions": []
    }
    ```
2.  Register the service type using the Ranger REST API:
    ```bash
    curl -u admin:password -X POST -H "Content-Type: application/json" \
      http://<RANGER_ADMIN_HOST>:6080/service/plugins/definitions \
      -d @triton-service-def.json
    ```
3.  In the Ranger Admin UI, create a new service instance (e.g., named `triton_prod`) using the newly created `triton` service type.

### 2. Enable Ranger in TARN

To enable Ranger, you must provide the Ranger service name when submitting the application:

```bash
yarn jar tarn-orchestrator.jar varga.tarn.yarn.Client \
  ... \
  --ranger-service triton_prod \
  --ranger-app-id tarn \
  --ranger-audit
```

**Options:**
- `--ranger-service` (`-rs`): The name of the service instance defined in Ranger Admin.
- `--ranger-app-id` (`-ra`): The application ID for Ranger (default: `tarn`).
- `--ranger-audit` (`-raudit`): Enable auditing of access requests in Ranger.

**Environment Variables:**
- `RANGER_SERVICE`
- `RANGER_APP_ID`
- `RANGER_AUDIT`

### 3. Ranger Service Definition Details

The service definition (registered in step 1) includes the following resources and access types:

- **Resource**: `model` (The name of the inference model).
- **Access Types**:
  - `infer`: Permission to run inference requests.
  - `metadata`: Permission to view model configuration/metadata.
  - `list`: Permission to see the model in the discovery list and dashboard.

A complete JSON service definition is available in `SPEC Ranger.md`.

### 4. How it Works

1.  **Identity Propagation**: When accessing the AM Dashboard or API, TARN identifies the user via Kerberos or the `X-TARN-User` header.
2.  **Authorization and Auditing**: For every model available in the HDFS repository, TARN queries the Ranger plugin to check if the user has `list` permission. If `--ranger-audit` is enabled, these access attempts are logged to the configured Ranger audit destination.
3.  **Dynamic Filtering**: Models for which the user does not have permission are automatically filtered out from the Dashboard and service discovery results.
    - `list` permission is required to see models in the HDFS list.
    - `metadata` permission is required to see details of loaded models.

### 5. Authorization API

TARN provides a REST API to check model-level permissions. This can be used by external gateways (like Apache Knox) to enforce security for inference requests.

- **Endpoint**: `http://<AM_HOST>:<AM_PORT>/authorize?model=<name>&action=<action>`
- **Query Parameters**:
  - `model`: The model name.
  - `action`: The access type (`infer`, `metadata`, or `list`).
  - `user`: (Optional) The user to check (defaults to the requester).
- **Response**: `true` or `false`.

Example:
```bash
curl -H "X-TARN-Token: my-token" \
  "http://am-host:8888/authorize?model=resnet50&action=infer&user=alice"
```

### 6. Audit Configuration

To enable auditing, the following conditions must be met:
1. The `--ranger-audit` flag must be set.
2. A `ranger-triton-audit.xml` configuration file must be present in the Application Master's classpath. This file defines where the audits are sent (e.g., Solr, HDFS, or Log4j).

Example `ranger-triton-audit.xml`:
```xml
<configuration>
    <property>
        <name>xasecure.audit.is.enabled</name>
        <value>true</value>
    </property>
    <property>
        <name>xasecure.audit.destination.log4j</name>
        <value>true</value>
    </property>
    <property>
        <name>xasecure.audit.destination.log4j.logger</name>
        <value>ranger.audit</value>
    </property>
</configuration>
```

### 7. Knox Authorization Integration

Apache Knox can be configured to act as a **Policy Enforcement Point (PEP)** by leveraging the TARN Authorization API or by using the Ranger Knox Plugin.

**Using the Authorization API in Knox:**

To integrate Knox with the TARN Authorization API, you can use a custom Rewrite Rule or a specialized Dispatcher.

1.  **Service Definition**: Define a Knox service for Triton.
2.  **Authorization Check**: Configure a Rewrite Rule to perform an out-of-band check or use a custom Knox Dispatcher that calls the TARN AM `/authorize` endpoint.

Example Knox Rewrite Rule for Authorization (pseudo-config):
```xml
<rules>
    <rule dir="IN" name="TRITON/authorize-check" pattern="*://*:*/**/v2/models/{model}/{action}">
        <rewrite template="http://am-host:8888/authorize?model={model}&amp;action={action}&amp;user={$username}"/>
    </rule>
</rules>
```

3.  **Propagation**: Knox should propagate the original user identity using the `X-TARN-User` header when talking to the AM for authorization checks.

**Using the Ranger Knox Plugin:**
Alternatively, you can install the `ranger-knox-plugin` on your Knox gateway and configure it to use the `triton` service definition. This allows Knox to check policies directly against the Ranger Admin server, providing the same level of security as the TARN Application Master but at the edge of the cluster.

Example Knox Topology with Ranger Authorization:
```xml
<topology>
    <gateway>
        <provider>
            <role>authentication</role>
            <name>ShiroProvider</name>
            <enabled>true</enabled>
            <param>
                <name>main.ldapRealm</name>
                <value>org.apache.knox.gateway.shirorealm.KnoxLdapRealm</value>
            </param>
            <param>
                <name>main.ldapRealm.userDnTemplate</name>
                <value>uid={0},ou=people,dc=hadoop,dc=apache,dc=org</value>
            </param>
            <param>
                <name>main.ldapRealm.contextFactory.url</name>
                <value>ldap://localhost:33389</value>
            </param>
        </provider>
        <provider>
            <role>authorization</role>
            <name>XASecurePDPKnox</name>
            <enabled>true</enabled>
        </provider>
    </gateway>
    <service>
        <role>TRITON</role>
        <url>http://haproxy-host:8000</url>
    </service>
</topology>
```

You can include the directory containing this file in the `CLASSPATH` or use the `--env` option to pass configuration properties if supported by the Ranger version.