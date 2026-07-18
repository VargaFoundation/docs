---
id: security
title: Security
sidebar_position: 6
---

# Security

## Secure by default

A memory engine holds personal data by construction. Ecphoria **refuses to start** unauthenticated on
a non-loopback interface — an unauthenticated server on the network is an open read/write database.
Fix one of:

1. Enable auth — `gateway.auth_enabled=true` + `api_keys`.
2. Bind loopback only — `listen="127.0.0.1:8432"`.
3. Explicitly accept the risk on a trusted network — `allow_insecure=true`.

## Authentication & authorization

- **API keys** — Bearer tokens, stored as SHA-256 digests (`sha256:<hex>`) so no plaintext credential
  sits at rest. Keys carry a tenant and role: `<secret>@<tenant>:<role>`.
- **JWT (HS256)** and **OIDC (RS256 / JWKS)** for federated SSO.
- **RBAC** — admin / writer / reader / agent roles gate methods and admin paths.
- **Tenant isolation** — enforced on every read path (SQL, memories, semantic, state, sessions) via
  AST rewriting; tenant-strict cross-scope grants let one user read another's memories *within the
  same tenant*, behind a pluggable `AuthzBackend` seam.
- **PostgreSQL wire auth** — the password is the API key/JWT; optional TLS encrypts it in transit.

## Input & network hardening

- **Webhook signatures** — per-vendor HMAC verification (GitHub, Slack, Sentry, PagerDuty); optional
  fail-closed mode rejects unsigned sources.
- **SSRF guard** — the MCP tool-gateway blocks outbound calls to loopback / private / link-local
  addresses (including the cloud-metadata endpoint) unless explicitly allowed.
- **Prompt-injection hardening** on the RAG/LLM-proxy path.
- **SQL** — a SELECT-only whitelist (sqlparser) on the query path.

## Cluster security

- **Inter-node auth** — a shared Bearer secret (`ECPHORIA_CLUSTER__SECRET`) required on every Raft
  RPC (constant-time check), so an unauthorized node can't inject AppendEntries/Vote.
- **TLS / mTLS** — the Raft gRPC transport can run over TLS with optional peer-cert verification.

## Supply chain

Releases are signed with cosign and ship an SBOM. A threat model and a security policy
(`SECURITY.md`) are maintained in the repository.
