---
id: troubleshooting
title: Troubleshooting
sidebar_position: 13
---

# Troubleshooting

Start with the **Health** page (`GET /api/v1/health/collection`): every collector and agent source
has its last run there, with the error of each failed command or request. Server logs are JSON on
stderr; `log_level: debug` adds detail without ever logging a credential.

## Installation

- **`ImagePullBackOff`, `denied` or `unauthorized` pulling `ghcr.io/vargafoundation/trica`**:
  the packages are public, so this is usually a tag that does not exist (check the
  [releases](https://github.com/VargaFoundation/trica/releases)), stale credentials for `ghcr.io`
  on the node (a wrong token is refused even for a public image), or a cluster that cannot reach
  `ghcr.io` (mirror the image into your registry,
  [Installation](./installation-deployment.md#getting-the-software)).
- **`helm install` fails with `database.existingSecret is required`**: create the Secret holding
  the URL (key `database-url`) and pass its name. Other render-time guards name what is missing
  (`ingress.hosts`, `transport.hosts`, `transport.existingClaim`, `backup.existingClaim`, targets
  for `collect.enabled`).
- **`Additional property … is not allowed`**: a misspelled or unsupported chart value, rejected by
  the chart's schema.
- **The server stops at start with an unknown key**: the configuration file rejects unknown keys.
  Check the spelling against [Configuration](./configuration.md).
- **First migration fails with `permission denied to create extension`**: the role cannot create
  `pg_trgm` or `btree_gist`. Make the trica role the database owner, or have an administrator run
  `CREATE EXTENSION pg_trgm; CREATE EXTENSION btree_gist;` in the trica database.
- **Collectors run on several replicas, or replicas see changes late, behind PgBouncer**: a
  pooler in transaction mode does not keep session advisory locks or `LISTEN`. Connect directly or
  in session mode.
- **`/readyz` fails while `/healthz` answers**: the database does not answer within 2 s (network
  policy egress, DNS, TLS mode in the URL, credentials).
- **The UI shows a page saying it is not built in**: the binary was built without `-tags webui`.
  Run `make web-build` first, then build with the tag (the Docker image always does).

## Behind an Ingress

- **The Ingress returns 502/504 while the pod is ready**: the chart's NetworkPolicy, on by
  default, admits only pods of the release namespace. Add the ingress controller's namespace to
  `networkPolicy.ingressFrom`.
- **Collectors or OIDC time out once `networkPolicy.egressTo` is set**: egress is then limited to
  DNS and what is listed. Add the database, the identity provider (HTTPS) and the device networks.

## Signing in

- **JWTs get 503 `auth-unavailable`**: the OIDC issuer could not be reached for discovery. The
  server keeps retrying; API tokens keep working meanwhile. Check egress and the issuer URL (exact,
  `https`).
- **SSO succeeds in the browser, then every API call is 401**: the token the UI sends lacks the
  audience in `auth.oidc.audience`. Add an audience mapper for the access token in the provider,
  or set `web.oidc.bearer: id_token` and accept the client id as audience.
- **Signed in but every write is 403**: the user's groups map to no role with `propose`; check
  the groups claim (`auth.oidc.groups_claim`) and `auth.group_roles`.
- **`token create` refuses the roles**: a role must exist in the policy, and a scope cannot exceed
  the roles (`--scopes admin` needs `admin`).

## Collectors

- **Old BMCs fail with `TLS handshake timeout`**: some management controllers (older HPE iLO 4
  firmware notably) take more than ten seconds to complete a TLS handshake. Trica allows up to 30 s
  per handshake, but never beyond the target's `timeout`: give such targets `timeout: 60s` or more,
  and `tls.min_version: "1.0"` if the firmware offers only TLS 1.0/1.1. Connections are reused
  within a run, so the handshake is paid once.
- **Arista: error 1003 "unconverted command"**: the EOS release has no JSON output for that
  command. Trica treats it as unavailable on that release (a warning, with fallbacks for uptime,
  LAG members and LLDP), not as a failure. Other eAPI errors on one command make the run partial
  and name the command.
- **Arista: the account can run more than `show`**: command authorization is off, so the role is
  not enforced. Configure `aaa authorization commands all default local` (see
  [Collectors](./collectors.md#arista-eos)).
- **Arista on an old release refuses HTTPS**: use `address: http://...` on a management network
  only.
- **pfSense: HTTP 403 on a section**: the API user's group lacks the GET privilege of that
  endpoint. The health names the endpoint: add the matching `api-v2-…-get` privilege, or put the
  section in `options.skip`. A 401 means the key is wrong or API-key authentication is not enabled
  in the REST API settings.
- **MAAS: zero machines, or far fewer than expected**: the API key belongs to a non-administrator,
  who only sees unallocated machines and its own. The run is reported partial (nothing is
  withdrawn). Use a dedicated administrator for a complete inventory.
- **Kubernetes: the collector times out on a cluster running CI or batch jobs**: finished pods can
  outnumber live ones by far and make the pod list huge. Leave `options.finished_pods` at `false`
  (the default) and raise `timeout` if the cluster is large. A 403 on one resource makes the run
  partial and names the list: the ClusterRole lacks it.
- **MikroTik api-ssl handshake fails**: the router has no certificate on the api-ssl service; set
  one and trust it with `tls.ca_file`.
- **`trica_collect_skipped_total` grows**: a run lasts longer than its interval. Lengthen the
  interval.
- **The start fails on the targets file**: unknown keys, duplicate `kind:name`, or a password that
  is a value instead of a `file:` / `env:` reference.

## Agents and remote collectors

| Symptom | Cause | Fix |
|---|---|---|
| `server answered 401` at enrolment | Token unknown, used or expired | Create a new token |
| `server answered 403` on a batch | The token was for another binding than `agent:HOSTNAME` | Revoke it; create one for the hostname the agent reads |
| `x509: certificate signed by unknown authority` | `--ca-file` is not this server's CA (recreated?) | Copy the current `ca.pem` |
| `certificate expired and renewal failed` | The agent was off longer than its certificate lived | New token; the binding can enrol again |
| 409 at enrolment with a class token | That name already holds a valid certificate (state directory lost) | Revoke the old certificate or wait for its expiry |
| Spool files never leave | A 401 stops the flush (certificate revoked) | Delete `identity.pem`, enrol again |

## Data

- **An object marked absent although it exists**: its source has not reported it for
  `policy.absent_after`, or the source's target changed name or `domain` (new identities). Failed
  and partial runs never mark anything absent.
- **Two objects for one device**: different sources identified it differently (no shared serial or
  MAC). Look at the identity attributes on both object pages; a declared serial or base MAC
  usually reunites them on the next run.
- **A declared value is ignored**: an observed value wins over a declared one; the disagreement is
  listed under **Discrepancies**.
