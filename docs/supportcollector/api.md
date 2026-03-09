---
id: api
title: API Reference
sidebar_position: 5
---

The ODPSC Master exposes a REST API (v2) on port 8085 (configurable).

## Authentication

Two authentication methods are used:

- **Basic Auth**: For management endpoints (bundles, config, status, audit). Uses `admin_username` and `admin_password` configured in `odpsc-site`.
- **API Key (Bearer)**: For agent bundle uploads. The API key is shared between master and agents via `odpsc-site`.

## Endpoints

### Bundle Upload (Agent)

```
POST /api/v2/bundles/upload
Authorization: Bearer <api_key>
X-ODPSC-Bundle-ID: <uuid>
X-ODPSC-Cluster-ID: <cluster-id>
Content-Type: multipart/form-data

bundle=<file>
```

Returns `200` with `{"status": "received"}` or `{"status": "duplicate"}`.

### List Bundles

```
GET /api/v2/bundles?limit=100&offset=0
Authorization: Basic <credentials>
```

### Download Bundle

```
GET /api/v2/bundles/<bundleId>
Authorization: Basic <credentials>
```

### Trigger Collection

```
POST /api/v2/collect
Authorization: Basic <credentials>
Content-Type: application/json

{"level": "L1|L2|L3", "send": false}
```

### Trigger Aggregation

```
POST /api/v2/aggregate
Authorization: Basic <credentials>
```

### Get/Update Configuration

```
GET  /api/v2/config
POST /api/v2/config
Authorization: Basic <credentials>
```

### Get Status

```
GET /api/v2/status
Authorization: Basic <credentials>
```

### Audit Events

```
GET /api/v2/audit?limit=100&offset=0&event_type=bundle_received
GET /api/v2/audit/<bundleId>
Authorization: Basic <credentials>
```

## Rate Limiting

The upload endpoint uses a token bucket algorithm: **30 requests per 60 seconds per IP**. Exceeding the limit returns `429 Too Many Requests`.

## OpenAPI Specification

A full OpenAPI 3.0 specification is available in the repository at `openapi.yaml`.
