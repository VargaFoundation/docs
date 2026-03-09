---
id: prerequisites
title: Prerequisites
sidebar_position: 2
---

## System Requirements

### Docker Compose Deployment (Development / Small Scale)

- Docker 20.10+
- Docker Compose 2.0+
- 4 GB RAM minimum
- 20 GB disk space for bundle storage

### Kubernetes Deployment (Production)

- Kubernetes 1.24+
- Helm 3.0+
- Persistent storage (StorageClass for PostgreSQL and bundle storage)
- Ingress controller (nginx-ingress, traefik, etc.)
- TLS certificates for production domains

## Components

| Component | Technology | Resource (default) |
|-----------|-----------|-------------------|
| Backend | Java 17 / Spring Boot 3.2 | 1 CPU, 1 Gi memory |
| Frontend | React 18 / Nginx | 500m CPU, 256 Mi memory |
| PostgreSQL | PostgreSQL 15 | 1 CPU, 1 Gi memory |
| Keycloak | Keycloak 24 | 1 CPU, 1 Gi memory |

## Ports

| Service | Default Port |
|---------|-------------|
| Frontend | 3000 (dev) / 80 (prod) |
| Backend API | 8081 |
| Keycloak | 8080 |
| PostgreSQL | 5432 |

## External Dependencies

- A DNS name for the SupportPlane instance (e.g., `supportplane.example.com`)
- SMTP server for email notifications (optional)
- TLS certificates for HTTPS (production)
