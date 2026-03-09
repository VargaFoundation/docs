---
id: configuration
title: Configuration
sidebar_position: 3
---

All ODPSC settings are managed through the Ambari UI under the **ODP Support Collector** service configuration (`odpsc-site`).

## Master Configuration

| Property | Default | Description |
|----------|---------|-------------|
| `collection_enabled` | `true` | Enable or disable diagnostic collection |
| `auto_send_enabled` | `true` | Automatically send bundles to support endpoint |
| `send_frequency` | `weekly` | Collection frequency: `daily`, `weekly`, or `monthly` |
| `master_port` | `8085` | Port for the ODPSC Master REST API |
| `admin_username` | `admin` | Admin username for management endpoints |
| `admin_password` | — | Admin password (stored as bcrypt hash) |
| `api_key` | — | API key shared between master and agents for upload authentication |
| `encryption_key` | — | AES-256-GCM key for bundle encryption (leave empty to disable) |
| `max_upload_size_mb` | `100` | Maximum upload size per agent bundle |
| `max_bundle_size_mb` | `500` | Maximum aggregated bundle size |
| `gunicorn_workers` | `2` | Number of Gunicorn worker processes |

## Storage Configuration

| Property | Default | Description |
|----------|---------|-------------|
| `hdfs_path` | `/odpsc/diagnostics` | HDFS path for bundle archival |
| `hdfs_archive_enabled` | `false` | Enable HDFS archival of aggregated bundles |

## Support Endpoint

| Property | Default | Description |
|----------|---------|-------------|
| `support_endpoint` | — | HTTPS URL for direct support upload |
| `support_token` | — | Bearer token for the support API |

## SupportPlane Integration

| Property | Default | Description |
|----------|---------|-------------|
| `supportplane_enabled` | `false` | Enable SupportPlane integration |
| `supportplane_endpoint` | — | SupportPlane upload URL (e.g., `https://supportplane.example.com/api/v1/bundles/upload`) |
| `supportplane_token` | — | Bearer token for SupportPlane authentication |
| `attachment_otp` | — | One-time password for cluster attachment |
| `cluster_id` | — | Unique cluster identifier for SupportPlane correlation |

## Agent Configuration

| Property | Default | Description |
|----------|---------|-------------|
| `bundle_level` | `L1` | Collection depth: `L1`, `L2`, or `L3` |
| `log_paths` | — | Glob patterns for log files to collect (e.g., `/var/log/hadoop/**/*.log`) |
| `config_paths` | — | Glob patterns for configuration files |
| `max_log_size_mb` | `1` | Maximum size per log file in bundles |
| `log_retention_days` | `7` | Only collect logs from the last N days |

## Security Configuration

| Property | Default | Description |
|----------|---------|-------------|
| `tls_enabled` | `false` | Enable TLS for the master API |
| `tls_cert_path` | — | Path to TLS certificate file |
| `tls_key_path` | — | Path to TLS private key file |
| `audit_enabled` | `false` | Enable the audit trail for bundle operations |

## Audit

When `audit_enabled` is `true`, ODPSC logs all bundle operations (received, aggregated, sent) with full traceability:

- Bundle ID, cluster ID, hostname
- Direction (inbound/outbound) and destination
- File sizes and content summaries
- Timestamps

Audit events are queryable via the `/api/v2/audit` endpoint.
