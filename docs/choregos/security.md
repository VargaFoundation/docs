---
id: security
title: Security
sidebar_position: 10
---

# Security

This page answers one question: **what stops an agent from doing damage?** The answer is never "the prompt
forbids it".

## Threat model

A coding agent runs unreviewed code, in a repository that matters, with a model that can be wrong or
manipulated (ticket text, repository content, poisoned memory). We assume **an agent may attempt anything**,
by mistake or by injection. And a platform that hosts several organisations must assume **a member of one
will try to read another**.

## What stops it

| Threat | Mechanism |
| :-- | :-- |
| writing outside the allowed paths | permission refused, then the diff is verified after the run, reverted, and the `scope_respected` gate |
| lying about evidence | the runner **runs** the tests and overwrites declared evidence; gates read the diff, not the prose |
| exfiltration or internet pollution | egress is closed and bounded in three scopes (organisation ceiling, project, agent version) with a deny list that always wins; a per-run egress proxy enforces host, port and rate |
| using credentials | none in the workspace; the agent never holds the run token; a run's pod, checks and git start from a clean environment |
| pushing a secret | `no_secrets` on the diff, sensitive files refused, secret scanning in CI |
| a run writing to a third party without approval | a catalogue tool that may write is neither offered nor callable unless governed; writes are **governed actions** that wait for a re-authenticated human approval |
| deciding from a tracker comment or an API client | comments and MCP calls are answered with a console link and never signalled to the workflow; decisions need the console and a fresh sign-in |
| spending without limit | one virtual key per run with a hard cap; budgets per work item, stage, project day, organisation month |
| escaping the container | non-root, no capabilities, seccomp, required by policy on every pod; the agent is confined at launch by Landlock to its workspace and the proxy's ports |
| a malicious skill or plugin | a supply-chain gate with pattern scan and offline static analysis on every published version; plugins are signed and pinned by digest; servers and high-risk skills need a second administrator |
| prompt injection | lexical detection before a run (`warn` or `block`), tool results framed as data, schema-checked and capped; a net for crude cases, not an understanding |
| a secret leaving for the model provider | with the analyser on, gateway guardrails mask known token shapes in requests and responses |
| reading another organisation | PostgreSQL row-level security, **fail-closed**: a session that declares nothing sees nothing |
| a page acting with your console session | origin guard on cookie-authenticated mutations; session cookies `Secure`; recorded, endable sessions |
| an outside agent deciding for a person | A2A and MCP doors serve opted-in workflows to scoped tokens; no decision tool exists on them; a machine account is not a person |
| touching production | release train, deployment windows, `production: true` states reachable only through a train |

## What is not a wall

Stated rather than discovered:

- The runner's guardrails are a **net** by default and a wall only on request (the `regulated` preset refuses
  requests whose nature cannot be classified).
- The egress proxy sees a TLS tunnel, not what is inside: method, path and headers are invisible to it, and
  its rate limit counts connections. It is a wall only together with the chart's NetworkPolicies.
- Claude Code's own web search runs at the model provider, outside every Choregos network layer: the lever is
  to deny the tool.
- The origin guard protects browsers only; a CLI has no `Origin`.
- Row-level security needs a **non-superuser** role: the API refuses to start as a superuser in `staging` and
  `prod`.
- Development sign-in opens the API to anyone who can reach it. It exists for benches only.

## Egress

Egress is bounded by the organisation's ceiling, the project's policy and the agent version's list, which only
narrow one another; the network of a run is their intersection plus the repository's host minus every deny
list. An agent that asks for a host its project does not allow is refused when published, and its run at
admission. The platform's own outbound clients follow an organisation allowlist decided by administrators and
**fail closed** when a call has no policy in context.

## Decisions that need a fresh sign-in

Approving a work item, a governed action, a release or an agent's move to production requires a recent
sign-in. A person who left the audience or was disabled at the identity provider loses these at the next
request.

## Identity on a tool call (from 0.26)

By default a connector is called with its own credential. In assistants, a connector may be called **as the
person**, so the source decides what that person reads:

- `user_exchange`: an RFC 8693 token exchange at each call, never cached, used once, never logged or handed to
  an agent.
- `user_consent`: an OAuth authorization code with PKCE; the refresh token is sealed and owner-only under
  row-level security; revocation deletes the secret at once.
- **No fallback** to the service identity: a missing token or account is a typed error, journaled.
- **Standing delegation** for background tasks is explicit, read-only, time-bounded (90 days by default),
  revocable at once, suspended when the person leaves the audience or the task's needs change, and journaled
  with its id.

A dedicated security review of the exchange and of offline tokens is required before production use.

## Secrets

Secrets are never plain values in configuration. Connector secrets typed in the console are sealed under a
key ring (`secrets-keks`) and write-only. Run-token keys, the session secret, the GitHub App key, webhook
secrets and the gateway key are rotated on a schedule with two valid keys during the transition
([Operations](operations.md#rotating-secrets)).

## Supply chain

Images are signed (cosign) and multi-arch, referenced by digest in staging and production. Plugins carry a
reproducible content digest, are fetched only from sources that declare a signer, and are pinned to a
commit. A Kyverno policy restricts plugin-server images to allowed registries.

## Reporting a vulnerability

Follow the repository's
[security policy](https://github.com/VargaFoundation/choregos/blob/main/SECURITY.md). Do not open a public
issue for a vulnerability.
