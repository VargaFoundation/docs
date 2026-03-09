---
id: index
title: SupportPlane — Partner & Provider Guide
sidebar_position: 1
---

SupportPlane is a multi-tenant cluster management platform for solution providers and partners who need to manage, monitor, and support ODP Hadoop clusters at scale. It provides a centralized interface for receiving diagnostic bundles from ODPSC, managing support tickets, and monitoring cluster health.

This section is intended for **solution providers and partners** who want to deploy and operate their own SupportPlane instance.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    SupportPlane                          │
│                                                          │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐           │
│  │  Frontend  │  │  Backend   │  │ Keycloak  │           │
│  │  (React)   │  │ (Spring)   │  │  (Auth)   │           │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘           │
│        │              │              │                   │
│        └──────────────┼──────────────┘                   │
│                       │                                  │
│                ┌──────▼──────┐                           │
│                │ PostgreSQL  │                           │
│                └─────────────┘                           │
└──────────────────────────────────────────────────────────┘
         ▲                    ▲
         │                    │
    ┌────┴────┐          ┌────┴────┐
    │ Tenant  │          │ ODPSC   │
    │  Users  │          │ Clusters│
    └─────────┘          └─────────┘
```

## Key Features

- **Multi-tenant Isolation**: Each tenant (customer) has isolated data, users, and clusters via JWT-based tenant context
- **Cluster Attachment**: OTP-based secure cluster onboarding with automatic validation
- **Bundle Reception**: Receive and store diagnostic bundles from ODPSC collectors
- **Ticketing System**: Create, assign, and track support tickets per cluster
- **Operator Dashboard**: Global view across all tenants for support operators
- **License Management**: Per-tenant license tiers with cluster and user limits
- **Recommendations**: Push optimization recommendations to tenants
- **Notification System**: Configurable email and webhook notifications

## Roles

| Role | Description |
|------|-------------|
| **OPERATOR** | Support staff — can view all tenants, manage licenses, create recommendations |
| **ADMIN** | Tenant administrator — can manage users and configure notifications |
| **USER** | Tenant user — can view clusters, create tickets, view bundles |

## Next Steps

- [Prerequisites](./prerequisites.md)
- [Deployment](./deployment.md)
- [Cluster Onboarding](./cluster-onboarding.md)
- [Operations](./operations.md)
