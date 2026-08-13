---
id: knowledge-base
title: Engineering knowledge base
sidebar_position: 4
---

# Engineering knowledge base

Point Ecphoria at a team's real material — documentation that changes, architecture decisions,
incidents, tickets — and query it from the editor you already use. The property that makes this
different from a vector store over the same files: **a document that changes keeps its history**,
section by section, so "what did this say in March" is a query rather than a git archaeology
session.

Reproducible measurements for everything claimed here are in the repository's
`docs/benchmarks-kb.md`.

## Instruction files vs. a knowledge base

Instruction files — `CLAUDE.md`, `AGENTS.md`, `.cursorrules` — do two jobs, and only one of them
they do well. Understanding the split is the difference between a working setup and a file nobody
reads.

|  | Instruction file — **pushed** | Ecphoria — **pulled** |
|---|---|---|
| How it reaches the agent | Injected into every session's context, always present | The agent queries it when a question needs it |
| Best for | *Instructions* — build commands, conventions, rules, "always do X" | *Knowledge* — why a decision was made, what broke last quarter, which ticket covered this |
| Cost of growth | Every token is paid on every request, forever | Nothing until asked |
| Staleness | Someone has to remember to edit it | Re-imported from git, tickets and incidents; contradictions supersede automatically |
| Sharing | Copied between repos, drifts | One server, many projects, tenant-scoped |

Ecphoria does **not** replace the instruction file. It replaces the half of it that grows and
rots: accumulated history, past decisions, project context — the part people stop reading because
it is three screens long and half of it is no longer true.

The pattern that works: keep the instruction file short and purely instructional, and add one
paragraph pointing the agent at the knowledge.

```markdown
## Memory

An Ecphoria server holds this project's documentation, ADRs, closed tickets and past incidents.
Search it (`search_memory`) before answering *why* something is built the way it is, and record
durable decisions with `add_memory` — give a `subject` so a later decision supersedes it rather
than duplicating it.
```

Same paragraph works in `AGENTS.md` for OpenCode, or any other agent's instruction file.

## Configure for this workload

Three settings matter more than the rest.

```toml
[embedding]
provider  = "ollama"             # ← the default is "none", which means BM25-only
model     = "nomic-embed-text"
dimension = 768

[memory.cognition]
retrieval_vector_weight = 0.5    # ← see below
graph_expansion         = false  # measured neutral on this workload
extraction              = "none" # LLM fact extraction measured net-negative here

[memory.promotion]
enabled = true                   # closed tickets and resolved incidents become searchable
```

**Turn embeddings on.** `embedding.provider` defaults to `none` and retrieval is then BM25-only —
which works, and works well on identifiers, but misses questions phrased in words the document does
not contain. On the reference evaluation BM25 alone reaches 90.3% recall@5; hybrid reaches **100%**.

**Then set `retrieval_vector_weight = 0.5`.** The default weights both retrieval arms equally. The
vector arm's precision falls as the corpus grows while the lexical arm's holds, so at scale the
vector arm injects noise with the same authority as the arm that is still right:

| corpus | `w = 1.0` (default) | **`w = 0.5`** |
|---|---|---|
| 500 sections | 100.0% | 98.6% |
| + 5 000 | 90.3% | **97.2%** |
| + 20 000 | 79.2% | **93.1%** |

It costs about one question on a small corpus and gains 14 points at 20 000. It is not the shipped
default because that default also governs conversational memory, which has not been measured with
this knob — so it is a deliberate per-deployment choice.

### Scoping {#scoping}

`MemoryScope` matches the **exact** `(tenant, user, agent, session)` tuple: a memory written with a
`user_id` is invisible to a tenant-scoped search, and vice versa. For a shared knowledge base, write
everything at one consistent scope — tenant-only is the natural choice — and reserve per-user scopes
for genuinely personal memory. This is the most common way to end up with a corpus that silently
returns nothing.

### Forgetting

Decay measures age from when a memory was last *touched*, not from when its content became true, so
a decision valid since January but re-confirmed by this morning's import is not stale. The
background job is off by default (`decay_interval_secs = 0`); documents removed from their source
are expired by the document sweep regardless.

## Load the corpus

### Documentation and ADRs, from git

```bash
ecphoria import --from git --path /path/to/repo
# Importing 51 Markdown files from /path/to/repo…
# Imported 51 files → 479 sections (479 new, 0 updated, 0 unchanged, 0 removed)
```

Every tracked Markdown file is split on its **heading hierarchy** and stored one memory per section,
addressed by `<project>/<path>#<heading trail>` — e.g.
`strata/docs/deployment.md#Kubernetes > Production Values`. Each file's last commit date becomes the
memory's valid-time, so the timeline reflects when the documentation changed rather than when you
ran the importer.

The project namespace defaults to the repository's directory name (`ECPHORIA_PROJECT` overrides it),
and it matters as soon as you import more than one repository: a document's path is its identity,
and identity drives both supersession and the removal sweep. Two repositories that each contain
`README.md` would otherwise be the same document.

Re-run after every merge, from CI or a post-merge hook, or live while you work:

```bash
ecphoria import --from git --path . --watch
```

Re-import is idempotent and cheap. Unchanged sections are confirmed with no write; editing one
paragraph reports `0 new, 1 updated, 478 unchanged` and supersedes exactly that section, with the
previous text still queryable; a section deleted from the file is expired, not orphaned.


> **Vendored trees are skipped.** Committed dependency directories (`node_modules`, `vendor`,
> `third_party`, `.venv`, `target`, `dist`) are tracked files, so `git ls-files` returns them and
> somebody else's `README.md` competes with your own — observed in practice, with Microsoft's
> `typescript/SECURITY.md` reaching rank 1 on a policy question. `ECPHORIA_IMPORT_ALL=1` disables
> the skip.

> **Deleted files are retracted.** After each run the importer reports the full set of documents it
> sent, and anything else in the project is expired. The per-document sweep only removes *sections*
> of a file it was given; a file that vanished is never mentioned again, and silence cannot be told
> from "not imported this run". Without this the corpus keeps answering from documentation that no
> longer exists. Only `mem_type = 'chunk'` in that project is touched, so hand-written facts and
> promoted tickets are never swept by a documentation import.

> Backfill runs oldest-first. Replaying history in reverse pushes every version to now instead of
> splitting intervals around it — out-of-order valid-time insertion is not supported.

### Tickets

Historical, once:

```bash
export GITHUB_TOKEN=ghp_…      # public repos work without it, at 60 requests/hour
ecphoria import --from github --path owner/repo
```

Closed issues and pull requests — merged *and* closed-unmerged, because "we decided not to do this"
is often the more useful memory — become memories keyed `owner/repo#issue-7`. Valid-time is the
close date, so the backfill reconstructs the real timeline.

Ongoing: point GitHub at `/api/v1/webhook/github`. With `memory.promotion.enabled`, the events that
mark a durable outcome are additionally written as memories using the **same subject scheme**, so a
backfilled ticket that later receives a webhook is confirmed or superseded rather than duplicated.

### Incidents

Point Sentry and PagerDuty at `/api/v1/webhook/sentry` and `/api/v1/webhook/pagerduty` (sign them —
see [Security](./security)). Every event lands in episodic memory for SQL analysis; resolutions are
promoted to searchable memories.

Which events promote is configurable with `memory.promotion.rules`, written `"<vendor>:<event_type>"`
with `*` allowed on either side (`github:pull_request.*`). The defaults are closes, merges and
resolutions — promoting *everything* would bury the documentation under CI noise, and the noise is
already in episodic if anyone needs it.

### What gets learned while working

The repository's `ops/daily/setup.sh` installs a Claude Code `SessionEnd` hook that journals each
session. See [Editor & agent integrations](./integrations#automatic-session-capture-optional).

### Anything else

`POST /api/v1/memories/batch` accepts up to 10 000 memories per request and is roughly 4.8× faster
than a loop over `/memories`. `POST /api/v1/documents` does the same for one Markdown document,
chunking and sweeping server-side.

## Query it

### From your editor

See [Editor & agent integrations](./integrations) — Claude Code, OpenCode, Claude Desktop.

### With SQL

The PostgreSQL wire protocol serves the whole store, so psql, Grafana or a notebook all work. The
password is your API key.

```sql
-- What did this runbook say about failover in March?
SELECT content FROM memories
WHERE subject = 'platform/docs/runbook.md#Runbook > Failover'
  AND valid_from <= '2026-03-15'
  AND (valid_to IS NULL OR valid_to > '2026-03-15');

-- Which documentation changed most often this quarter?
SELECT split_part(subject, '#', 1) AS doc, count(*) AS versions
FROM memories
WHERE mem_type = 'chunk' AND valid_from > '2026-04-01'
GROUP BY 1 ORDER BY 2 DESC LIMIT 10;

-- How much does each project contribute to the corpus?
SELECT split_part(subject, '/', 1) AS project, count(*) AS sections
FROM memories WHERE mem_type = 'chunk' AND state = 'active'
GROUP BY 1 ORDER BY 2 DESC;

-- Every version of a decision, with the period each was believed.
SELECT valid_from, valid_to, state, content FROM memories
WHERE subject LIKE 'platform/docs/adr/adr-002%' ORDER BY valid_from;
```

### Over REST

```bash
curl -sX POST localhost:8432/api/v1/memories/search -H "$AUTH" \
  -d '{"query":"why did we choose USearch over pgvector","k":5}'

curl -sG localhost:8432/api/v1/memories/history -H "$AUTH" \
  --data-urlencode 'subject=platform/docs/runbook.md#Runbook > Failover'
```

## Why sections rather than whole files

Stored whole, a document is one memory: one vector, one keyword document, one retrieval unit — so a
hit returns the *entire file*. Measured on the same corpus, chunking changes what a query costs you:

| | whole-file | chunked |
|---|---|---|
| recall@5 | 87.5% | **90.3%** |
| query p50 | 50 ms | **24 ms** |
| **context for top-5** | **44 384 chars** | **4 042 chars** |

The last row is the one that matters and the one recall cannot show. Answering a single question by
pasting the top five results into a prompt costs ~11 000 tokens unchunked and ~1 000 chunked. That
is the difference between a retrieval layer an agent can use in a loop and one it cannot.

Sections are addressed by heading trail rather than character offset, which is what survives edits
elsewhere in the file — and what lets re-import route through the ordinary contradiction path:

| the section is… | outcome |
|---|---|
| unchanged | confirmed — importance bumped, no new row |
| edited | superseded — previous text stays queryable |
| new | inserted |
| deleted from the file | expired by the document sweep |

## Several projects, one team

Import each repository and they share one corpus, so a question asked while working on project A
can be answered from project B's decisions. Each memory also carries a **project**, so a search can
narrow to one without splitting the store:

```bash
ecphoria import --from git --path ~/src/payments     # project = "payments"
ecphoria import --from git --path ~/src/platform     # project = "platform"

ecphoria memory search "refund window"                      # every project, ranked together
ecphoria memory search "refund window" --project payments   # just that one
```

Over REST and MCP it is a `project` field on `add_memory` and `search_memory`; omit it to search
everything.

### Why a filter and not a scope

The scope tuple (`tenant`, `user`, `agent`, `session`) is an **exact match**, so putting the project
there would isolate projects *and* make cross-project search impossible — which is the situation the
`memory_grants` mechanism exists to work around. Grants do it by running one search per scope and
concatenating the result lists, and concatenation is not fusion: results from different projects are
never ranked against each other, so the "best" answer is whichever project happened to come first.

Keeping one scope and filtering gives both properties at once. Unfiltered, a single RRF fusion ranks
the whole corpus; filtered, you get one project exactly.

The project is also part of a memory's identity, so `deploy.target` in two repositories are two
facts rather than a contradiction — and superseding one leaves the other alone.

### Teams

Give each team a tenant-scoped API key (`<secret>@<tenant>:<role>`). The tenant comes from the token
and overrides anything a client sends, so teams share a deployment without seeing each other's
memory. Verified end to end: two engineers on one tenant, each having imported only their own
repository, both retrieve the other's ADRs, while a second tenant on the same server retrieves
nothing.

The CLI reads `ECPHORIA_API_KEY` (or `ECPHORIA_TOKEN`).

## Telling "no answer" from "a weak answer"

Every hit carries `similarity` (vector cosine, comparable across queries) and `lexical` (BM25). The
fused `score` is **not** a relevance measure — it is rank-derived, so the top hit scores about the
same whether it answered the question or merely shared a word.

A `min_similarity` floor is available, opt-in, and deliberately has no default. Measured on the
reference corpus, questions the documentation answers score p50 0.70 and questions it has nothing on
score p50 0.60 — the distributions overlap, so any threshold trades real answers for filtered noise.
Shipping a default would state a confidence the data does not support.

The reliable path is the agent reading the results and saying when the corpus has nothing, which is
what it does well. See `docs/benchmarks-kb.md` in the repository for the full distributions.

## Known limits

- **Backfill must run oldest-first** (above).
- **Vector dedup does not see within a batch.** Two near-duplicate subject-less memories submitted
  in one `/memories/batch` call are both stored; contradiction resolution by subject is unaffected.
- **Cluster mode has no batched write path.** `/memories/batch` falls back to per-memory Raft
  replication — correct, but without the speedup. Target a single node for bulk imports.
- **Only Markdown is chunked.** PDFs and Office documents are stored as opaque attachments; their
  text is not extracted.
- **No Jira or Confluence connector.** GitHub, Sentry, PagerDuty and Slack have webhook normalizers;
  anything else needs `/api/v1/memories/batch` and a script.
