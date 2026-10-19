---
id: getting-started
title: Getting Started
sidebar_position: 2
---

# Getting Started

This page runs trica on one machine with Docker Compose, creates the first credential, points one
collector at a device and connects an AI assistant. For Kubernetes, see
[Installation & deployment](./installation-deployment.md).

## Prerequisites

- Docker with the Compose plugin.
- A checkout of the trica source repository:
  `git clone https://github.com/VargaFoundation/trica` (public, Apache-2.0).

## 1. Start the server and PostgreSQL

```bash
cd trica/deploy/compose
cp .env.example .env
$EDITOR .env                       # set TRICA_DB_PASSWORD
docker compose up -d --build       # builds the image from the checkout
curl -fsS http://127.0.0.1:8080/readyz && echo ready
```

The server applies the database migrations on its first start. Its configuration is
`deploy/compose/trica.yaml` ([Configuration](./configuration.md)); the database URL is assembled
from `.env` and never written to that file. The port is published on `127.0.0.1` only; set
`TRICA_BIND` in `.env` to publish it elsewhere, behind TLS.

## 2. Create the first API token

A fresh deployment has no credential and no anonymous access. The first token is created next to
the server, by someone who already has database access:

```bash
TOKEN=$(docker compose exec -T trica trica token create \
  --name first-admin --owner alice --roles admin --scopes admin)
curl -fsS -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8080/api/v1/me
```

The token is printed once, alone, on stdout; only its hash is stored. Open
`http://127.0.0.1:8080/`, paste it in the sign-in form, and the UI is yours. Single sign-on through
any OpenID Connect provider is described in [Security](./security.md#single-sign-on-oidc).

## 3. Collect from a first device

Collectors are read-only and use accounts you create on the device
([Collectors](./collectors.md)). For an Arista switch with a `network-operator` account, add to
`trica.yaml`:

```yaml
collect:
  targets_file: /etc/trica/targets.yaml
```

create `targets.yaml` and a file holding the switch password next to `compose.yaml`:

```yaml
targets:
  - kind: arista
    name: sw-a1
    address: https://192.0.2.10
    username: monitor
    password: file:/run/secrets/arista-password
    tls: {insecure: true}        # self-signed switch certificate; prefer ca_file
    interval: 5m
```

and mount both into the server with a `compose.override.yaml` (Compose reads it automatically):

```yaml
services:
  trica:
    volumes:
      - ./targets.yaml:/etc/trica/targets.yaml:ro
      - ./arista-password:/run/secrets/arista-password:ro
```

The password file must be readable by uid 65532, the user the image runs as. Restart the server (`docker compose up -d`). After the first run, the switch, its interfaces,
VLANs, addresses, transceivers and LLDP neighbours are searchable, and
`GET /api/v1/health/collection` (or the **Health** page) shows how the run went.

## 4. Connect an AI assistant (MCP)

Create a token that can read and propose, but not approve:

```bash
MCP_TOKEN=$(docker compose exec -T trica trica token create \
  --name claude-code --owner alice --roles operator --scopes write)
claude mcp add --transport http trica http://127.0.0.1:8080/mcp \
  --header "Authorization: Bearer $MCP_TOKEN"
```

Ask "which switches are behind EOS 4.20?" or "what changed since yesterday?". Anything the
assistant wants to write becomes a proposal you approve in the UI. See [MCP](./mcp.md).

## Next steps

- Declare rooms, racks and device positions from the UI (**Rooms**, **Racks**).
- Add the [Linux agent](./collectors.md#linux-agent) to your hosts.
- Plan [backups](./operations.md#backup-and-restore) before the inventory matters.
