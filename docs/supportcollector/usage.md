---
id: usage
title: Usage
sidebar_position: 4
---

## Automatic Collection

Once deployed and configured, ODPSC automatically collects diagnostics at the configured frequency (`daily`, `weekly`, or `monthly`). Agents collect data from their local nodes, create ZIP bundles, and upload them to the master.

The master aggregates all pending bundles and optionally sends them to the configured support endpoint or SupportPlane.

## Manual Collection

You can trigger a manual collection at any time via the REST API:

```bash
curl -X POST -u admin:admin \
  -H "Content-Type: application/json" \
  -d '{"level": "L2", "send": true}' \
  http://<master-host>:8085/api/v2/collect
```

Parameters:
- `level`: Collection depth (`L1`, `L2`, or `L3`)
- `send`: If `true`, automatically send the aggregated bundle after collection

## Manual Aggregation

To aggregate all pending bundles without triggering a new collection:

```bash
curl -X POST -u admin:admin \
  http://<master-host>:8085/api/v2/aggregate
```

## View Bundles

List all received bundles:

```bash
curl -u admin:admin http://<master-host>:8085/api/v2/bundles
```

Download a specific bundle:

```bash
curl -u admin:admin \
  http://<master-host>:8085/api/v2/bundles/<bundle-id> \
  -o bundle.zip
```

## View Status

Check the current master status:

```bash
curl -u admin:admin http://<master-host>:8085/api/v2/status
```

## Update Configuration

Modify configuration at runtime (without restarting):

```bash
curl -X POST -u admin:admin \
  -H "Content-Type: application/json" \
  -d '{"send_frequency": "daily", "auto_send_enabled": true}' \
  http://<master-host>:8085/api/v2/config
```

## View Audit Trail

When audit is enabled, query audit events:

```bash
# All events
curl -u admin:admin http://<master-host>:8085/api/v2/audit

# Events for a specific bundle
curl -u admin:admin http://<master-host>:8085/api/v2/audit/<bundle-id>

# Filter by event type
curl -u admin:admin "http://<master-host>:8085/api/v2/audit?event_type=bundle_sent"
```

## SupportPlane Integration

To connect ODPSC to a SupportPlane instance:

1. In SupportPlane, attach your cluster and obtain the **OTP** (one-time password)
2. In Ambari, configure the following properties in `odpsc-site`:
   - `supportplane_endpoint`: Your SupportPlane URL (e.g., `https://supportplane.example.com/api/v1/bundles/upload`)
   - `supportplane_token`: Your SupportPlane API token
   - `attachment_otp`: The OTP obtained from SupportPlane
   - `cluster_id`: A unique identifier for your cluster
3. Enable SupportPlane: set `supportplane_enabled` to `true`
4. Restart the ODPSC service

Aggregated bundles will now be automatically forwarded to SupportPlane.
