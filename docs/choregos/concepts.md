---
id: concepts
title: Concepts
sidebar_position: 5
---

# Concepts

A handful of ideas carry the whole platform. Everything else is plumbing.

## Organisation and project

An **organisation** is the tenant: its members, connectors, agents, plugins, policy ceiling and budgets, all
under fail-closed row-level security. A **project** is a unit of work inside it, with its own connectors,
workflow, policy and budgets. Its configuration names the repository, the model profiles and the labels. Its
**readiness** lists, from stored state, what it still lacks to run and who can fix each item.

Connectors ship for trackers (`github-issues`, `jira`, `gitlab-issues`, `internal`), source control, CI
(`tekton`), CD (`argocd`), execution (`agent_sandbox`, `k8s_job`, `aca`, `local_docker`), model gateways
(`litellm`, `direct`), memory (`ecphoria`, `lexical`) and notification (`slack`). Each has a `fake` twin
used by the test suite.

A **catalogue** is what the platform offers; a **connector** is what an organisation has installed. With
`tracker: internal` Choregos' own database holds the work items, which suits work that exists nowhere else:
an HR request, a file to process.

Since 0.26, every person also has an implicit **personal space**, a project of a special kind that only its
owner reads, where assistant conversations, tasks and a person's accounts live
([Assistants](assistants.md)). It never appears in a project list.

## Workflow, work item, artifact

A **workflow** is the state machine (see [Configuration](configuration.md#workflows)). A **work item** is one
ticket moving through it. Transitions declare who performs them (`by`), what they consume and produce
(`inputs`, `outputs`), which guarantees must hold (`gates`) and what happens when they fail (`on_fail`,
`max_attempts`, `escalate_to`).

An **artifact** is what a step leaves for the next one: a named output, with a type, a size, a sha256 digest
and the run that produced it. Digests are verified on every read.

## Actor

- **`agent`**: a role, a playbook, a model profile and budgets in turns and minutes.
- **`human`**: a group, an SLA in hours, a reminder and an escalation.
- **`system`**: a transition the platform performs itself, with no agent and no cost.

A **backend** is the coding agent CLI that the runner image ships (`claude-code`, `gemini-cli`, `opencode`,
and others). An **executor** is where that stage runs. Both are chosen by the deployment.

## Agents, scope and revisions

An agent is a registered, versioned object with an owner and a **scope**: common (installed from a plugin or
the built-in catalogue; changed only by an organisation administrator, or forked), organisation, project, or
personal (drafts; a personal agent never runs in a workflow). A **fork** copies one version of its source and
never follows it on its own.

A version is a **closed set**: the tools, extensions and web access it names, intersected with what the
project and the deployment allow. A project only tightens, never widens.

A version's **runtime** says how it runs:

| Runtime | Meaning |
| :-- | :-- |
| `acp` (default) | a coding agent the runner ships, chosen by `backend` |
| `code` | an ACP agent written in code, in an image you name |
| `prompt`, `voice`, `hosted` | instructions plus a model, a realtime voice, or your own container, as in Azure AI Foundry's Agent Service |
| `a2a` | a remote agent called over A2A |

A **revision** is a numbered immutable version. An agent has two **channels**, `production` and `testing`,
each a pointer to a revision; reaching production checks the eval suite again and takes a person with a
recent sign-in. Going back appends a copy, so nothing is rewritten.

## Stage and run

A transition performed by an agent becomes a **run**: one disposable sandbox, one workspace, one short-lived
token, one model key with a hard cap. The runner speaks ACP to the agent, records every message, applies the
guardrails (scope, forbidden commands, network, sensitive files), loops on the definition of done and
publishes a result. Runs are idempotent: a replayed run does not pay twice and does not act twice.

## Gate and evidence

A **gate** is a mechanism, not an instruction. Examples: `evidence_present` requires tests that were actually
executed (the runner runs them and overwrites declared evidence); `scope_respected` compares the diff to the
declared scope; `outputs_present`, `output_schema`, `ci_green`, `review_approved`, `scans_ok`, `no_secrets`,
`numbers_measured` (every number an agent writes must be found in a source document), `docs_updated`,
`provenance_signed` and others. **A gate that cannot see what it must check refuses**: a guarantee that
passes blindly is worse than none.

**Evidence** is what a step leaves behind: tests run and passed, lint, typing, coverage, diff size, and
`facts`, a flat map named by the business for work that has none of those.

## Tools

An agent's own tools are whatever its backend ships. The platform's tools reach it over MCP on localhost
(report a finding, ask a human, request a scope extension), plus a **catalogue** of reviewed third-party
APIs and MCP servers that the platform calls on the agent's behalf. The agent never holds a provider
credential, never chooses a URL and never sees the remote tool's real name. A tool that may write is neither
offered nor callable unless governed.

## Governed actions

Every write to a third-party system goes through a **governed action**: a proposed operation that waits for
a person's approval, re-authenticated, in the console, before a workflow runs it. Tracker comments and MCP
calls can never decide.

## Memory and knowledge

**Memory** is what agents learn from work: every project has a shared memory and one per agent, plus named
project memories and organisation-wide ones. An agent version binds up to eight, in order (earlier wins);
at most one is written, and writes to a global memory are only proposals an administrator accepts.

A **knowledge base** is a corpus that people curate and agents only read: documents uploaded or synced from
SharePoint, Confluence, a website or git, converted to markdown. Served as **files** it is laid read-only in
the workspace; served as an **index** it is searched and cited. Knowledge (written by people, for all) is
kept apart from memory (learnt from one person).

## Findings and release trains

An agent that spots a problem outside its scope does not fix it: it files a **finding**, which is
deduplicated, triaged and turned into a linked ticket. A **release train** batches what is ready, opens its
window, requires its approval, can be frozen with a reason, listens to Argo CD during its soak and rolls
back at once on a degraded signal. A ticket labelled `hotfix` takes the express lane.

## Plugins and assistants

A **plugin** packages agents, skills, templates, evals, procedures, MCP servers and, from 0.26, assistants
([Plugins](plugins.md)). An **assistant** is a plugin's agent offered to a group of people in conversation
([Assistants](assistants.md)).
