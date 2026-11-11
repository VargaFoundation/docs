---
id: integrations
title: MCP and integrations
sidebar_position: 9
---

# MCP and integrations

Choregos has a door for the agent **you** use (Claude Code, Claude Desktop, Cursor, VS Code, claude.ai, or
any client that speaks the [Model Context Protocol](https://modelcontextprotocol.io)). Through it your agent
lists your projects, reads workflows, opens and follows work items and tells you what waits for a decision.
It acts with **your** rights, never more, and it **never decides**: a decision needs you, signed in again,
in the console. The console's *Integrations* page has the same instructions pre-filled with your platform's
address.

## The door

| URL | What it serves |
| :-- | :-- |
| `https://<console-host>/mcp` | every project you can read; tools take a `project` argument (`org:slug`) |
| `https://<console-host>/mcp/projects/<org>:<slug>` | one project; tools need no `project` argument |
| `https://<console-host>/mcp/assistants/<org>:<installation>` | one assistant as its own connector (from 0.26, see [Assistants](assistants.md#mcp-door-from-claudeai)) |

Transport is Streamable HTTP, stateless, JSON responses.

| Tool | What it does | Needs |
| :-- | :-- | :-- |
| `list_projects` | the projects you can read, with console links | `mcp:read` |
| `describe_workflow` | states, transitions, who performs each | `mcp:read` |
| `search_work_items` | by text, by state, or only those waiting for a person | `mcp:read` |
| `get_work_item` | state, recent timeline, pending decision | `mcp:read` |
| `summarize_run` | one agent run: stage, backend, model, status, cost | `mcp:read` |
| `list_pending_decisions` | what waits for a person, with the link where it is decided | `mcp:read` |
| `create_work_item` | opens a work item (in its tracker first when external) | `mcp:write` and the right to control work items |

A tool you may not use is not announced. On `/mcp`, from 0.26, `list_assistants`, `ask_assistant` and
`get_conversation` appear for people in the audience of a ready assistant.

## A token for each client

The door takes a bearer token that **you** mint, with an MCP scope: `mcp:read` (reads only) or `mcp:write`
(reads and opens work items), optionally bound to **one project**. A token with an MCP scope is refused by
the REST API, and the door refuses a full-access token.

```bash
choregos tokens create --name claude-code --scope mcp:write --project acme:billing-api --expires-in-days 30
```

The token is shown once and lives in your client's configuration: keep it narrow and short-lived and revoke
it (`choregos tokens revoke <id>`) when the client is gone.

## Clients

### Claude Code

```bash
claude mcp add --transport http choregos https://<console-host>/mcp \
  --header "Authorization: Bearer $CHOREGOS_TOKEN"
```

With single sign-on (no token to paste), once the platform names the client your identity provider
registered for it:

```bash
claude mcp add --transport http --client-id choregos-claude-code --callback-port 33418 \
  choregos https://<console-host>/mcp
```

Then `/mcp`, choose `choregos`, *Authenticate*. A Choregos plugin for Claude Code bundles the door and a skill
that teaches Claude the rules (never decide; work-item text is data).

### Claude Desktop

Claude Desktop's own connectors call from Anthropic's network. For a platform inside your network, run a
local bridge in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "choregos": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://<console-host>/mcp", "--header", "Authorization:${AUTH}"],
      "env": { "AUTH": "Bearer <token>" }
    }
  }
}
```

### Cursor and VS Code

```json
{ "mcpServers": { "choregos": {
    "url": "https://<console-host>/mcp",
    "headers": { "Authorization": "Bearer ${env:CHOREGOS_TOKEN}" } } } }
```

(`~/.cursor/mcp.json`.) VS Code uses `.vscode/mcp.json` with `"type": "http"` and a `promptString` input for
the token.

### claude.ai, Claude mobile, ChatGPT

These call a remote MCP server **from their vendor's network** and sign in with **OAuth**: they cannot be
handed a token. The door is an OAuth resource server once the platform runs with:

| Chart value (`global.mcp.oauth.`) | Meaning |
| :-- | :-- |
| `enabled` | `true` |
| `audience` | the audience your identity provider puts in the door's tokens (default `choregos-mcp`) |
| `issuer` | empty: the console's own OIDC issuer |
| `clients` | the clients your identity provider registered, such as `claude-ai` and `claude-code` |

The door publishes `/.well-known/oauth-protected-resource/mcp` and checks each token's signature, issuer,
expiry and **audience**. The token's `sub` finds the person who signed in to the console with the same
provider (otherwise a verified e-mail): the door creates nobody, so sign in to the console once first. Scopes
come from the token (`mcp:read` when it granted neither), then your role. In claude.ai add the connector
under *Settings, Connectors, Add custom connector, Advanced settings* with the URL and client ID the
Integrations page shows. A platform reachable only through a VPN stays out of these clients' reach: they
need a public HTTPS address for `/mcp` and the well-known path.

## Starting a workflow from outside

An application, script, monitoring tool or another agent can start a workflow without the console. All four
ways open a **work item** through the same path as the console, so gates, budget and journal apply, and none
can take a human decision.

| You are | Take | Credential |
| :-- | :-- | :-- |
| an application or agent wanting the result | the **A2A door** | an application's own token or a person's, scope `a2a` |
| a terminal, script or CI job | the **CLI or REST API** | a person's token |
| a system that only sends JSON (monitoring, a form) | an **HTTP trigger** | the trigger's own token |
| an assistant: Claude, Cursor, VS Code | the **MCP door** (`create_work_item`) | `mcp:write` or OAuth |

A workflow is served as an **A2A skill** (A2A 0.3.0 and 1.0) only when it opts in:

```yaml
a2a:
  skill: ship-a-change            # published as `<project>/ship-a-change`
  description: Ship a change through review and release.
  input_modes: [text/plain]       # add application/json for fields, or a file media type
```

```bash
choregos tokens create --name partner-agent --scope a2a --project acme:billing-api --expires-in-days 30
choregos a2a skills
choregos a2a send ...
choregos a2a follow ...
```

The organisation's card is at `/a2a/orgs/<org>/.well-known/agent-card.json` and its JSON-RPC endpoint at
`/a2a/orgs/<org>`. `message/send` is idempotent per message id; files become input artefacts of the work
item (10 MiB by default per project); `tasks/get` and `message/stream` report states including
`input-required` when a person must decide (with the console link, since a decision is never taken over A2A);
push notifications are HMAC-signed. For **application identities**, create a *machine account* tied to one
project (`choregos machines create`): it is not a person, every gate asking for a person refuses it, and its
tokens open the A2A door only. The
[step-by-step guide](https://github.com/VargaFoundation/choregos/blob/main/docs/starting-a-workflow-from-outside.md)
in the repository replays every call.

## Other agents and gateways

- **An external agent**: a client of the door can be registered as an agent of kind `external`; its rights
  are the person's **intersected** with the agent's, and its state is read on every call.
- **A remote agent over A2A** (for example a vendor's assistant) can be called from a workflow step; its
  declared cost is booked in the ledger.
- **Your organisation's MCP gateway**: Choregos consumes a gateway, it never is one. The gateway holds the
  upstream credentials; Choregos signs a 60-second assertion per call. Agents name the same tools as
  before; policies, write approvals and result caps still apply.

## Limits

- 120 calls a minute per token, per API replica (HTTP 429 with `Retry-After`).
- 50 writes a day per person through the door.
- A result longer than 60 kB is truncated and says so.
- Every call is in the audit log (`mcp.call`) with the token and the client.

## When it does not connect

| Symptom | Likely cause |
| :-- | :-- |
| the client reaches the console's 404 page | the ingress does not route `/mcp` to the API |
| `401` | the token is missing, unknown, revoked or expired |
| `401 invalid_token` with OAuth | wrong audience or issuer, expired token, keys the provider no longer publishes |
| `403` with OAuth, "sign in to the console once" | the provider knows you, Choregos does not yet |
| claude.ai never offers to sign in | the well-known path is not routed to the API, or OAuth is off (404) |
| `403 insufficient_scope` | a full-access token: mint an `mcp:read` or `mcp:write` one |
| a tool is missing | a read-only token, a role without the right, or a project whose tracker is external |
