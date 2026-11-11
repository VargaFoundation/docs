---
id: plugins
title: Plugins
sidebar_position: 6
---

# Plugins

A plugin packages agents and what they need in one signed, reproducible format. Here "plugin" means this
package; a Python wheel loaded through the `choregos.plugins` entry point is an **extension**, a different
thing.

## Layout

```text
hello/
  plugin.yaml                  # the manifest
  agents/greeter.yaml          # an agent entry
  skills/greeting/SKILL.md     # a skill directory
  templates/hello-flow/        # a project template, with its files
  evals/greeter.yaml           # an eval suite for one of the plugin's agents
  assistants/helper.yaml       # an assistant (from 0.26)
  procedures/*.md              # procedures
  servers/hello.yaml           # an MCP server the platform runs
```

```yaml
apiVersion: choregos/v1
kind: Plugin
metadata:
  name: hello                 # [a-z0-9-], unique within a source
  version: 1.0.0              # semver; a published version is immutable
  publisher: Example Org
  license: Apache-2.0
  description: What it ships.
  core: ">=0.25.0"            # core versions it was validated against
requires:
  plugins: []
  connectors: {}
contents:
  agents: [agents/greeter.yaml]
  skills: [skills/greeting]
  templates: [templates/hello-flow]
  evals: [evals/greeter.yaml]
  procedures: ["procedures/*.md"]
  servers: [servers/hello.yaml]
  # assistants: [assistants/helper.yaml]      # from 0.26
```

A plugin is exactly what its manifest declares: anything else in the directory (a server's source, build
output) is not read, validated, digested or packed. Paths stay inside the plugin and may not pass through
symbolic links.

## Validate, pack, index

```bash
choregos plugin validate hello/
choregos plugin pack hello/ -o hello-1.0.0.tar.gz
choregos plugin index plugins/ -o index.yaml --oci-repository ghcr.io/acme/choregos-plugins
```

`validate` reports every problem with its file: manifest shape, agents (the full agent model is checked at
install), skills, templates, eval suites played on their agent's instructions, and, for assistants, the rules
listed in [Assistants](assistants.md#what-validation-refuses). The **content digest** (`sha256:...`) of a
canonical tar of the declared files identifies a plugin: the same files always give the same digest and
`pack` writes the same bytes every time. An index records, for each version, its digest, its `core` range
and where to fetch it (an OCI reference or a git repository pinned to a **commit**, never a branch or tag).

## Sources and trust

A deployment declares where plugins come from and how it trusts them. There is no unsigned source: each
source names a keyless cosign signer (identity and issuer, matched whole) or a public key.

```yaml
global:
  plugins:
    sources:
      - name: varga
        index: oci://ghcr.io/vargafoundation/choregos-agents/index:latest
        trust:
          identity: https://github\.com/VargaFoundation/choregos-agents/\.github/workflows/publish\.yml@refs/heads/main
          issuer: https://token\.actions\.githubusercontent\.com
    defaultPlugins:
      - { source: varga, name: software-delivery, version: "^1.0", preapproved: true }
    offline: /opt/choregos/plugins     # plugins baked into the image: air-gapped, demo, CI
```

By default the platform's own agents (`software-delivery`, `netops`, `authoring`, `mcp-clients`, `requests`,
from the `choregos-agents` repository) are installed in every organisation from the image's offline
directory, with no network needed at start-up. Fetches go through the API's egress guard.

## Installing into an organisation

An organisation administrator installs, upgrades and uninstalls; every member lists.

```text
GET    /api/v1/orgs/{org}/plugins
POST   /api/v1/orgs/{org}/plugins/install        {"source": "varga", "name": "hello", "version": "^1"}
POST   /api/v1/orgs/{org}/plugins/{name}/upgrade {"version": "1.1.0"}
DELETE /api/v1/orgs/{org}/plugins/{name}
```

In the console: *Library, Plugins*. Before anything is written each agent passes full validation, each skill
passes the skill gate, each eval suite is played, and a plugin required by another must be installed; any
refusal leaves the organisation unchanged. A plugin that brings a **server**, or a skill rated high risk, is
checked in full and then waits for a **second administrator** (`202 pending_approval`).

| Item | Where it goes |
| :-- | :-- |
| agents | the agent registry, version 1, common scope |
| skills | the skill library |
| templates | kept with their files, usable as a project's template |
| evals | played at every install and upgrade |
| servers | run in the plugins namespace, governed as an organisation connector |
| assistants (0.26) | available to install for an audience, see [Assistants](assistants.md) |

An agent or skill the organisation already has under that name wins. **Upgrading** publishes a new version
only when the text changed, and an item the organisation changed since is offered the update, never
overwritten. **Uninstalling** removes what nobody changed or pins; what an organisation changed stays as its
own.

## Plugin servers

A plugin may bring an MCP server that the platform runs in the cluster, per organisation, with a
NetworkPolicy allowing ingress from the API only. It is off by default:

```yaml
global:
  plugins:
    servers:
      enabled: true
      namespace: { name: choregos-plugins, create: false }
      registries: [ghcr.io/vargafoundation/choregos-agents]
      egress: networkpolicy        # or cilium for exact host names
```

A server must answer MCP, declare an `outputSchema` per operation (results are validated and capped), and may
ship a `fake` so the eval matrix can run without the real system. The chart renders only a namespaced Role.

## Other agent shapes

[Agents written in code](https://github.com/VargaFoundation/choregos/blob/main/docs/code-agents.md) use the
`choregos-agent-sdk`, a thin adapter that gives any framework the four things a step needs (ACP, governed
MCP tools, a counted model, a validated result). **Prompt, voice and hosted agents** have no code of ours:
a hosted agent is your own container serving the Foundry hosted-agent contract, run under the same budget
and gates.
