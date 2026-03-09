---
id: cluster-onboarding
title: Cluster Onboarding
sidebar_position: 4
---

## Overview

Cluster onboarding connects an ODP cluster running ODPSC to a SupportPlane tenant. The process uses a one-time password (OTP) to securely validate the connection.

## Onboarding Workflow

```
┌──────────┐                    ┌──────────────┐                    ┌──────────┐
│  Tenant  │                    │ SupportPlane │                    │  ODPSC   │
│  (User)  │                    │   (Server)   │                    │ (Cluster)│
└────┬─────┘                    └──────┬───────┘                    └────┬─────┘
     │                                 │                                 │
     │  1. Attach cluster              │                                 │
     │  POST /clusters/attach          │                                 │
     │────────────────────────────────>│                                 │
     │                                 │                                 │
     │  2. Returns OTP (6-digit)       │                                 │
     │<────────────────────────────────│                                 │
     │                                 │                                 │
     │  3. Configure OTP in Ambari     │                                 │
     │  (odpsc-site > attachment_otp)  │                                 │
     │─────────────────────────────────────────────────────────────────>│
     │                                 │                                 │
     │                                 │  4. Validate OTP               │
     │                                 │  POST /clusters/validate-otp   │
     │                                 │<────────────────────────────────│
     │                                 │                                 │
     │                                 │  5. Cluster ACTIVE             │
     │                                 │────────────────────────────────>│
     │                                 │                                 │
     │                                 │  6. Upload bundles             │
     │                                 │  POST /bundles/upload          │
     │                                 │<────────────────────────────────│
     │                                 │                                 │
```

## Step-by-Step

### 1. Attach Cluster in SupportPlane

Log in to the SupportPlane UI as a tenant user and navigate to **Clusters** → **Attach Cluster**.

Provide:
- **Cluster Name**: A human-readable name for your cluster
- **Cluster ID**: The unique identifier configured in ODPSC (`cluster_id` in `odpsc-site`)

The system generates a **6-digit OTP** valid for 10 minutes.

### 2. Configure ODPSC

In the Ambari UI, navigate to **ODP Support Collector** → **Configs** and set:

| Property | Value |
|----------|-------|
| `supportplane_endpoint` | `https://supportplane.example.com/api/v1/bundles/upload` |
| `cluster_id` | The cluster ID used in step 1 |
| `attachment_otp` | The 6-digit OTP from step 1 |
| `supportplane_enabled` | `true` |

Save and restart the ODPSC service.

### 3. Automatic Validation

When ODPSC restarts, it sends the OTP to SupportPlane for validation. Once validated:
- The cluster status changes to **ACTIVE** in SupportPlane
- ODPSC begins uploading bundles automatically
- The OTP is consumed and cannot be reused

### 4. Verify Connection

In SupportPlane UI:
- Navigate to **Clusters** — your cluster should show as **ACTIVE**
- After the first collection cycle, bundles will appear under the cluster

## Troubleshooting

- **OTP Expired**: Generate a new OTP by detaching and re-attaching the cluster
- **Cluster stays PENDING**: Check network connectivity from the cluster to SupportPlane
- **Bundles not appearing**: Verify the `supportplane_endpoint` URL is correct and includes `/api/v1/bundles/upload`
