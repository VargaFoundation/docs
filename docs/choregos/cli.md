---
id: cli
title: CLI
sidebar_position: 8
---

# CLI

The `choregos` command talks to the API with a token. The profile lives in
`~/.config/choregos/config.json` (`CHOREGOS_CONFIG` overrides the path) with `api_url`, `token` and `org`;
`CHOREGOS_API_URL`, `CHOREGOS_TOKEN` and `CHOREGOS_ORG` are read when no profile exists. The first token is
issued from the console under *My account* (or server-side with `choregos-admin tokens create`).

```bash
choregos login --api-url https://choregos.example.com --token chg_... --org acme
choregos whoami
```

The full, generated reference of every option is in the
[repository](https://github.com/VargaFoundation/choregos/blob/main/docs/cli.md). The groups:

| Command group | What it does |
| :-- | :-- |
| `login`, `whoami` | save the profile; show who you are |
| `orgs` (`list`, `create`) | organisations |
| `projects` (`create`, `list`, `provision`, `readiness`) | projects; `provision` is idempotent and `--follow` streams it |
| `items` (`create`, `list`, `show`, `approve`, `reject`, `answer`, `action`) | work items and the decisions on them |
| `runs` (`list`, `tail`, `diff`) | agent runs: follow the journal, read the diff |
| `trains` (`status`, `approve`, `depart`, `freeze`, `unfreeze`) | release trains |
| `findings` (`list`, `action`) | findings agents filed |
| `workflow` (`list`, `show`, `push`, `validate`, `templates`) | workflows; `validate --remote` checks server-side |
| `knowledge` (`apply`, `sync`, `eval`) | knowledge bases as files |
| `plugin` (`validate`, `pack`, `index`) | package and check plugins |
| `tokens` (`create`, `list`, `revoke`) | API tokens, with scopes and an optional project binding |
| `machines` | machine accounts: an application's own identity, A2A only |
| `a2a` (`send`, `get`, `follow`, `cancel`, `skills`) | start and follow workflows over the A2A door |
| `admin secrets rewrap` | re-seal connector secrets after a key rotation |
| `dev` (`up`, `down`, `seed`, `demo`) | a local development cluster |

Examples:

```bash
choregos items create billing-api --title "Fix rounding in invoices" --size S
choregos items approve ITEM-42
choregos items action ITEM-42 rerun_stage --top-up 5
choregos runs tail RUN-ID
choregos tokens create --name ci --scope a2a --project acme:billing-api --expires-in-days 30
choregos plugin validate ./my-plugin
```

Assistants (from 0.26) are installed and used through the console and the REST routes documented in
[Assistants](assistants.md); `choregos plugin validate` is the CLI's part in them.
