---
id: mcp
title: MCP Server
sidebar_position: 11
---

# MCP Server

Trica serves its inventory to AI assistants over the Model Context Protocol at `/mcp`
(streamable HTTP), behind the same bearer authentication, RBAC, rate limit and audit log as the
REST API. It is **read-only by default**: the only write tool, `propose_change`, queues a proposal
that a person approves.

## Connect

```bash
TOKEN=$(trica token create --name claude-code --owner alice --roles operator --scopes write)
claude mcp add --transport http trica https://trica.example.com/mcp \
  --header "Authorization: Bearer $TOKEN"
```

Use `--scopes read` for an assistant that should not even propose. Any MCP client that speaks
streamable HTTP with a bearer header works the same way.

## Tools

| Tool | Answers |
|---|---|
| `search` | Free text or TQL: "everything about 192.0.2.13" |
| `rank_filter` | Top-N by an attribute: "the 10 servers drawing the most power" |
| `filter_objects` | Attribute conditions: "devices with reversed airflow" |
| `list_objects`, `get_object`, `object_summary` | One type; one object now or at a date; attributes, provenance, relations, changes and discrepancies in one answer |
| `object_history`, `changes_since` | "What was plugged into this port last month?", "what changed since yesterday that was not planned?" |
| `version_compliance` | Versions against a target or a `version_policy` object: "switches behind the firmware reference" |
| `forecast_threshold` | Linear trend of a numeric attribute: "SSDs that will reach 80 % wear within six months" |
| `impact_analysis` | "If this switch fails, which applications go down?" |
| `network_path` | "How are the API and its database connected?" |
| `describe_schema` | Types, attributes, relations |
| `propose_change` | Queues a batch as a proposal, returns its id and a preview |

Answers start with a counted summary (total, per type, truncated or not) and then one page.
Objects are designated by id, name, address, serial or `device/port`; an ambiguous name is refused
with the candidates, never guessed. Times are RFC 3339, a date, or relative (`24h`, `7d`).

## Guarantees

- Every call is authorised per object type and site; what a caller may not read is neither listed,
  counted nor named. The graph tools fail closed: a path through an object the caller may not read
  is refused, not shown in part.
- `propose_change` is offered only to a credential holding `propose`. Its batch is attributed to
  `mcp:NAME`, has partial scope (it withdraws nothing by omission) and declared confidence. No tool
  approves, rejects or deletes.
- Every call is audited; secret-looking attributes are never returned and cannot be queried.
- The forecast is a straight line through recorded changes, without seasonality or confidence
  interval: a value that never changed is one point, reported as insufficient history.
