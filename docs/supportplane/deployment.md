---
id: deployment
title: Deployment
sidebar_position: 3
---

## Quick Start with Docker Compose

For development or small-scale deployments:

```bash
git clone https://github.com/VargaFoundation/supportplane.git
cd supportplane
docker-compose up --build
```

This starts all components:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8081
- **Keycloak**: http://localhost:8080
- **PostgreSQL**: localhost:5432

### Default Credentials

| Service | Username | Password |
|---------|----------|----------|
| Keycloak Admin | `admin` | `admin` |
| Operator (support realm) | `operator` | `operator123` |

Tenants register through the UI at http://localhost:3000/register.

## Production Deployment with Kubernetes

### 1. Configure Values

Create a custom `values.yaml`:

```yaml
backend:
  image:
    repository: your-registry/supportplane-backend
    tag: latest
  replicaCount: 2

frontend:
  image:
    repository: your-registry/supportplane-frontend
    tag: latest

secrets:
  postgres:
    password: "<strong-password>"
  keycloak:
    adminPassword: "<strong-password>"

ingress:
  enabled: true
  className: nginx
  hosts:
    - host: supportplane.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: supportplane-tls
      hosts:
        - supportplane.example.com

bundleStorage:
  size: 50Gi
```

### 2. Build and Push Images

```bash
# Backend
cd backend
docker build -t your-registry/supportplane-backend:latest .
docker push your-registry/supportplane-backend:latest

# Frontend
cd ../frontend
docker build -t your-registry/supportplane-frontend:latest .
docker push your-registry/supportplane-frontend:latest
```

### 3. Deploy with Helm

```bash
helm install supportplane ./helm/supportplane \
  -f values.yaml \
  --namespace supportplane \
  --create-namespace
```

### 4. Verify Deployment

```bash
# Check pods
kubectl get pods -n supportplane

# Check health
curl https://supportplane.example.com/actuator/health
```

## Configuration Reference

### Backend Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SPRING_DATASOURCE_URL` | PostgreSQL JDBC URL | `jdbc:postgresql://postgres:5432/supportplane` |
| `SPRING_DATASOURCE_USERNAME` | Database user | `supportplane` |
| `SPRING_DATASOURCE_PASSWORD` | Database password | `supportplane` |
| `KEYCLOAK_AUTH_SERVER_URL` | Keycloak base URL | `http://keycloak:8080` |
| `APP_BUNDLE_STORAGE_PATH` | Bundle file storage path | `/var/lib/supportplane/bundles` |
| `APP_CORS_ALLOWED_ORIGINS` | Allowed CORS origins | `http://localhost:3000` |

### Frontend Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `/api/v1` |

## Database

SupportPlane uses **Flyway** for database migrations. The schema is automatically applied on first startup. No manual database setup is required beyond creating the database and user.

### Schema Overview

The database contains 11 tables: `tenants`, `users`, `clusters`, `cluster_otp`, `bundles`, `tickets`, `ticket_comments`, `recommendations`, `notifications`, `licenses`, and associated indexes.

## Using an External PostgreSQL

To use an existing PostgreSQL instance instead of the bundled one:

```yaml
# In Helm values.yaml
postgres:
  enabled: false

backend:
  env:
    SPRING_DATASOURCE_URL: "jdbc:postgresql://your-pg-host:5432/supportplane"
    SPRING_DATASOURCE_USERNAME: "supportplane"
    SPRING_DATASOURCE_PASSWORD: "your-password"
```
