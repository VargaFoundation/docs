---
id: collectors
title: Collectors
sidebar_position: 6
---

# Collectors

Collectors read equipment and submit batches to the reconciliation engine. They **never write
to a device** and never write the inventory directly. Each one also refuses, in its own code, to
send anything but reads (`show` commands, `GET` requests, `print` commands, `get`/`list`/`watch`),
and the tests prove it against fakes. The accounts below are a second lock: give each collector
the smallest privilege the device offers.

:::tip Start with one canary
Point one target at one device you can watch, run it once, compare what trica shows with the
device's own interface, then add the fleet. Embedded management controllers are small servers.
:::

## Two ways to run them

| Mode | How | When |
|---|---|---|
| **In the server** | `collect.targets_file` in the server configuration (chart: `collect.enabled`) | The server's network reaches the devices. One replica collects at a time (advisory lock); the others take over if it stops. |
| **Remote** | `trica collector --config FILE` next to the devices | A management network the server cannot reach. Batches go over mutual TLS; one certificate per target; batches spooled on disk while the server is away. |

The targets file format is in [Configuration](./configuration.md#collector-targets-file).
Passwords and API keys are always `file:` or `env:` references.

Every run ends in one health record (`GET /api/v1/health/collection`, the **Health** page): a
failing target never stops the others, a run still going is never started twice, and the first
run of each target is delayed by a random fraction of its interval so a restart does not hit
every device at once. A run that could not read everything is **partial**: it adds and refreshes,
but withdraws nothing.

## Accounts per collector

| Collector | Protocol | Account to create |
|---|---|---|
| `arista` | eAPI over HTTPS (HTTP for very old EOS) | `network-operator` role, with command authorization on |
| `mikrotik` | RouterOS API (8728) or api-ssl (8729) | A group with policies `read,api` only |
| `pfsense` | REST API v2 package | A user whose group holds only the GET privileges of the endpoints read; an API key |
| `redfish` | Redfish over HTTPS | Login-only (HPE iLO 4), `ReadOnly` role (iLO 5, standard Redfish), "Read Only" (Dell iDRAC) |
| `maas` | MAAS API 2.0 | An administrator for a complete inventory, or a regular user for a partial one |
| `kubernetes` | Kubernetes API | `get`, `list`, `watch` on a fixed set of resources; no Secrets, no ConfigMaps |
| `trica-agent` | Reads the local host | Runs as its own user with three capabilities |

### Arista EOS

```
username trica privilege 1 role network-operator secret <long-random-password>
aaa authorization commands all default local
management api http-commands
   protocol https
   no shutdown
```

- `network-operator` limits the account to `show` commands **only if command authorization is
  on**: without `aaa authorization commands all default local`, EOS accepts the role but does not
  enforce it, and the privilege level alone decides. Enable it from a session that keeps an
  administrator logged in, check that administrator accounts still have a role that allows
  configuration (`network-admin`), then check the collector's account: `show version` answers,
  `configure` is refused.
- Very old EOS releases cannot negotiate modern TLS: `address: http://...` is honoured, but the
  Basic credentials then travel in clear text. Keep it to a management network.
- Old EOS releases have no JSON output for some commands (`show uptime`, `show lldp neighbors
  detail`, `show lldp local-info`, `show port-channel` on 4.14; `show uptime` on 4.20). eAPI answers
  them with error 1003 ("unconverted command"). The collector treats that as "not available on
  this release", a warning and not a failure, and falls back to other commands (uptime from
  `show version`, LAG members from `show interfaces`, LLDP from the brief neighbour table).
- Options: `max_edge_macs` (default 4: MAC tables are reported only on ports with few entries, not
  on trunks), `vlan_domain` (VLANs of switches in the same domain are one VLAN object).

### MikroTik RouterOS

```
/user group add name=trica-read policy=read,api
/user add name=trica group=trica-read password=<long-random-password> address=<collector-address>/32
/user group print where name=trica-read      # must show exactly read,api
```

- `read` allows `print`, `api` the API service; nothing else (no `write`, `policy`, `sensitive`,
  `ssh`, `winbox`, `web`, …). The `address=` restriction makes the password useless from anywhere
  else.
- Prefer api-ssl (`options.tls: true`): the router then needs a certificate on the service
  (`/ip service set api-ssl certificate=<name> disabled=no`), trusted through the target's
  `tls.ca_file`. Plain `api` sends the password in clear text.
- Options: `role` (`switch` or `router`; by default CRS/CSS models are switches), `skip`
  (`health`, `package`, `neighbor`, `host`) for a device that lacks a command, `max_edge_macs`,
  `vlan_domain`.

### pfSense

Needs the **REST API v2** package (`/api/v2`; v1 is not supported). The collector authenticates
with an API key (`X-API-Key`), held in the file referenced by `password`; `username` is unused.

1. **System › REST API › Settings**: enable the *API key* authentication method; enable
   *read-only mode* if offered (a second lock that refuses every non-GET request); check that the
   interface the collector arrives on is allowed.
2. **System › User Manager › Groups**: a group `trica-readonly` with only the GET privileges of
   the endpoints the collector reads. pfREST names them after the endpoint path and the verb:

   | Section | Privileges (GET) |
   |---|---|
   | System | `api-v2-system-hostname-get`, `api-v2-system-version-get`, `api-v2-status-system-get` |
   | Interfaces | `api-v2-interfaces-get`, `api-v2-status-interfaces-get`, `api-v2-interface-vlans-get` |
   | Routing | `api-v2-routing-gateways-get`, `api-v2-status-gateways-get`, `api-v2-routing-static-routes-get` |
   | Firewall | `api-v2-firewall-rules-get` |
   | NAT | `api-v2-firewall-nat-port-forwards-get`, `api-v2-firewall-nat-outbound-mappings-get`, `api-v2-firewall-nat-one-to-one-mappings-get` |
   | VPN | `api-v2-vpn-openvpn-servers-get`, `api-v2-vpn-openvpn-clients-get`, `api-v2-status-openvpn-servers-get`, `api-v2-status-openvpn-clients-get`, `api-v2-vpn-ipsec-phase1s-get`, `api-v2-status-ipsec-sas-get` |

   Labels can vary between package versions: filter the privilege list on `api-v2` and pick by
   meaning. Never add `page-all` ("WebCfg - All pages") or any POST, PATCH, PUT or DELETE
   privilege.
3. **System › User Manager › Users**: a user `trica` in that group.
4. Create the API key **as that user** (a key belongs to its creator). This needs the key-creation
   privilege (`api-v2-auth-key-post`): grant it to the group temporarily, create the key, remove
   it. The key is shown once.

Verify:

```bash
curl -sk -H "X-API-Key: $KEY" https://fw.example.com/api/v2/system/version       # 200
curl -sk -o /dev/null -w '%{http_code}\n' -X POST -H "X-API-Key: $KEY" \
  -H 'Content-Type: application/json' -d '{}' https://fw.example.com/api/v2/firewall/rule   # 403 or 405, never 200
```

A 403 on a GET names the missing privilege in the collection health: add it, or skip the section
with `options.skip` (`firewall_rules`, `nat`, `vpn`, `routes`) so the run is not partial forever.

### Redfish (server BMCs)

The collector sends `GET`s with HTTP Basic credentials. It **does not create a Redfish session**
(a session is a `POST`) and never calls an action.

| BMC | Account |
|---|---|
| HPE iLO 4 | iLO 4 has no Redfish role model: use the OEM privileges. **Login** on; Remote Console, Virtual Media, Virtual Power and Reset, Configure iLO Settings, Administer User Accounts off. With RIBCL (`hponcfg`) or with `POST /rest/v1/AccountService/Accounts` and `Oem.Hp.Privileges` (`LoginPriv: true`, the rest `false`). |
| HPE iLO 5 | The standard Redfish `ReadOnly` role (`"RoleId": "ReadOnly"` on `POST /redfish/v1/AccountService/Accounts/`), or the equivalent OEM privileges (`Oem.Hpe.Privileges`: only `LoginPriv`, and Host BIOS / NIC / Storage and Recovery Set off). |
| Dell iDRAC 8 | Role "Read Only" (privilege `0x1`): `racadm set iDRAC.Users.N.Privilege 0x1`, IPMI privilege 15 (no access), SOL disabled. |
| Other Redfish BMCs | The vendor's read-only or operator-less role. The collector follows standard links; a compliant BMC probably yields a partial inventory. |

- BMCs ship self-signed certificates: set `tls.ca_file`, or `tls.insecure: true` knowingly. Old
  iLO 4 firmware only offers TLS 1.0/1.1: `tls.min_version: "1.0"`.
- One run is sequential and costs 30 to 150 `GET`s depending on DIMMs, drives, firmware components
  and the event log. Start with `interval: 15m` and `timeout: 60s`; `options.skip_logs: true` skips
  a slow event log, `options.log_days` sets the look-back of the log counters.
- iLO accounts lock out after failed logins: a wrong password in the target locks the account for
  every client using it.
- Then verify on the canary: the account reads every resource (including the event log), and a
  `PATCH` with it is refused.

### MAAS

The MAAS API has **no read-only role** in the community edition: a user is either regular or an
administrator.

| Account | Machines collected | Risk |
|---|---|---|
| Administrator | All, full scope | The API key can write (allocate, deploy, release); trica never does, but protect and rotate the key |
| Regular user | Only unallocated machines and the ones that user owns: a regular user sees **0** deployed machines of others | The collector detects it (`users/?op=whoami`) and downgrades the run to partial, so nothing is ever reported gone; the inventory is incomplete |

```bash
sudo maas createadmin --username trica --password '<password>' --email trica@example.com
sudo maas apikey --username trica          # consumer_key:token_key:token_secret → a secret file
```

`address` is the region controller (`http(s)://host:5240`, without `/MAAS`); the API key goes in
`password`. `options.assume_full_visibility: true` only if a non-admin key provably sees every
machine (enterprise RBAC).

### Kubernetes

The collector needs `get`, `list` and `watch`, and nothing else, on: `nodes`, `namespaces`, `pods`,
`services`, `endpoints` (core); `endpointslices` (`discovery.k8s.io`); `deployments`,
`statefulsets`, `daemonsets`, `replicasets` (`apps`); `jobs`, `cronjobs` (`batch`); `ingresses`
(`networking.k8s.io`); `virtualmachineinstances`, `virtualmachines` (`kubevirt.io`, optional). It is
deliberately **not** granted Secrets or ConfigMaps.

- Inside the cluster: `address: in-cluster`, and the chart's `collect.kubernetes.rbac.enabled: true`
  creates that ClusterRole for the server's service account.
- From outside: `options.kubeconfig` (and `options.context`), optionally a bearer token in
  `password` (`kubectl create token ...`), `tls.ca_file` for the API server's CA.
- `options.cluster` is required and names the cluster object: two clusters need two names.
- `options.finished_pods: false` (default) skips pods that have ended. On clusters running CI or
  batch jobs, finished pods can outnumber live ones by far and make the pod list too large to read
  within the timeout.

### Linux agent

`trica-agent` reports the host it runs on: hardware (DMI), OS and kernel, CPU and memory,
virtualisation, interfaces and addresses, listening sockets and outbound connections, packages
(dpkg or rpm), services (systemd), disks with SMART health and wear, LLDP neighbours.

- **Packages** (deb, rpm): a dedicated `trica-agent` user, `ProtectSystem=strict`,
  `NoNewPrivileges`, and only `CAP_DAC_READ_SEARCH` (DMI serial, SMART), `CAP_SYS_PTRACE`
  (process names of sockets) and `CAP_SYS_RAWIO` (SMART on SATA/SAS). NVMe wear needs
  `CAP_SYS_ADMIN`, deliberately not granted; LLDP needs membership of the lldpd group, added by a
  drop-in where lldpd runs.
- **DaemonSet** (example in the repository): `hostPID`, `hostNetwork`, all capabilities dropped
  except `DAC_READ_SEARCH` and `SYS_PTRACE`, read-only root; the namespace needs the
  `privileged` Pod Security level.
- **Enrolment**: one-time token per host (`trica enrol create --binding agent:HOSTNAME`), or one
  class token for a fleet (`trica enrol create --prefix agent`), plus the server's `ca.pem`. The
  agent then holds a short-lived certificate it renews itself, and spools batches (64 MiB, oldest
  dropped first) while the server is away.

## Metrics

| Metric | Meaning |
|---|---|
| `trica_collect_runs_total` / `trica_collect_failures_total` | Runs finished / failed, labels `collector`, `target`. Alert on the failure rate. |
| `trica_collect_skipped_total` | Runs not started because the previous one was still going: the interval is shorter than a run. |
| `trica_collect_duration_seconds` | Duration of a run (histogram). |
| `trica_collect_last_success_timestamp_seconds` | Alert on `time() - …`. |
| `trica_collector_spooled_batches`, `…_sent_batches_total`, `…_dropped_batches_total` | Remote collector spool. |

Logs are JSON with `source`, `collector` and `target`; they never contain a credential.
