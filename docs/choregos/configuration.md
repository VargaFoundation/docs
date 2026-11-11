---
id: configuration
title: Configuration
sidebar_position: 4
---

# Configuration

Configuration lives at three levels: the **deployment** (Helm values and `CHOREGOS_*` environment
variables, set by the operator), the **organisation** (connectors, policy ceiling, catalogues, plugins, set
by administrators in the console or the API) and the **project** (workflow, policy, connectors, set by its
owners, usually as files in the repository's `.choregos/` folder).

## Deployment values

| Value | Meaning |
| :-- | :-- |
| `global.domain`, `publicUrl`, `apiUrl` | hosts; an instance has one host for the console and one for the API, and builds the OIDC redirect URI, the MCP OAuth metadata and notification links from them |
| `global.environment` | `dev`, `staging` or `prod`; the last two turn on strict checks (secure cookies, no development sign-in, no embedded dependencies) |
| `global.edition` | `community` (a single organisation) or `enterprise` |
| `global.runner.executor` | what runs agent stages: `agent_sandbox` (default), `k8s_job`, `tekton`, `aca`, `local_docker` |
| `global.oidc.*` | issuer, client, default organisation for unprefixed groups |
| `global.mcp.oauth.*` | OAuth for the MCP door (claude.ai and other remote clients), see [Integrations](integrations.md) |
| `global.plugins.*` | plugin sources, default plugins, offline directory, plugin servers (see [Plugins](plugins.md)) |
| `global.egress.*` | the per-run egress proxy and the deployment's egress ceiling |
| `global.extraEnv` | extra environment variables for the API and the workers (a variable the chart already sets is refused at render time) |
| `global.tracing.otlpEndpoint` | OpenTelemetry GenAI traces; empty means off |
| `monitoring.flavour` | `prometheus` or `victoriametrics` |

Secrets are never values: they are referenced by name (see [Installation](installation-deployment.md#secrets)).

## Policy

A project's `.choregos/policy.yaml` declares budgets, allowed scope, sandbox, network, memory and release
train rules. Three presets ship as a starting point and can be named with `policy: preset:team`:

| Preset | Intent |
| :-- | :-- |
| `solo` | one person, light guardrails |
| `team` | the sensible default for a team |
| `regulated` | strictest: unknown agent requests are refused, prompt injection blocks a stage, the model-bound secret analyser is on |

An organisation has a **policy ceiling**: the widest network, the biggest monthly budget, the backends it
allows. A project only tightens it, and an agent version only tightens the project.

## Budgets

Every model call is minted against a per-run virtual key with a hard cap, and lands in a cost ledger with its
project, work item, stage and model. A key is minted at what is **left**: the smallest of the stage budget,
the agent's run and day budgets, the work item's budget, the project's day budget and the organisation's
month budget, each minus what was already spent and what open keys reserve. A stage stopped on budget is
never retried (a retry would mint a fresh key); a person decides, and more money is a decision
(`choregos items action <id> rerun_stage --top-up 5`). Assistants add per-conversation, per-person-month
and per-installation-month caps (from 0.26, see [Assistants](assistants.md#budgets-and-retention)).

## Models

A stage asks for `profile:<tier>`, `profile:by_size` or a model name. The resolver looks, in order, at the
project's profiles, the organisation's tier, then the platform's aliases, and checks the result against the
gateway's list, the backend, the eval matrix and the organisation's model catalogue. Gateways supported:
LiteLLM (default), any OpenAI-compatible endpoint, or direct provider access.

## Network

What a run may reach is bounded in three scopes that only narrow one another: organisation, project
(`sandbox.network`) and agent version (`network`). Egress is always closed: an empty list means no
internet. A host pattern `example.com` covers that host and its subdomains, `*.example.com` only its
subdomains, and IP addresses are never allowed. See [Security](security.md#egress).

## Workflows

A workflow is a versioned YAML state machine pinned to a work item when it starts. It is validated
statically: unreachable states, unbounded retry loops, unknown gates and gates with nothing to check are
rejected when written.

```yaml
apiVersion: choregos/v1
kind: Workflow
metadata: { name: default-simple, version: 1 }
actors:
  dev:      { type: agent, role: implement, model: "profile:standard", max_turns: 40, max_minutes: 30 }
  reviewer: { type: agent, role: verify,    model: "profile:standard", max_turns: 20, max_minutes: 15 }
  owner:    { type: human, group: maintainers, sla_hours: 24 }
states:
  inbox:       { display: Inbox, kind: wait }
  in_progress: { display: In progress }
  verifying:   { display: Verifying }
  done:        { display: Done, terminal: true }
  needs_human: { display: Needs a human, kind: wait }
transitions:
  - id: t-implement
    from: inbox
    to: in_progress
    by: dev
    gates: [evidence_present]
    on_fail: { to: inbox, max_attempts: 2, escalate_to: needs_human }
  - id: t-verify
    from: in_progress
    to: verifying
    by: reviewer
    gates: [evidence_present]
    on_fail: { to: in_progress, max_attempts: 2, escalate_to: needs_human }
  - id: t-accept
    from: verifying
    to: done
    by: owner
    timeout_hours: 48
defaults:
  from_any_agent_state:
    on_question: needs_human
    on_budget_exceeded: needs_human
    on_timeout: needs_human
```

A human actor's `group` is the identity provider's. It may name the project the workflow runs in
(`group: "{project}-maintainers"`), so one shared workflow serves every project with its own approvers.
A system transition says what the platform does (`does: open_pr`, `does: merge_pr`) and a production state
says so (`production: true`, reachable only through a release train).
