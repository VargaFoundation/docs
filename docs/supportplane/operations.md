---
id: operations
title: Operations
sidebar_position: 5
---

## Operator Dashboard

Operators (support staff) log in via the support realm in Keycloak and access the operator dashboard, which provides:

- Overview of all tenants and their clusters
- Total bundle count and latest upload timestamps
- Active tickets across all tenants
- License status per tenant

## Managing Tenants

Operators can view all registered tenants at **Operator** → **Tenants**:
- Tenant name and ID
- License tier and limits
- Number of active clusters
- Account status

## License Management

Navigate to **Operator** → **Licenses** to manage per-tenant licenses:

| Field | Description |
|-------|-------------|
| `tier` | License tier (e.g., `BASIC`, `STANDARD`, `ENTERPRISE`) |
| `max_clusters` | Maximum number of clusters the tenant can attach |
| `max_users` | Maximum number of users in the tenant |
| `valid_from` / `valid_until` | License validity period |

## Recommendations

Operators can create recommendations for specific clusters:

1. Navigate to **Operator** → **Recommendations**
2. Create a recommendation with:
   - **Title** and **Description**
   - **Severity**: `INFO`, `WARNING`, or `ERROR`
   - **Target Cluster**: The cluster this recommendation applies to
3. Publish the recommendation to make it visible to the tenant

## Ticketing

Tenants create support tickets from their dashboard. Operators can:

- View all tickets across tenants
- Assign tickets to team members
- Update ticket status (`OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`)
- Add comments

## Notifications

Tenants can configure notification channels:

- **Email**: SMTP-based notifications for ticket updates and bundle events
- **Webhook**: HTTP POST notifications to external systems

Configure at **Admin** → **Notifications**.

## Monitoring

### Health Check

```bash
curl https://supportplane.example.com/actuator/health
```

### API Documentation

SupportPlane exposes an OpenAPI specification:

- **Swagger UI**: `https://supportplane.example.com/swagger-ui.html`
- **OpenAPI JSON**: `https://supportplane.example.com/api-docs`

## Backup

### Database

Back up the PostgreSQL database regularly:

```bash
pg_dump -h <host> -U supportplane supportplane > backup.sql
```

### Bundle Storage

The bundle files are stored at the path configured in `APP_BUNDLE_STORAGE_PATH` (default: `/var/lib/supportplane/bundles`). Include this directory in your backup strategy.

## Scaling

- **Backend**: Increase `replicaCount` in Helm values for horizontal scaling. The backend is stateless (bundles stored on shared PVC).
- **PostgreSQL**: Consider a managed PostgreSQL service (AWS RDS, GCP Cloud SQL, Azure Database) for production.
- **Keycloak**: Can be scaled horizontally with shared database and cache (Infinispan).
