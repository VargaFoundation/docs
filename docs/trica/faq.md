---
id: faq
title: FAQ
sidebar_position: 12
---

# FAQ

## How do I get trica?

At the time of writing, the source repository (`VargaFoundation/trica`) and its container images,
chart and binaries on GitHub are not public; access is granted by the Varga Foundation. Once you
have the source, everything builds from it alone: `docker build .` for the image, the chart in
`charts/trica`, `make package-agent` for the agent packages
([Installation](./installation-deployment.md)).

## Is it a NetBox replacement?

It overlaps (racks, devices, interfaces, IPs, VLANs, cables) and reuses NetBox's device-type
library format, but the model is different: trica is discovery-first and keeps every value with
its source and history, where NetBox is a declared source of truth. Declarations are first-class
in trica too, and a disagreement between what was declared and what is observed is a
discrepancy, not an overwrite.

## Does trica ever change a device?

No. Collectors only read (and refuse in code to send anything else); use read-only accounts as a
second lock. Trica changes only its own database.

## Can an AI assistant break my inventory?

Not by itself. MCP is read-only except `propose_change`, which queues a proposal with a preview;
someone with `approve` decides. Sources in `policy.propose` never write directly.

## Which PostgreSQL?

PostgreSQL 17, with `pg_trgm` and `btree_gist`, reached directly or through a pooler in session
mode. Any distribution, operator or managed service works.

## Does it need Kubernetes?

No. Docker Compose and a plain binary are supported; the chart is one option. The Kubernetes
collector and the agent DaemonSet are optional.

## Several sites with overlapping private addresses?

Give each collector target (and agent) a `domain`: the same address in two domains is two
objects. Set it before the first run.

## Where are passwords stored?

Nowhere in trica's configuration or database. Targets reference files or environment variables;
the database holds only token hashes; attributes with secret-looking names are refused.

## Can I add my own attributes or types?

Yes, with YAML schema overlays loaded at start; the API, the query language and the UI forms
follow ([Configuration](./configuration.md#schema-overlays)).

## How do I import an existing inventory?

Export it to the trica document format (JSON or YAML: objects with identity and attributes,
relations) and run `trica import FILE --dry-run`, then without `--dry-run`. Imports are declared
and never override what collectors see ([Operations](./operations.md#export-and-import)).

## What is the licence?

Apache-2.0.
