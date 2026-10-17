---
id: index
title: Overview
sidebar_position: 1
---

# Trica

**An infrastructure inventory that knows where each fact comes from.** Trica is a CMDB/DCIM:
it discovers a datacentre (switches, routers, firewalls, servers through their BMCs, bare-metal
provisioning, Kubernetes clusters and the Linux hosts themselves), keeps every observed and
declared value with its **source**, its **confidence** and its **history**, and answers questions
about it through a search bar, rack and topology views, a REST API and an MCP server for AI
assistants.

It is one Go binary (server, embedded web UI, collectors) backed by PostgreSQL, plus a small
Linux agent. Licence: Apache-2.0.

## Why another CMDB

- **Provenance on every value.** "The OS version is 4.20.7M, read on the switch three minutes ago;
  the documentation says 4.18." Both claims are kept; the disagreement is a first-class
  *discrepancy* you can list, accept or fix.
- **History by construction.** The state at any date, the diff between two dates, and "who had
  this IP address on March 3rd" are queries, not archaeology. Nothing is ever deleted: an object
  that stops being seen is marked *absent*, and its past stays readable.
- **Discovery first, declaration where nothing can be discovered.** Rack positions, rooms and
  passive equipment (PDUs, patch panels) are declared from the UI; everything a device can
  report is collected.
- **Nothing written behind your back.** Collectors only read devices, with read-only accounts.
  Writes from AI assistants (and, if you wish, from any source) go to a **proposal queue** with a
  preview of their effect, and a person approves them.

## The historised graph

Everything is an *object* of a typed schema (site, room, rack, device, interface, IP address,
VLAN, cable, Kubernetes workload, …) linked by typed *relations* (`mounted_in`, `member_of`,
`neighbor_of`, `hosts`, …). Every attribute value and every relation is a *claim* made by a
source, valid over a time range. A single reconciliation engine:

1. matches incoming observations to existing objects (strong identifiers such as serial numbers
   and MAC addresses first, then weaker ones scoped by parent);
2. resolves each attribute from its claims by per-attribute source priorities, observed values
   ranking above declared ones;
3. records history, opens discrepancies, and marks unseen objects absent.

The schema is extensible with YAML overlays (custom types and attributes) without code changes.

## Discovery

| Source | How |
|---|---|
| Arista EOS switches | eAPI, `show` commands only |
| MikroTik RouterOS | RouterOS API, a `read,api` group |
| pfSense firewalls | REST API v2 package, GET only |
| Servers (HPE iLO 4/5, Dell iDRAC 8, other Redfish BMCs) | Redfish, a login-only account |
| Canonical MAAS | MAAS API, GET only |
| Kubernetes (and KubeVirt) | `get`/`list`/`watch` on a fixed set of resources, never Secrets or ConfigMaps |
| Linux hosts | `trica-agent`, a static binary with a narrow capability set, over mutual TLS |
| Equipment models | A bundled library in the NetBox device-type format (rack height, depth, airflow, ports) |

Cabling is deduced from LLDP neighbours and MAC tables, and the deduced cables can be routed
through the proposal queue. See [Collectors](./collectors.md).

## Interfaces

- **Web UI** — search (free text or the TQL query language), object pages with provenance and
  timeline, discrepancies, proposals, collection health, room floor plans, rack elevations,
  layer-2 topology, exports.
- **REST API** under `/api/v1/`, with a generated OpenAPI 3.1 document. See [API](./api.md).
- **MCP server** at `/mcp` (streamable HTTP) — search, filters, rankings, version compliance,
  wear forecasts, impact analysis, network paths, history; one write tool that only creates
  proposals. See [MCP](./mcp.md).
- **CLI** — tokens, enrolment, migrations, backup and restore, export and import.

## Where to go next

- [Getting started](./getting-started.md) — a running instance on one machine in a few minutes.
- [Architecture](./architecture.md) — components, data flow, the store.
- [Installation & deployment](./installation-deployment.md) — Helm, Docker Compose, binary.
- [Configuration](./configuration.md) and [Security](./security.md).
