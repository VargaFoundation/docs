---
id: api
title: REST API
sidebar_position: 10
---

# REST API

The API is served under `/api/v1/`, behind a bearer credential (an API token or an OIDC JWT, see
[Security](./security.md)). Its OpenAPI 3.1 document is generated at each request from the routes
and the live schema: `GET /api/v1/openapi.json`. A custom attribute added by a schema overlay is
in the document as soon as the server loads it.

```bash
curl -fsS -H "Authorization: Bearer $TOKEN" https://trica.example.com/api/v1/me
curl -fsS -H "Authorization: Bearer $TOKEN" \
  'https://trica.example.com/api/v1/search?q=type:device%20vendor:arista%20os_version<4.20'
```

## Concepts

- **Objects** have a type, identity attributes, attributes and a parent; **relations** are typed
  links. Every value is a claim from a source with a confidence (`observed` or `declared`), valid
  over a time range.
- **Time travel**: most reads take `at=` (RFC 3339) for the state at a date.
- **Writes are batches.** `POST /batches` hands a batch to the reconciliation engine: 200 when
  applied, 202 when queued as a proposal. The source comes from the credential, never from the
  body; one refused object refuses the whole batch. `POST /batches/preview` returns the effect
  without writing.

## Endpoints

| Method and path | Action | What it does |
|---|---|---|
| `GET /me` | read | The caller and the actions it holds |
| `GET /health/collection` | read | Last run of every source |
| `GET /schema`, `/schema/types/{type}` | read | Types, attributes, relation types |
| `GET /objects` | read | List, with `q` (TQL), `type`, `sort`; paged |
| `GET /objects/{id}` | read | One object, optionally `at` a date |
| `GET /objects/{id}/provenance` | read | Source, confidence and age of each attribute |
| `GET /objects/{id}/history` | read | Values over time |
| `GET /objects/{id}/relations` | read | Relations now or `at` a date |
| `GET /objects/{id}/timeline` | read | Changes that touched the object |
| `GET /relations` | read | Relations of some types across the inventory, both ends named |
| `GET /racks/{id}/contents` | read | What an elevation needs: devices, positions, faces, heights |
| `GET /search` | read | Free text or TQL: counts per type, then a page |
| `GET /whohad` | read | Which objects had a value (`key`, `value`, optional `at`) |
| `GET /changes` | read | Change feed between two dates |
| `POST /batches`, `/batches/preview` | propose | Submit or preview a batch |
| `GET /proposals`, `/proposals/{id}` | read | Proposals, with a preview against the current state |
| `POST /proposals/{id}/approve`, `/reject` | approve | Decide a proposal (409 if already decided) |
| `GET /discrepancies` | read | Declared against observed |
| `POST /discrepancies/{id}/accept` | approve | Accept a difference, with a reason |
| `GET/POST /saved-queries`, `GET/DELETE /saved-queries/{name}` | read / propose | Saved queries |

## Errors and pagination

Every failure is an RFC 9457 problem (`application/problem+json`) whose `type` is
`urn:trica:problem:SLUG`: `invalid-request`, `invalid-query`, `invalid-batch`,
`secret-attribute` (400), `unauthenticated` (401), `forbidden`, `sensitive-attribute` (403),
`not-found` (404), `conflict` (409), `too-large` (413, bodies over 8 MiB), `rejected` (422, a
batch the engine refuses), `internal` (500, cause logged only), `auth-unavailable` (503, with
`Retry-After`).

Lists answer `{"items": [...], "total": N, "limit": N, "offset": N}`; `limit` is 1 to 1000
(default 50). Out-of-range values are a 400, never silently clamped. Lists filtered by rights scan
a bounded number of candidates and say `truncated: true` when the cap was hit.

## Limits

- The server terminates no TLS and sends no CORS headers: put it behind a reverse proxy or an
  Ingress.
- A caller whose rights are limited to some sites reads objects by id but cannot list or search.
- Approval is not four-eyes: the author of a proposal may approve it if they hold `approve`.
- Secret-looking attributes are never returned, queried, sorted on or written.

## Query language (TQL)

The search bar, the API and the MCP tools take the same queries:

```
sw-a1
192.0.2.13
type:device vendor:arista os_version<4.20
type:disk wear_pct>70 rel.mounted_in:"rack 2"
type:device role:server sort:-power_w limit:10
(vendor:arista OR vendor:mikrotik) -has:serial
type:device mgmt_ip<<192.0.2.0/24
```

Free text matches names, addresses in any notation, MACs and serials (exact first, then typo
tolerant). `:` equals (with `*` wildcards), `!=`, `<`/`>` compare numbers as numbers and versions as
versions (`4.9.1 < 4.20.7M`), `~` contains, `<<` is "address or prefix within a prefix".
