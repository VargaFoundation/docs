---
id: getting-started
title: Getting started
sidebar_position: 2
---

# Getting started

This page answers one question: **I have work to run, how do I get the platform to do it?** Start on your
own machine (Docker only), then onboard a real project.

## Run it on your machine

```bash
git clone https://github.com/VargaFoundation/choregos.git
cd choregos
cp .env.example .env      # optional: every line has a default
docker compose up
```

When the console is ready, open `http://localhost:3000`. Development sign-in is pre-filled with the demo
administrator: click *enter* and you land on the **demo project**, with one work item waiting for your
approval. Approve it or send it back from its page.

What runs: PostgreSQL (the platform connects through a non-superuser role, so row-level security applies),
Temporal, the migrations, the API, the workers, the console, LiteLLM and a one-shot seed. Everything listens
on `127.0.0.1`. Measured on one workstation with images already built, the stack was healthy in a few
minutes and used about 1.9 GB of memory at rest.

### Fakes mode, and a real model

With no model key in `.env`, agents are **simulated**: each agent stage returns the outputs its transition
declares, says so in its summary, and costs nothing. Everything else is the real path (Temporal, the
database, the gates, the human decision). To run real agents, put a key in `.env` and start again:

```bash
# .env
ANTHROPIC_API_KEY=...     # or OPENAI_API_KEY=...
```

LiteLLM then routes the platform's model aliases to that provider; it is the only container that sees the
key, and each run gets its own virtual key, capped by the run's budget.

:::warning
With a key, the workers start agent containers through the Docker socket mounted into the `worker`
container. Whoever controls that socket controls Docker on the machine, which amounts to root on it. That is
acceptable on a laptop; never expose this install beyond one. Development sign-in has no password and the
API refuses it outside the `dev` and `test` environments.
:::

### Options

```bash
docker compose --profile memory up        # adds Ecphoria, the memory service
docker compose --profile temporal-ui up   # adds the Temporal UI on http://localhost:8233
docker compose down -v                    # stops everything and deletes the data
```

Ports taken? Set `CHOREGOS_PORT_WEB`, `CHOREGOS_PORT_API` or `CHOREGOS_PORT_TEMPORAL_UI` in `.env`.
PostgreSQL runs without `fsync` here: keep nothing in this install that you cannot recreate.

## Onboard a real project

You need an installed platform with its first organisation (see [Installation](installation-deployment.md)),
an **API token** (`choregos tokens create`, or *My account, Access tokens* in the console), and, depending on
the work:

| Need | When |
| :-- | :-- |
| An application repository (GitHub, GitLab) | the work is code; a business project has none |
| A GitOps repository | for a templated stack: provisioning writes the manifests, Argo CD applies them |
| A board (GitHub Projects v2, Jira) | or nothing: with `tracker: internal` requests live in Choregos |
| A GitHub App installed on the organisation | for GitHub: scoped installation tokens and webhooks, never a broad personal token |
| A cluster or an Azure subscription | where agents run (an `agent-sandbox` pool by default) |

Models go through the platform's gateway: a project has no provider key of its own, it has a **budget**.

### Pick a template, or none

| Template | When |
| :-- | :-- |
| `github-tekton-argo-k8s` | you have a cluster and run the agents there |
| `github-aca` | you are on Azure and want agents as Container Apps jobs |
| `github-software-delivery` | a software team on GitHub Actions, run by catalogue agents |
| `software-delivery-governed` | changes that must pass everything: decision record, QA, security review, supply-chain scan, human compliance review, release captain |
| `joiners-leavers` | HR, no repository: two workflows, every write into a directory or device manager is a governed action |
| none | a project whose connectors you attach yourself |

### Create the project

```bash
choregos login --api-url https://choregos.example.com --token chg_... --org acme
choregos projects create billing-api \
  --repo https://github.com/acme/billing-api \
  --language python \
  --template github-tekton-argo-k8s
choregos projects provision billing-api --follow     # idempotent: rerun to resume
choregos projects readiness billing-api              # what is left, and who can fix it
```

Provisioning checks the GitHub App, creates labels and a board, writes the GitOps manifests, registers
webhooks, creates the project's memory tenant with an initial import, sets a team and a budget at the
gateway, and opens a **scaffolding pull request** on your repository (`AGENTS.md`, `.choregos/workflow.yaml`,
`.choregos/policy.yaml`, CI and deploy files, `CODEOWNERS`). Review it before merging: it carries the test
and lint commands of your project and the gates of your workflow.

A project without code takes its requests from Choregos itself:

```bash
choregos projects create staffing --name "Staffing"
choregos items create staffing --title "Data PM for a 6-month mission" --size M
```

Validate a workflow before committing it:

```bash
choregos workflow validate my-workflow.yaml     # add --remote to validate server-side
```

Then label a ticket `agent-ready` (or create a work item) and follow it in the console.
