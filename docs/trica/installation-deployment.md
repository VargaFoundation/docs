---
id: installation-deployment
title: Installation & Deployment
sidebar_position: 4
---

# Installation & Deployment

Trica runs as one stateless server process in front of PostgreSQL. Three ways to deploy it, all
from the same image or binary:

| Method | For |
|---|---|
| [Helm chart](#kubernetes-helm) | Kubernetes, one or more replicas |
| [Docker Compose](#docker-compose) | One machine, PostgreSQL included |
| [Binary](#binary) | A VM or a host with systemd, your own PostgreSQL |

## Getting the software

The source repository, the container images, the Helm chart and the release binaries are public;
no login is needed:

| Artefact | Where |
|---|---|
| Server image (amd64, arm64, signed with cosign) | `ghcr.io/vargafoundation/trica:X.Y.Z` |
| Backup image (for the backup CronJob) | `ghcr.io/vargafoundation/trica-ops:X.Y.Z` |
| Helm chart | `oci://ghcr.io/vargafoundation/charts/trica` |
| Binaries, checksums, changelog | [GitHub releases](https://github.com/VargaFoundation/trica/releases) |

```bash
helm install trica oci://ghcr.io/vargafoundation/charts/trica --version X.Y.Z \
  -n trica --create-namespace -f values.yaml
cosign verify ghcr.io/vargafoundation/trica:X.Y.Z \
  --certificate-identity-regexp 'https://github.com/VargaFoundation/trica/' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

To mirror the images into your own registry, copy them (`crane copy`, or `docker pull` then
`docker push`) and set `image.repository` in the chart values.

You can also build from the source, for instance to run exactly what you reviewed. The
image needs nothing but the repository (the web UI is built in a Node stage and embedded):

```bash
git clone https://github.com/VargaFoundation/trica && cd trica
git checkout vX.Y.Z                                  # a release tag
docker build --build-arg VERSION=vX.Y.Z -t registry.example.com/trica:X.Y.Z .
docker build --build-arg VERSION=vX.Y.Z --target ops -t registry.example.com/trica-ops:X.Y.Z .
docker push registry.example.com/trica:X.Y.Z
docker push registry.example.com/trica-ops:X.Y.Z    # only for the backup CronJob
```

| Image | Content | Needed for |
|---|---|---|
| `trica` (default target) | Static binary with the embedded UI, on distroless, uid 65532 | The server |
| `trica-ops` (`--target ops`) | The same binary plus the PostgreSQL 17 client tools | `trica backup` / `trica restore` |

Released images are multi-arch (amd64, arm64) and signed with cosign (keyless); see
[Operations](./operations.md#verifying-a-release).

## PostgreSQL requirements

- **PostgreSQL 17** — the version trica is tested and backed up with (`pg_dump` 17 in the ops
  image). A managed service, an operator-managed cluster (CloudNativePG, Zalando, …) or a plain
  server all work.
- **Extensions** `pg_trgm` and `btree_gist`. The first migration runs `CREATE EXTENSION IF NOT
  EXISTS` for both: either the trica role may create them (database owner on PostgreSQL 13+ for
  these trusted extensions), or an administrator creates them beforehand.
- **One database, one owner role.** Trica creates and migrates its own tables at start
  (`migrate_on_start`, under an advisory lock, safe with several replicas).
- **Connect directly, or through a pooler in session mode.** Trica uses session advisory locks
  (one collector runner, one sweeper and one deducer at a time) and `LISTEN/NOTIFY` between
  replicas. A pooler in transaction mode (PgBouncer default) breaks both.
- **TLS** as your network requires: `sslmode=require` or `verify-full` in the URL.
- Sizing: a site of a few thousand devices is a small database (hundreds of MB with history). The
  server itself requests 100m CPU and 128 MiB, limited to 512 MiB, by default.

The connection URL is the only secret the server needs. It is **never** a key of the
configuration file: it is read from a file (`database.url_file`, a mounted Secret) or from
`TRICA_DATABASE_URL`, and never logged.

## Kubernetes (Helm)

The chart deploys the server only; PostgreSQL is yours. It assumes no particular secret manager,
policy engine, CNI or ingress controller, and `values.schema.json` rejects unknown or mistyped
keys.

```bash
kubectl create namespace trica
kubectl -n trica create secret generic trica-db \
  --from-literal=database-url='postgres://trica:PASSWORD@db.example.com:5432/trica?sslmode=require'

# from the source tree
helm install trica ./charts/trica -n trica -f my-values.yaml
# or from the OCI registry, if you have access
helm install trica oci://ghcr.io/vargafoundation/charts/trica --version X.Y.Z -n trica -f my-values.yaml

kubectl -n trica rollout status deploy/trica
```

The chart refuses to render without `database.existingSecret`. Minimal values:

```yaml
image:
  repository: registry.example.com/trica
  tag: "X.Y.Z"
imagePullSecrets: []              # [{name: registry-credentials}] for a private registry
database:
  existingSecret: trica-db        # key database-url, mounted as a file
```

A fuller example (every value generic):

```yaml
replicaCount: 2
podDisruptionBudget: {enabled: true}

config:                           # passed to the server as is, see Configuration
  policy:
    absent_after: 30m
    propose: ["mcp:*"]
  auth:
    oidc:
      issuer: https://sso.example.com/realms/example
      audience: [trica]
    group_roles:
      infra-admins: [admin]
      infra-operators: [operator]
  web:
    oidc:
      client_id: trica-ui

ingress:
  enabled: true
  className: nginx                # any controller; empty = cluster default
  annotations: {}
  hosts: [trica.example.com]
  tls:
    - {secretName: trica-tls, hosts: [trica.example.com]}

networkPolicy:
  enabled: true                   # default
  ingressFrom:                    # empty = any pod of the release namespace
    - namespaceSelector:
        matchLabels: {kubernetes.io/metadata.name: ingress-system}
  egressTo:                       # empty = egress open; when set, list the database
    - to:
        - namespaceSelector:
            matchLabels: {kubernetes.io/metadata.name: databases}
      ports: [{port: 5432, protocol: TCP}]

serviceMonitor: {enabled: true}   # needs the Prometheus Operator CRDs
```

:::note
The NetworkPolicy is **on by default** and admits only pods of the release namespace on the HTTP
port. With an Ingress, add the ingress controller's namespace to `networkPolicy.ingressFrom`, or
its traffic is dropped. When `egressTo` is set, also list the identity provider and the devices
the in-server collectors reach.
:::

### Chart values

| Key | Default | Meaning |
|---|---|---|
| `database.existingSecret` / `urlKey` | required / `database-url` | Secret holding the PostgreSQL URL, mounted as a file, never an environment variable |
| `image.repository` / `tag` / `digest` | `ghcr.io/vargafoundation/trica` / appVersion / `""` | A digest takes precedence over the tag |
| `imagePullSecrets` | `[]` | For a private registry |
| `replicaCount` | `1` | Several replicas are safe (advisory locks) |
| `config` | see chart | Server configuration; `http.addr`, `database.url_file` and the paths below are set by the chart |
| `schemaOverlays` | `{}` | Custom schema files, one key per file |
| `service.type` / `port` | `ClusterIP` / `8080` | |
| `ingress.enabled` / `className` / `annotations` / `hosts` / `tls` | off | Generic Ingress for the HTTP port |
| `networkPolicy.enabled` / `ingressFrom` / `egressTo` | `true` / `[]` / `[]` | See the note above |
| `transport.enabled` / `port` / `hosts` / `existingClaim` / `ingressFrom` | off / `8443` | Mutual-TLS endpoint for agents and remote collectors; needs the names agents dial and a PersistentVolumeClaim for the CA (ReadWriteMany with several replicas) |
| `collect.enabled` / `targets` / `targetsConfigMap` / `secrets` | off | In-server collectors; credentials are Secrets mounted under `/var/run/secrets/collect/NAME/` and referenced as `file:` paths |
| `collect.kubernetes.rbac.enabled` | `false` | Read-only ClusterRole for an `in-cluster` Kubernetes target; mounts the service account token |
| `serviceMonitor.enabled` / `interval` / `labels` | `false` / `30s` / `{}` | Prometheus Operator scrape of `/metrics` |
| `podDisruptionBudget.enabled` / `minAvailable` | `false` / `1` | |
| `backup.enabled` / `schedule` / `existingClaim` / `image` | off / `17 2 * * *` | Logical backup CronJob for a PostgreSQL that has no backups of its own |
| `resources`, `podSecurityContext`, `securityContext` | 100m / 128Mi–512Mi; non-root 65532, read-only root, no capabilities, RuntimeDefault seccomp | |
| `serviceAccount.*`, `nodeSelector`, `tolerations`, `affinity`, `podAnnotations`, `podLabels` | | Standard |

### First token on Kubernetes

```bash
TOKEN=$(kubectl -n trica exec deploy/trica -- trica token create --config /etc/trica/trica.yaml \
  --name first-admin --owner alice --roles admin --scopes admin)
```

Whoever may `kubectl exec` into the pod can read the database URL, so restrict that right with
cluster RBAC.

## Docker Compose

`deploy/compose/` holds a Compose file with PostgreSQL 17, the server and an `ops` service for
backups (profile `ops`, never started by `up`):

```bash
cd deploy/compose
cp .env.example .env               # TRICA_DB_PASSWORD, TRICA_BIND, TRICA_IMAGE
docker compose up -d --build
curl -fsS http://127.0.0.1:8080/readyz
```

`TRICA_IMAGE` selects an image from your registry instead of building. The server runs read-only,
with all capabilities dropped. Put a TLS reverse proxy in front before publishing the port
beyond `127.0.0.1`.

## Binary

```bash
make web-install web-build                                 # Node 22: the UI, into internal/web/dist
CGO_ENABLED=0 go build -trimpath -tags webui \
  -ldflags "-s -w -X main.version=vX.Y.Z" -o trica ./cmd/trica
install -m 0755 trica /usr/local/bin/trica
```

Without `-tags webui` the binary serves a placeholder page instead of the UI. Run it as an
unprivileged user:

```bash
trica server --config /etc/trica/trica.yaml    # database.url_file: /etc/trica/database-url (0600)
```

A minimal configuration file:

```yaml
database:
  url_file: /etc/trica/database-url
http:
  addr: ":8080"
log_level: info
policy:
  propose: ["mcp:*"]
```

## The Linux agent

`trica-agent` is built and packaged from the same repository:

```bash
make package-agent VERSION=X.Y.Z      # static binaries, deb and rpm for amd64 and arm64, in dist/
```

The package installs a hardened systemd unit (dedicated user, `ProtectSystem=strict`, three
capabilities) that is not started until you configure `/etc/trica-agent/agent.env`. An example
DaemonSet is in `deploy/kubernetes/`. See [Collectors](./collectors.md#linux-agent).

## Upgrades

Install the new image (or chart version); the server migrates the database at start. Read the
[Operations](./operations.md#upgrades) page before an upgrade.
