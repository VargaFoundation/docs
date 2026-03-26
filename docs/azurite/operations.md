---
sidebar_position: 2
title: Operations Guide
---

# Operations Guide

Day-2 operations for the Azurite Ambari Management Pack.

---

## Monitoring

### Ambari Alerts to Watch

The mpack registers these alerts automatically. All are enabled by default.

| Alert | Service | Check Interval | What It Means |
|-------|---------|---------------|---------------|
| Azure VM Manager Process | AZURE_VM_MANAGER | 1 min | VM Manager daemon on port 8470 is down |
| Azure VM Pool Health | AZURE_VM_MANAGER | 5 min | One or more managed VMs are not in "Running" state |
| Azure ARM API Connectivity | AZURE_VM_MANAGER | 5 min | Cannot reach Azure Resource Manager API |
| Autoscaler Process | AZURE_AUTOSCALER | 1 min | Autoscaler daemon on port 8471 is down |
| Worker Count At Maximum | AZURE_AUTOSCALER | 5 min | Worker count has hit the configured ceiling -- cannot scale further |
| Scaling Operation Failures | AZURE_AUTOSCALER | 5 min | Recent scale-out or scale-in operations failed |
| Azure Storage Connectivity | AZURE_HADOOP_CLOUD | 5 min | Cannot reach the configured storage backend via HDFS commands |
| Azure Credential Expiry | AZURE_HADOOP_CLOUD | 60 min | SAS token or OAuth credential is nearing expiration |
| Hadoop Azure JAR Present | AZURE_HADOOP_CLOUD | 60 min | `hadoop-azure` or `azure-storage` JARs missing from classpath |

### Autoscaler Dashboard

The mpack includes a built-in Ambari widget dashboard under **Azure Autoscaler > Summary**:

- **Worker Node Count** (LINE graph) -- current vs. target worker count over 12 hours
- **Cluster CPU Utilization** (GAUGE) -- warning at 80%, critical at 95%
- **Cluster Memory Utilization** (GAUGE) -- warning at 80%, critical at 95%
- **YARN Pending Containers** (LINE graph) -- pending container count over 1 hour
- **Scaling Events** (LINE graph) -- scale-out and scale-in events over 24 hours

### REST API Status Endpoints

Query the daemon REST APIs for real-time status:

```bash
# VM Manager health (no auth required)
curl http://localhost:8470/api/v1/health

# Autoscaler health (no auth required)
curl http://localhost:8471/api/v1/health

# Autoscaler detailed status (requires Bearer token)
TOKEN=$(python3 -c "import json; print(json.load(open('/var/log/azure-autoscaler/autoscaler_config.json'))['api_token'])")
curl -H "Authorization: Bearer $TOKEN" http://localhost:8471/api/v1/status
```

The `/api/v1/status` response includes:
- `current_worker_count`, `last_decision`, `last_decision_reason`
- `scale_out_events`, `scale_in_events` (cumulative since last restart)
- `last_metrics` (most recent metrics snapshot)

---

## Scaling

### Manual Scaling via Ambari Custom Commands

Use these Ambari custom commands for immediate scaling actions:

**Scale out** (add workers):
- Service: Azure VM Manager > AZURE_VM_MANAGER_MASTER > Actions > **PROVISION_WORKERS**
- Or: Azure Autoscaler > AZURE_AUTOSCALER_MASTER > Actions > **FORCE_SCALE_OUT**

**Scale in** (remove workers):
- Service: Azure VM Manager > AZURE_VM_MANAGER_MASTER > Actions > **DECOMMISSION_WORKERS**
- Or: Azure Autoscaler > AZURE_AUTOSCALER_MASTER > Actions > **FORCE_SCALE_IN**

**Pause/resume autoscaling**:
- Azure Autoscaler > AZURE_AUTOSCALER_MASTER > Actions > **PAUSE_AUTOSCALING**
- Azure Autoscaler > AZURE_AUTOSCALER_MASTER > Actions > **RESUME_AUTOSCALING**

**List managed VMs**:
- Azure VM Manager > AZURE_VM_MANAGER_MASTER > Actions > **LIST_VMS**

### Automatic Scaling Configuration

Configure via **Azure Autoscaler > Configs > azure-autoscaler-site**:

| Property | Default | Description |
|----------|---------|-------------|
| `autoscaler.enabled` | true | Master toggle |
| `autoscaler.mode` | load_based | `load_based`, `schedule_based`, or `hybrid` |
| `autoscaler.evaluation.interval.seconds` | 60 | How often to check metrics |
| `autoscaler.scale.out.trigger.duration.seconds` | 300 | Metrics must breach for this long before acting |
| `autoscaler.scale.in.trigger.duration.seconds` | 300 | Same, for scale-in |
| `autoscaler.cooldown.scale.out.seconds` | 300 | Min time between scale-out actions |
| `autoscaler.cooldown.scale.in.seconds` | 600 | Min time between scale-in actions |
| `autoscaler.scale.out.increment` | 1 | Nodes added per event |
| `autoscaler.scale.in.decrement` | 1 | Nodes removed per event |
| `autoscaler.cpu.scale.out.threshold` | 80% | CPU above this triggers scale-out |
| `autoscaler.cpu.scale.in.threshold` | 30% | CPU below this triggers scale-in |
| `autoscaler.memory.scale.out.threshold` | 80% | Memory above this triggers scale-out |
| `autoscaler.memory.scale.in.threshold` | 30% | Memory below this triggers scale-in |
| `autoscaler.yarn.pending.containers.scale.out.threshold` | 10 | Pending containers above this trigger scale-out |
| `autoscaler.graceful.decommission.timeout.seconds` | 3600 | Max wait for YARN drain before force removal |

Worker count bounds are set in **Azure VM Manager > Configs > azure-vm-pool-site**:
- `azure.vm.pool.worker.min.count` (default: 1)
- `azure.vm.pool.worker.max.count` (default: 20)

### Schedule-Based Scaling

For cron-driven scaling, set `autoscaler.mode` to `schedule_based` or `hybrid`, then configure rules in **azure-autoscaler-schedule-site**:

```json
[
  {"cron": "0 8 * * MON-FRI", "target_count": 10, "label": "Business hours scale-up"},
  {"cron": "0 20 * * MON-FRI", "target_count": 3, "label": "Evening scale-down"},
  {"cron": "0 0 * * SAT", "target_count": 1, "label": "Weekend minimal"}
]
```

Set `schedule.timezone` to your local timezone (e.g., `US/Eastern`, `Europe/Paris`). Default is `UTC`.

---

## Adding Workers

### Via VM Manager (Managed Mode)

Run the **PROVISION_WORKERS** custom command in Ambari, or call the REST API directly:

```bash
TOKEN=$(python3 -c "import json; print(json.load(open('/var/lib/azure-vm-manager/vm_manager_config.json'))['api_token'])")
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"count": 3}' \
  http://localhost:8470/api/v1/workers/provision
```

Each new VM:
1. Is created with the configured VM size, disk type, and data disks from `azure-vm-pool-site`
2. Runs cloud-init to install and register the Ambari agent
3. Appears in Ambari as a new host after agent registration
4. Needs Hadoop components assigned via Ambari (NodeManager, DataNode, etc.)

### Manually (Existing VMs)

1. Provision the VM yourself (via Azure Portal, CLI, or Terraform)
2. Install the Ambari agent: `apt-get install ambari-agent`
3. Configure it to point to your Ambari server: edit `/etc/ambari-agent/conf/ambari-agent.ini`
4. Start the agent: `systemctl start ambari-agent`
5. Accept the host in Ambari UI and assign components

---

## Removing Workers

### Graceful Decommission Flow

This is the safe way to remove workers. Never delete a worker VM directly.

1. **Pause autoscaling** (if enabled) to prevent the autoscaler from interfering:
   - Ambari > Azure Autoscaler > Actions > PAUSE_AUTOSCALING

2. **Decommission YARN NodeManager** on the target node:
   - The autoscaler handles this automatically during scale-in
   - The YARN decommissioner sets the node to `DECOMMISSIONING` state
   - Running containers are allowed to complete (up to `graceful.decommission.timeout.seconds`)
   - Once all containers drain, the node transitions to `DECOMMISSIONED`

3. **Decommission HDFS DataNode** (if the node runs HDFS):
   - Only necessary for `core` type workers, not `task` type
   - In Ambari, stop the DataNode component on the target host
   - HDFS will re-replicate blocks to other nodes

4. **Delete the VM**:
   - Run DECOMMISSION_WORKERS custom command, or call the API:
     ```bash
     curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
       -d '{"hostnames": ["azr-worker-1234567890"]}' \
       http://localhost:8470/api/v1/workers/decommission
     ```
   - This deletes the VM, NIC, OS disk, and data disks from Azure

5. **Resume autoscaling**: Ambari > Azure Autoscaler > Actions > RESUME_AUTOSCALING

---

## Credential Rotation

### Storage Account Keys

1. Rotate the key in Azure Portal or CLI:
   ```bash
   az storage account keys renew --account-name mystorageaccount \
     --resource-group my-hadoop-cluster --key primary
   ```
2. Copy the new key
3. In Ambari, go to **Azure Hadoop Cloud > Configs > azure-storage-site**
4. Update `azure.storage.account.key` with the new key
5. Save and restart all affected services

### SAS Tokens

1. Generate a new SAS token:
   ```bash
   az storage account generate-sas --account-name mystorageaccount \
     --permissions rwdlacup --services b --resource-types sco \
     --expiry $(date -u -d '+90 days' +%Y-%m-%dT%H:%MZ) -o tsv
   ```
2. In Ambari, update `azure.storage.sas.token` in **azure-storage-site**
3. Save and restart affected services
4. The `azure_credential_expiry` alert will warn you 7 days before the token expires

### OAuth2 Client Secrets (Service Principal)

1. Create a new secret in **Azure Portal > App Registrations > Your App > Certificates & secrets**
2. In Ambari, update these in **azure-storage-site**:
   - `azure.oauth2.client.secret`
3. And in **azure-identity-site** (used by VM Manager):
   - `azure.identity.client.secret`
4. Save and restart all affected services

### Bearer Tokens (Daemon API)

The VM Manager and Autoscaler generate random API tokens at configure time. To rotate:

1. Restart the service in Ambari (stop, then start)
2. A new `api_token` is generated by `secrets.token_hex(32)` on each configure/start cycle
3. The Autoscaler reads the VM Manager token from the config file automatically

---

## Backup Procedures

### Ambari Database (PostgreSQL)

```bash
# One-time backup
sudo -u postgres pg_dump ambari > /backup/ambari-db-$(date +%Y%m%d).sql

# Compress
gzip /backup/ambari-db-$(date +%Y%m%d).sql

# Upload to Azure Blob
az storage blob upload \
  --account-name mybackupaccount \
  --container-name backups \
  --name ambari-db/ambari-db-$(date +%Y%m%d).sql.gz \
  --file /backup/ambari-db-$(date +%Y%m%d).sql.gz
```

Recommended cron schedule (daily at 2 AM):
```
0 2 * * * /opt/scripts/backup-ambari-db.sh >> /var/log/ambari-backup.log 2>&1
```

### NameNode Metadata

```bash
# Save current fsimage and edits
hdfs dfsadmin -fetchImage /backup/fsimage-$(date +%Y%m%d)

# Or copy from the NameNode data directory
cp -r /hadoop/hdfs/namenode/current/fsimage_* /backup/namenode/
cp -r /hadoop/hdfs/namenode/current/edits_* /backup/namenode/
```

### VM Inventory

```bash
cp /var/lib/azure-vm-manager/vm_inventory.json /backup/vm_inventory-$(date +%Y%m%d).json
```

### Cluster Configuration (Ambari Blueprint)

```bash
# Export the current blueprint
curl -u admin:password \
  "http://localhost:8080/api/v1/clusters/mycluster?format=blueprint" \
  > /backup/cluster-blueprint-$(date +%Y%m%d).json
```

---

## Restore Procedures

### Ambari Database

```bash
# Stop Ambari Server
sudo ambari-server stop

# Drop and recreate
sudo -u postgres dropdb ambari
sudo -u postgres createdb ambari

# Restore
gunzip -c /backup/ambari-db-20260325.sql.gz | sudo -u postgres psql ambari

# Start Ambari Server
sudo ambari-server start
```

### NameNode Metadata

Follow the standard HDFS NameNode recovery procedure:
1. Stop all HDFS services
2. Replace `/hadoop/hdfs/namenode/current/` with the backup
3. Run `hdfs namenode -recover` if needed
4. Start HDFS

### VM Inventory

```bash
sudo cp /backup/vm_inventory-20260325.json /var/lib/azure-vm-manager/vm_inventory.json
sudo chown azurevmgr:hadoop /var/lib/azure-vm-manager/vm_inventory.json
# Restart VM Manager -- it will reconcile with Azure on startup
```

---

## Upgrade

### Mpack Upgrade

1. Build the new mpack version
2. Stop all mpack services in Ambari (Autoscaler, VM Manager, Azure Hadoop Cloud)
3. Install the updated mpack:
   ```bash
   sudo ambari-server install-mpack --mpack=/tmp/azure-hadoop-cloud-mpack-<new-version>.tar.gz --verbose
   sudo ambari-server restart
   ```
4. In Ambari, go to each service and restart. Review any new configuration properties.

### HDP Stack Upgrade Considerations

- The mpack supports HDP 2.6, 3.0, and 3.1
- During an HDP upgrade, stop the Autoscaler and VM Manager first
- After the HDP upgrade, verify that `hadoop-azure` JARs are still on the classpath (the `hadoop_azure_jar_present` alert will check this)
- Reconfigure if `fs.defaultFS` or core-site properties were overwritten by the upgrade

---

## Log Locations

| Component | Log File | Description |
|-----------|----------|-------------|
| Azure VM Manager | `/var/log/azure-vm-manager/vm_manager.log` | VM creation, deletion, reconciliation |
| Azure Autoscaler | `/var/log/azure-autoscaler/autoscaler.log` | Metrics, scaling decisions, actions |
| Azure Hadoop Cloud | `/var/log/azure-hadoop-cloud/` | Storage integration (if applicable) |
| Ambari Server | `/var/log/ambari-server/ambari-server.log` | Mpack install, service operations |
| Ambari Agent | `/var/log/ambari-agent/ambari-agent.log` | Component install/start/stop on each host |
| Cloud-init (new VMs) | `/var/log/cloud-init-output.log` | Bootstrap script output on worker VMs |
| YARN ResourceManager | `/var/log/hadoop-yarn/yarn-yarn-resourcemanager-*.log` | YARN scheduling, decommission |
| YARN NodeManager | `/var/log/hadoop-yarn/yarn-yarn-nodemanager-*.log` | Container execution on workers |
| HDFS NameNode | `/var/log/hadoop-hdfs/hadoop-hdfs-namenode-*.log` | HDFS operations, storage access |

### Collecting Logs for Support

```bash
# Create a diagnostic bundle
mkdir -p /tmp/diag-$(date +%Y%m%d)
cp /var/log/azure-vm-manager/vm_manager.log /tmp/diag-$(date +%Y%m%d)/
cp /var/log/azure-autoscaler/autoscaler.log /tmp/diag-$(date +%Y%m%d)/
cp /var/lib/azure-vm-manager/vm_inventory.json /tmp/diag-$(date +%Y%m%d)/

# Autoscaler config (redact api_token before sharing)
python3 -c "
import json
cfg = json.load(open('/var/log/azure-autoscaler/autoscaler_config.json'))
cfg['api_token'] = '***REDACTED***'
json.dump(cfg, open('/tmp/diag-$(date +%Y%m%d)/autoscaler_config_redacted.json', 'w'), indent=2)
"

tar czf /tmp/diag-$(date +%Y%m%d).tar.gz -C /tmp diag-$(date +%Y%m%d)/
```
