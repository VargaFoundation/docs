---
id: device-types
title: Device Types
sidebar_position: 7
---

# Device Types

Trica ships a library of equipment models (rack height, depth, weight, airflow, number of power
supplies, port templates) in the file format of the community
[devicetype-library](https://github.com/netbox-community/devicetype-library), so existing model
files can be reused as they are.

## What a device gets

The server matches the library against the inventory at start, after the migrations, then every
`deduce.interval`. For every device whose `vendor` and `model` (or `part_number`) match a model,
it submits a **declared** batch from the source `library:devicetypes`:

- a `device_type` object (identified by its `slug`) with `vendor`, `model`, `part_number`,
  `u_height`, `full_depth`, `airflow`, `weight_kg`, `psu_count` and the port templates;
- an `instance_of` relation from the device to it.

A device's rack height is therefore its model's `u_height`; rack elevations and the placement
forms use it. Because the batch is declared, it never overrides a value a collector observed;
a disagreement shows up as a discrepancy. When a device's model changes, the old relation is
closed (history keeps it) and a new one opened. A failed pass is logged and retried at the next
tick.

## Matching rules

| Rule | Example |
|---|---|
| Case and punctuation are ignored | `dcs 7050tx 48` = `DCS-7050TX-48`; the slug is accepted as a name |
| Vendor spellings are aliased | `Arista Networks`, `HP`, `Hewlett Packard Enterprise`, `Dell Inc.`, `Dell EMC`, `Routerboard` |
| A vendor repeated in the model is dropped | `Dell PowerEdge R640` |
| Then the part number | `P19766-B21` |
| Airflow variants | A model with front-to-back and back-to-front variants matches only if they agree on everything but airflow; airflow and part number are then left out |
| Ambiguous name, or no vendor | No match |

## Adding models

Model files live under `internal/devicetypes/library/VENDOR/MODEL.yaml` in the source tree
(upstream files as they are; models written for trica go in `library/trica/`). Required fields:
`manufacturer`, `model`, `slug` (lowercase, digits, `.`, `-`) and `u_height` > 0. `weight_unit` is
one of `kg`, `g`, `lb`, `oz`; `airflow` one of `front-to-rear`, `rear-to-front`, `left-to-right`,
`right-to-left`, `side-to-rear`, `passive`, `mixed`. The test suite loads and validates every file,
so an invalid one fails the build. Rebuild the image to ship them.

For equipment no collector sees (PDUs, patch panels, shelves), place the device from a rack page
in the UI and give its height there; it is stored on the device when no model is known.

## Not covered

Images and module bays of the upstream format are ignored, and the UI does not let you pick a
model by hand.
