---
id: assistants
title: Assistants
sidebar_position: 7
---

# Assistants

:::info Availability
Assistants ship **from Choregos 0.26**. Standing delegations (ADR 0137) are delivered, but their decision
record stays *proposed* until the deploying organisation's works council opinion and data protection impact
assessment: do not offer delegated tasks to people before then.
:::

An **assistant** is a conversational agent that a plugin ships, that an organisation installs for an
audience, and that people talk to, from the console, from claude.ai or another MCP client, or from a panel
embedded in an internal web application. It differs from a workflow's agent in what it adds around the agent:

- a **configuration** set at install;
- an **audience** (who may talk to it) and **owners** (who manage it);
- the **tools it needs**, and the **identity** each is called under (the service's, or the person's own);
- **memory spaces** it keeps per person, and per subject the person talks about;
- the **knowledge** it offers, seeded by the plugin and owned by the organisation;
- **tasks** it can run in the background for a person, with a bounded, read-only delegation;
- its **surfaces** (console, MCP, embed) and its **policy** (budgets, retention, data classification).

Choregos stays vocabulary-neutral: the core knows needs, operations, subjects as `{type, key}` and memory
spaces. It never knows what a colleague, a client or an instrument is. A test plugin about personal
investing, with no code of its own in the core, installs and converses in CI to keep it that way.

## The manifest

An assistant is a file of `kind: Assistant` listed under the plugin's `contents.assistants`. It wraps an
agent of the same plugin (runtime `prompt` or `hosted`), which keeps its own versions, channels and evals.
This is the manifest of the test plugin `investment-assistant` (names are generic):

```yaml
apiVersion: choregos/v1
kind: Assistant
metadata:
  name: investment-assistant
  display_name: Investment assistant
  description: Explains markets and your own positions, follows the instruments you watch.
  icon: chart
  i18n: { fr: { display_name: "Assistant investissement" } }
agent: investment-analyst
config_schema:
  type: object
  required: [house_name]
  properties:
    house_name: { type: string }
audience:
  suggested_groups: [grp-investors]
  personal_data: true
tools:
  - { need: news, operations: [search_news, get_article], access: read, identity: service, required: true }
  - need: market_data
    operations: [get_quote, get_history, lookup_instrument]
    access: read
    identity: service
    required: true
    subject_resolver: true
  - { need: bank_accounts, operations: [list_accounts, list_transactions], access: read,
      identity: user_consent, required: false }
  - { need: brokerage, operations: [list_positions], access: read, identity: user_consent, required: false }
  - { need: orders, operations: [place_order], access: write, identity: user_consent,
      approval: console, required: false }
memory:
  - name: investor_profile
    scope: user
    kind: profile
    writes: agent_proposes
    schema:
      type: object
      required: [risk_tolerance, horizon_years]
      properties:
        risk_tolerance: { enum: [low, medium, high] }
        horizon_years: { type: integer }
        exclusions: { type: array, items: { type: string } }
  - { name: preferred_sources, scope: user, kind: facts, writes: agent_proposes }
  - name: instrument_notes
    scope: user_subject
    subject: { type: instrument, key: isin, resolver: none }
    kind: facts
    writes: agent_proposes
    max_facts: 50
knowledge:
  - { name: investment_policy, seed: knowledge/investment-policy, serving_mode: index, upstream: propose_updates }
tasks:
  - name: morning_brief
    workflow: workflows/morning-brief.yaml
    triggers: [{ kind: schedule, cron: "30 7 * * 1-5", user_timezone: true }]
    delegation: read_only
    needs: [news, market_data, brokerage]
    deliver: [inbox, email]
  - name: threshold_alert
    workflow: workflows/threshold-alert.yaml
    triggers:
      - kind: poll
        cron: "*/15 9-17 * * 1-5"
        operation: market_data__get_quote
        when: { /change_pct: { abs_gte: 3 } }
        idempotency: /isin
    delegation: none
    deliver: [inbox]
surfaces:
  console: true
  mcp:
    prompts:
      - name: explain_move
        description: Explain why an instrument moved today.
        arguments: [{ name: instrument, required: true }]
        message: "Why did {instrument} move today?"
  embed:
    context_schema: { type: object, properties: { instrument: { type: string } } }
policy:
  budget: { per_user_month_usd: 20, per_conversation_usd: 2, per_installation_month_usd: 500 }
  conversation: { retention_days: 30, max_turns: 60, idle_close_minutes: 240 }
  data: { classification: sensitive, erasure: [by_user] }
evals: [evals/investment-assistant.yaml]
```

The plugin manifest lists it next to its agent:

```yaml
contents:
  agents: [agents/investment-analyst.yaml]
  assistants: [assistants/investment-assistant.yaml]
```

Task workflows, knowledge seeds and eval suites are files the assistant names; they ship with the plugin and
are packed and digested like a template's files.

### What validation refuses

`choregos plugin validate` rejects, naming the file and the JSON path:

- an `agent` that is not in the plugin, or whose runtime is not `prompt` or `hosted`;
- a `{{ config.x }}` in the agent's instructions that `config_schema` does not declare;
- a tool the agent calls that no need declares (an assistant's tools are a closed list);
- a write need without an approval, or with `approval: none`; an `inline` approval under the `service`
  identity;
- a `user_subject` memory without a subject, or without a resolver (unless the subject declares
  `resolver: none`);
- personal data (`audience.personal_data: true`) without a conversation retention and an erasure mode;
- a task that calls a write need, or that reads with the person's identity while running without them and
  has no `delegation: read_only`;
- a name that is not English `snake_case`.

## Installing and binding needs

Installing the plugin makes its assistants available. **Installing an assistant** makes one of them an
object of the organisation, for an audience. This is an organisation administrator's gesture, in the console
(*Manage installations*) or through the API; the manifest is never copied, it is read again from the
installed plugin, so a plugin upgrade is seen at once.

```text
POST  /api/v1/orgs/{org}/assistants
      {"plugin": "investment-assistant", "assistant": "investment-assistant", "slug": "invest",
       "config": {"house_name": "Example"},
       "owner_groups": ["investment-owners"], "audience_groups": ["grp-investors"]}
GET   /api/v1/orgs/{org}/assistants/{slug}/readiness
PUT   /api/v1/orgs/{org}/assistants/{slug}/bindings/{need}    {"connector": "news-feed"}
```

The agent never sees a connector's name: it calls `<need>__<operation>` (for example `market_data__get_quote`).
Changing the provider of a need changes neither the instructions nor the evals. Each **required** need must be
**bound** to a connector of the organisation that serves every operation of the need and supports its
identity mode. Until then, and until required configuration keys have values, the installation is
`incomplete`: the readiness list gives one item per gap and who may fix it, and no conversation opens. An
optional need may stay unbound or be switched off. Uninstalling the plugin suspends its installations and
deletes nothing that belongs to users.

Three permissions, granted by identity-provider groups rather than project roles:

| Permission | Held by |
| :-- | :-- |
| `assistant:manage` | the organisation administrator and the installation's owner groups: configure, bind, edit knowledge, set audience and budgets |
| `assistant:use` | the audience groups: converse, subscribe to tasks, manage one's own memory and accounts (an administrator outside the audience does not talk to the assistant) |
| `assistant:audit` | the owners, administrators, and privacy officers: read the reads journal, export and erase by subject |

The audience is **re-read from the person's groups at every turn**: leaving a group ends the next turn and
suspends the person's delegations, and deletes nothing.

## Conversations and the personal space

Each person has a **personal space**, created at their first conversation and readable only by them (a
row-level policy keyed on the user, on top of the organisation's). Conversations are **durable**: listed,
titled by the model, resumable, streamed as the gateway produces them, and cancellable (tool calls already
made stay in the journal).

- **A key per turn.** Each turn mints a model key reserved at the smallest of what is left of the
  conversation's cap, the person's month on this installation, the installation's month and the platform's
  usual caps. It is revoked at the end of the turn. A turn the cap refuses is refused before the model is
  called.
- **Idle and reopen.** After `idle_close_minutes` (240 by default) a conversation is idle; a new message
  reopens it with its history. A conversation keeps the agent revision it started with.
- **Bounded.** `max_turns` per conversation; past a token threshold the oldest turns are summarised.

## Identity modes

Each tool need declares who the call is made as. This matters because **the source decides what the person
may read**, not Choregos.

| Mode | How | Use when |
| :-- | :-- | :-- |
| `service` | the connector's own credential | public or shared data (news, market prices) |
| `user_exchange` | an RFC 8693 token exchange at each call: the person's token is exchanged for one whose audience is the connector's | the source trusts your identity provider |
| `user_consent` | OAuth authorization code with PKCE at the source's own authorization server, once per person; the refresh token is sealed in a connected account | the source has its own OAuth |

Rules that hold in every mode:

- **No fallback.** A call in a person's mode without a valid token fails with `identity_unavailable`; a
  `user_consent` need without an account fails with `account_not_connected` and a connect link, which the
  assistant passes on before going on without that source. Neither is ever retried under another identity.
- **The exchanged token serves one call**, server-side. It is never stored, logged, or handed to a run or to
  an agent's runtime.
- **The call says who it was for.** The tool-call event and the reads journal carry `as: person:<subject>` and
  the mode.
- A person owns their accounts: list, connect and revoke them (revocation at the source when it offers it,
  and the sealed secret deleted at once).
- A connector declares the modes it supports (`identity_modes`); a binding to a connector that does not
  support the need's mode is refused. Through an MCP gateway the exchange mode is refused.

The deployment's identity provider must allow the platform's client to exchange towards each source's
audience.

## Memory

An assistant declares its memory **spaces**:

| Scope | One per | Written by |
| :-- | :-- | :-- |
| `installation` | installation | its owners only |
| `user` | person and installation | per the space's rule |
| `user_subject` | person, installation and **subject** | per the space's rule |

A space is `facts` (rows with `proposed`, `active` or `rejected` status) or a `profile` (one JSON document
validated against the manifest's schema, versioned and shown as a form). The write rule is `agent` (active at
once), `agent_proposes` (proposed, confirmed by the person), `user_only`, or `owner_only`. `max_facts` and
`retention_days` bound a space.

A **subject** (the thing a person talks about) is opened by a *resolver*, not by a name the model typed: the
`user_subject` space opens only for a subject that a need marked `subject_resolver: true` returned **in that
conversation**, with the person's identity. Any other subject is refused (`subject_not_resolved`). A public
subject (an index, a listed instrument) declares `resolver: none`. The model is never the access control.

The agent is offered `memory_search`, `memory_get_profile` and `memory_propose`. At the start of a
conversation, the person's profile and the most relevant facts are injected within a declared token budget,
framed as data. A memory page per assistant lets the person see, correct, pin, delete and export it, with
pending proposals. A subject has no access to what is remembered about them by default; their rights go
through erasure and export by subject.

## Knowledge

A plugin ships a **seed**: a knowledge base directory with a markdown corpus. Installing the assistant
**copies** it into an organisation base, owned by the owner groups, each document marked `origin: seed@<plugin
version>`. A document the owners edit or add becomes `origin: local`. Sources (SharePoint, Confluence, git,
web) can be added with the usual screens.

The agent is offered `knowledge_search` and `knowledge_get` on the installation's bases **only**, whatever
the person's groups (giving the assistant to a person is the control), and must cite what it uses as
`[document, version]`.

On a plugin upgrade, each document is compared three ways (previous seed, new seed, local copy), following
the `upstream` setting:

| Document | `follow` | `propose_updates` | `frozen` |
| :-- | :-- | :-- | :-- |
| changed upstream, unchanged locally | updated | proposal | nothing |
| changed upstream and locally | proposal with its diff | proposal with its diff | proposal with its diff |
| new upstream | added | proposal | nothing |
| removed upstream | proposal to remove | proposal to remove | nothing if unchanged locally |

An upgrade never deletes a document. Owners accept, merge (keeping their own content) or refuse each
proposal; the installation stays usable meanwhile.

## Tasks and delegation

A **task** is a workflow of the plugin run in the *subscriber's* personal space: one work item per run,
delivered to the person's inbox and, as declared, by email, Teams or a signed webhook. Budget comes from the
subscriber's month, then the installation's. A person subscribes from the assistant's page.

| Trigger | Behaviour |
| :-- | :-- |
| `on_demand` | a button, or a `run_task` tool in the conversation; the session's identity, no delegation |
| `schedule` | a cron per subscriber, read in their time zone; one window runs once |
| `poll` | a light cron calls one read operation and starts the workflow only when a JSON-pointer condition holds, with an idempotency key per object |

**A delegation is an exception, and it is bounded.** A task that reads with the person's identity while they
are away needs a standing delegation:

- **Explicit**: given per task, after the person has seen the exact list of needs and operations read.
- **Read only**: only `access: read` needs; a write in a delegated task is refused.
- **Bounded in time**: 90 days by default, lowered by the installation's maximum. The person is reminded
  before it ends (7 days by default, `policy_overrides.delegation.remind_days`) and agrees again to renew it.
- **Revocable at once**: revocation cuts the derived tokens and revokes the offline token at the identity
  provider when it exposes a revocation endpoint.
- **Suspended automatically** when the person leaves the audience, is disabled, or the manifest changes the
  list of needs the task reads: a new agreement is needed.
- **Journaled**: every delegated read is logged with its delegation id, never the content.

A task with `delegation: none` reads only `service` needs, so a public-data poll needs no delegation.

:::caution Before enabling delegations
A delegation stores a credential that can act as a person with nobody present. The platform side was
security-reviewed before 0.26; on your side, check the identity provider's offline-session bounds and
revocation, that the exchange client is the only client the offline token is bound to, the sealed-store key
ring and rotation, and the maximum duration, and obtain the works council's opinion and the data protection
impact assessment, before offering delegated tasks in a production organisation.
:::

## Surfaces

**One brain, several surfaces.** The console, the MCP door and the embedded component open and continue the
same conversations through the same service.

### Console

*Assistants* lists those you may use; *Converse* opens a conversation in your personal space. Answers
stream as markdown, citations appear under them, a thumb up or down takes an optional comment. A write the
assistant proposes appears as a card to confirm or refuse (nothing is written before); what it proposes to
remember appears as a card too. A source needing your account carries a *Connect* link. A page per assistant
holds memory, connected accounts, tasks, inbox and sources.

### MCP door, from claude.ai

On `/mcp`, `list_assistants`, `ask_assistant` and `get_conversation` are announced only to people in the
audience of at least one ready assistant. Each installation is also its own connector at
`/mcp/assistants/<org>:<installation>`, with tools `ask` and `get_conversation` and the manifest's MCP prompts
(for example `explain_move`). Outside the audience that path answers `404`.

To use it from claude.ai: an administrator enables OAuth on the door (see
[MCP and integrations](integrations.md#claudeai-claude-mobile-chatgpt)), then in *Settings, Connectors, Add
custom connector* you enter the assistant's URL and your administrator's client ID. Sign in with your usual
identity provider, then ask. `mcp:read` is enough to converse: a conversation reads, its writes are
**proposals**.

An answer is `{conversation_id, status, text, citations, pending_actions, missing_accounts}`. A turn longer
than 25 seconds answers `status: working`; the client calls `get_conversation` again until `completed`. A
write comes back as a `confirm_url` to the console, where you confirm with your identity: the door never
decides. Choregos exposes its assistants, not other servers' tools. Expect two models in cascade (the
client's, then the assistant's): more cost and latency than a client-side skill, in exchange for budget,
audit, versions and evals; MCP prompts reduce the round trips.

### Embedding in your application

A host application shows an assistant in an iframe. It holds no token, no model and no transcript: the person
signs in to Choregos and the conversation is theirs.

```html
<iframe title="Assistant" width="480" height="520"
  src="https://choregos.example.com/embed/assistants/ORG/INSTALLATION?context=BASE64URL_JSON"></iframe>
```

- **`context`** is an optional JSON object, base64url-encoded, validated against the manifest's
  `surfaces.embed.context_schema` and given to the agent as **data**, never as an instruction or a resolved
  subject.
- **Who may frame it**: owners set `config.embed_origins` (origins only, no path, no `*`; `http` only for
  `localhost`). The console answers with `Content-Security-Policy: frame-ancestors` set to them; every other
  console page refuses framing.
- **Sign-in** is silent when possible (OIDC `prompt=none`), else a button in the frame opens a popup. The
  popup hands the frame a short-lived token (15 minutes) bound to the person, their browser session and this
  installation; the frame sends it on each call, so the host may be on **another site** than the console
  (third-party cookies are not needed). The token opens the embedded component's routes only.
- **Events** are posted to the host with `postMessage` (`conversation.started`, `action.confirmed`,
  `memory.updated`, `resize`); check `event.origin` and `event.data.source === "choregos.assistant"`.

### Writes: confirm, never auto

A write need with `approval: inline` becomes a pending action when the agent calls it: nothing executes. The
conversation's owner, and only they, confirms in the console or the frame (the broker then calls the source
with their identity; the source remains the judge of the right to write) or refuses. A proposal nobody decides
in 24 hours expires. Owners may raise an operation to `console` approval and never lower it below the
manifest's floor.

## Evals

A **conversation suite** is a new kind of eval file. A case is a scenario of user turns, tool results
simulated by the sources' fakes, **exact assertions** on the journal, and a rubric.

```yaml
kind: conversation
agent: investment-analyst
threshold: 1
cases:
  - name: quote-is-read-first-and-cited
    context: { relation: self }
    turns: ["What is the price of ACME today?"]
    tool_results:
      market_data__get_quote: { isin: FR0000000001, price: 12.34, as_of: "2026-11-10" }
    assert:
      must_call: [{ tool: market_data__get_quote, before: any }]
      must_not_call: [orders__place_order]
      must_cite:
        - figure: '\d+(?:\.\d+)? ?EUR'
          source: '\(source: [a-z_ ]+, \d{4}-\d{2}-\d{2}\)'
      must_not_contain: ["you should buy", { regex: "(?i)guaranteed return" }]
      length: { min_words: 3, max_words: 120 }
    rubric:
      - { criterion: explains the figure without recommending a purchase, threshold: 0.8 }
```

Assertions (`must_call`, `must_not_call`, `must_cite`, `must_not_contain`, `call_order`, `length`) run first
and are exact: a rule such as "never read X before Y" is a fact of the journal, not an opinion. The suite
**counts in promotion**: the agent version an assistant wraps does not reach `production` on the channel an
installation follows below the suite's threshold. A judge model then scores the `rubric`, one score per
criterion against its threshold (`conversation_judge_model`, else the `strong` model profile); a malformed or
refused judgement fails the case. With no model gateway, promotion is refused rather than silently allowed
(`conversation_suites_require_model=false` opts out).

**Feedback.** A thumb up or down on each answer, with an optional comment. A thumb down proposes a
pseudonymised **candidate case** to the agent's managers; it never enters a suite automatically, because
personal data must not enter a test corpus without a person deciding.

## Budgets and retention

Three caps bound each turn's key, from the manifest's `policy.budget` overridden key by key by the
installation: `per_conversation_usd`, `per_user_month_usd` and `per_installation_month_usd`. Deleting a
conversation does not give its spend back. `retention_days` is applied by a daily purge.

## Data protection

Personal data is governed by code, not by a runbook.

| Mechanism | What it does |
| :-- | :-- |
| Declared classification | `audience.personal_data: true` requires a conversation retention and an erasure mode, or the plugin does not validate |
| Retention | a daily purge deletes conversations past their retention, with their events, task artifacts and expired memory facts; the cost ledger lines stay |
| Reads journal | each tool call writes who, which installation, need and operation, the resolved subject, the delegation if any, and when; **never the content read** |
| Erasure by user | removes a person's conversations, memories, connected accounts, delegations and artifacts in one installation, audited |
| Export and erasure by subject | for `assistant:audit` and only when the manifest lists `by_subject`: export every person's memory of a subject and the conversations where it was resolved, or erase it and redact those conversations; journaled, the key as a digest |
| Row-level security | personal-space and memory rows are readable by their owner alone, enforced in the database |

Choregos does not decide whether a use is high-risk under the AI Act and replaces neither a data protection
impact assessment nor a works council consultation. It gives them evidence: the journal, the retention, the
agent versions and the evals. What a source lets a person read is still decided by the source, never by the
installation.

## Design decisions

The records behind this page are ADRs 0133 to 0140 in the
[repository](https://github.com/VargaFoundation/choregos/tree/main/docs/adr): the assistant as plugin
content, personal spaces and durable conversations, the person's identity on a tool call, memory spaces,
the standing read-only delegation, offered knowledge, the MCP door and embedded component, and conversation
evals.
