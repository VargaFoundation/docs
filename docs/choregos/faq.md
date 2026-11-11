---
id: faq
title: FAQ
sidebar_position: 12
---

# FAQ

## What is Choregos, in one sentence?

A platform where agents and humans move workflows forward under measured guarantees: gates, sandboxes, budgets
and human approvals are mechanisms, not prompts.

## Is it only for software?

No. The engine is a generic workflow state machine. Software delivery is one family of templates; others run
HR joiners and leavers, data changes and operations. A project may have no repository at all
(`tracker: internal`).

## Which agents and models can it run?

Coding agents behind ACP (Claude Code, Codex, Gemini CLI, Goose, OpenCode and others), agents written in code,
prompt, voice and hosted agents, and remote agents over A2A. Models go through a gateway (LiteLLM by default,
any OpenAI-compatible endpoint, or direct); a project has a budget, not a provider key.

## Can I try it without a model key?

Yes. Without a key, agents are simulated: the whole path (workflow, database, gates, human decision) is real
and costs nothing. See [Getting started](getting-started.md).

## Can an agent approve its own work, or push to production?

No. A decision needs a person signed in again in the console; tracker comments, MCP and A2A cannot decide.
Production is reachable only through a release train. See [Security](security.md).

## What happens when the budget runs out?

The run ends with reason `budget`, is never retried automatically, and the work item goes to a person, who may
top it up (the audit log records who).

## What is the difference between a plugin and an extension?

A plugin is a signed package of agents, skills, templates, evals, procedures, servers and assistants.
An extension is a Python wheel loaded through an entry point. See [Plugins](plugins.md).

## What is an assistant, and how is it different from a workflow agent?

An assistant is conversational and personal: people talk to it, it can read their sources with their own
identity, it keeps memory per person, and it offers knowledge and background tasks. A workflow agent works on a
work item for a team. Assistants ship from 0.26. See [Assistants](assistants.md).

## Can an assistant act on my behalf without asking?

It can **read** in the background under a standing delegation you agreed to, listing the exact sources, for a
limited time, revocable at once. It **never writes** without your confirmation in the console or the embedded
frame.

## Which assistant data is personal, and how is it erased?

Conversations, memories, connected accounts and task results of a person. Retention is enforced by a daily
purge; a person can erase everything an installation holds about them; an auditor can export or erase by
subject. See [Data protection](assistants.md#data-protection).

## Can I use an assistant from claude.ai?

Yes, from 0.26, if your platform is reachable at a public HTTPS address and OAuth is enabled on the MCP door.
Add the assistant's URL as a custom connector.

## Does the platform make us compliant?

No. It gives evidence (journals, retention, versions, evals) for your own assessments. It does not decide
whether a use is high-risk and replaces neither a data protection impact assessment nor consultation of staff
representatives.

## Where do I find the design decisions?

The architecture decision records are in the repository:
[docs/adr](https://github.com/VargaFoundation/choregos/tree/main/docs/adr).

## How do I report a problem?

Open an issue on [GitHub](https://github.com/VargaFoundation/choregos/issues); for a vulnerability follow the
[security policy](https://github.com/VargaFoundation/choregos/blob/main/SECURITY.md).
