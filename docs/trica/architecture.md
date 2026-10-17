---
id: architecture
title: Architecture
sidebar_position: 3
---

# Architecture

```
  devices (read-only)        hosts                         people, scripts, AI assistants
  ─────────────────────      ─────                         ─────────────────────────────────
  Arista  MikroTik  pfSense  trica-agent                   web UI   REST API   MCP
  Redfish  MAAS  Kubernetes     │ mutual TLS                  │ bearer token or OIDC JWT
        │                       ▼                             ▼
        ├──► collectors ──► batches ──► reconciliation engine ◄── batches / proposals
        │   (in the server,              │  (single writer)
        │    or remote over mTLS)        ▼
        │                           PostgreSQL 17
        │                  objects · claims · relations · history · audit log
```

## Components

| Component | Role |
|---|---|
| `trica server` | One process: HTTP (web UI, REST API, MCP), the reconciliation engine, the absence sweep, the cabling deducer, the device-type matcher, in-server collectors, and optionally the mutual-TLS ingestion endpoint. Stateless apart from PostgreSQL (and the CA directory when the transport is on). |
| `trica collector` | The same collectors, run next to equipment the server cannot reach; sends batches over mutual TLS, spools on disk when the server is away. |
| `trica-agent` | Static Linux binary (deb, rpm, or a DaemonSet) reporting the host: hardware, OS, packages, disks, interfaces, listening sockets. |
| PostgreSQL 17 | The only state: the inventory, its history, proposals, tokens, the audit log. |

## Data flow

1. **Every change is a batch.** A collector run, an agent run, a UI declaration, an import, an MCP
   proposal: each is an `sdk.Batch` of objects, attributes and relations, from a **source**
   (`arista:sw-a1`, `agent:host-01`, `user:alice`, `mcp:claude-code`, `import:legacy`).
2. **One writer.** Only the reconciliation engine writes the inventory. It identifies objects,
   resolves each attribute from all sources' claims (observed above declared, then per-attribute
   priorities), records history, opens discrepancies when a declared value disagrees with an
   observed one, and either applies the batch or queues it as a **proposal** (per-source policy).
3. **Absence, not deletion.** A full-scope batch withdraws what its source no longer reports; an
   observed object nobody has seen for `policy.absent_after` is marked absent. History keeps
   everything. A failed or partial run never withdraws anything.
4. **Reads** — the UI, the API and the MCP server read the current state, any past state (`at=`),
   history, provenance and change feeds. The MCP graph tools (impact, paths) use an in-memory graph
   rebuilt after commits; replicas notify each other through PostgreSQL `LISTEN/NOTIFY`.

## Store

PostgreSQL holds bi-temporal tables: each claim and relation has a validity range, so "the state
at T" is a query. Migrations are embedded in the binary and applied at start under an advisory
lock. Advisory locks also make several replicas safe: one sweeps, one deduces, one collects at a
time, any replica serves reads and writes.

The audit log is hash-chained and append-only (the database refuses `UPDATE`, `DELETE` and
`TRUNCATE` on it); each replica periodically logs the chain head so truncation can be detected
from outside the database.

## Schema

The built-in schema (sites, buildings, rooms, rows, racks, devices, interfaces, transceivers, PSUs,
fans, sensors, disks, IP addresses, prefixes, VLANs, cables, firewall rules, tunnels, Kubernetes
clusters, nodes, namespaces, workloads, pods, services, ingresses, virtual machines, device
types, version policies, …) is extended with YAML overlays loaded at start
([Configuration](./configuration.md)). The OpenAPI document and the UI forms follow the schema
automatically.

## Identity scopes

Private address ranges are reused between sites. A **domain** (VRF, site, network) set on a
collector target or an agent becomes part of the identity of the addresses and prefixes it
reports: `10.0.0.1` in two domains is two objects.
