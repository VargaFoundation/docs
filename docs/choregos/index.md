---
id: index
title: Overview
sidebar_position: 1
---

# Choregos

**A governed-agent platform.** Choregos (from the Greek *choregos*, the one who leads the chorus and
gives it the means to perform) runs workflows from any trade (software delivery, operations, joiners and
leavers, data change) that agents and humans move forward under **measured guarantees**. It directs a
chorus of agents (Claude Code, Codex, Gemini CLI, Goose, OpenCode and others) behind a single protocol,
[ACP](https://agentclientprotocol.com), gives each run a disposable space, a model, a budget and a score,
and makes every write to a third-party system wait for a re-authenticated human approval.

It also gives people **assistants**: conversational agents shipped by plugins, installed by an
organisation for an audience, reachable from the console, from claude.ai through an MCP door, or embedded
in an internal web application (available from 0.26, see [Assistants](assistants.md)).

Licence: Apache-2.0. Source: [github.com/VargaFoundation/choregos](https://github.com/VargaFoundation/choregos).
Latest release: 0.25.3.

## Principles

1. **The tracker is the human interface.** GitHub Issues and Projects, Jira or GitLab stay the place where
   decisions are made; Choregos writes the state, the cost and the evidence there. A work that exists
   nowhere else can live in Choregos itself (`tracker: internal`).
2. **The orchestrator plans, it never calls a model.** Temporal workflows decide which stage to launch;
   only the runners talk to the agents.
3. **The runner is disposable; memory and results are durable.**
4. **Every guarantee is a mechanism** (a gate, a sandbox, a diff check), never a sentence in a prompt.
5. **Production is a lock**: merge queue, release train, declarative guardrails.

## Architecture on one map

```text
tracker --webhooks--> API --signals--> orchestrator (Temporal)
                       |                  |- WorkflowInterpreter (one work item)
                       |                  |- ReleaseTrain (one environment)
                       |                  |- FindingsTriage, ProjectProvisioning, EvalMatrix...
                       |                  v
                       |             Executor (agent sandbox | K8s Job | Tekton | Container Apps | local Docker)
                       |                  v
                       +--internal API<-- runner --ACP--> agent --MCP--> governed tools
                                            |                 |
                                            v                 v
                                       object store      model gateway (LiteLLM) --> models
```

| Part | Role |
| :-- | :-- |
| API (FastAPI) | REST, webhooks, SSE, the MCP and A2A doors, OIDC sign-in, row-level security |
| Orchestrator workers | Temporal workflows: one work item, one release train, provisioning, evals |
| Runner | Headless ACP client that applies guardrails, loops on the definition of done and publishes a result |
| Console (Next.js) | Board, runs, trains, findings, memory, assistants, administration |
| Model gateway | One virtual key per run (and per assistant turn), hard-capped |
| PostgreSQL, Temporal | State, under fail-closed row-level security; durable execution |

## Where to go next

| You want to | Read |
| :-- | :-- |
| Try it on your machine | [Getting started](getting-started.md) |
| Install it on a cluster | [Installation and deployment](installation-deployment.md) |
| Understand the vocabulary | [Concepts](concepts.md) |
| Package agents, skills, templates | [Plugins](plugins.md) |
| Give people a conversational assistant | [Assistants](assistants.md) |
| Connect Claude or start a workflow from outside | [MCP and integrations](integrations.md) |
| Know what protects what | [Security](security.md) |
| Run it | [Operations and runbooks](operations.md), [FAQ](faq.md) |
