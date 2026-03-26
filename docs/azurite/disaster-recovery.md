---
sidebar_position: 5
title: Disaster Recovery
---

# Disaster Recovery Guide

Backup, recovery, and DR procedures for the Azurite Ambari Management Pack.

---

## Backup Strategy Overview

| What | How | Frequency | Retention | Storage |
|------|-----|-----------|-----------|---------|
| Ambari database | `pg_dump` | Daily | 30 days | Azure Blob |
| NameNode metadata | `hdfs dfsadmin -fetchImage` | Daily | 14 days | Azure Blob |
| VM inventory | File copy | Daily | 14 days | Azure Blob |
| Cluster config (blueprint) | Ambari REST API export | Weekly + before changes | 90 days | Azure Blob |
| Service configs | Ambari REST API | Weekly | 90 days | Azure Blob |

All backups should be stored in a separate Azure storage account in the same region (or a paired region for cross-region DR). Use a dedicated resource group for backup storage.

---

## Backup Ambari Database

The Ambari database (PostgreSQL) contains cluster topology, configuration history, alert definitions, and user accounts.

### Manual Backup

```bash
# Create backup directory
sudo mkdir -p /backup/ambari-db

# Dump the database
sudo -u postgres pg_dump ambari | gzip > /backup/ambari-db/ambari-db-$(date +%Y%m%d-%H%M%S).sql.gz

# Upload to Azure Blob Storage
az storage blob upload \
  --account-name backupstorageaccount \
  --container-name ambari-backups \
  --name ambari-db/ambari-db-$(date +%Y%m%d-%H%M%S).sql.gz \
  --file /backup/ambari-db/ambari-db-$(date +%Y%m%d-%H%M%S).sql.gz \
  --auth-mode login
```

### Automated Backup Script

Save as `/opt/scripts/backup-ambari-db.sh`:

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/backup/ambari-db"
STORAGE_ACCOUNT="backupstorageaccount"
CONTAINER="ambari-backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"

# Dump
DUMP_FILE="$BACKUP_DIR/ambari-db-$TIMESTAMP.sql.gz"
sudo -u postgres pg_dump ambari | gzip > "$DUMP_FILE"

# Upload
az storage blob upload \
  --account-name "$STORAGE_ACCOUNT" \
  --container-name "$CONTAINER" \
  --name "ambari-db/ambari-db-$TIMESTAMP.sql.gz" \
  --file "$DUMP_FILE" \
  --auth-mode login --no-progress

# Clean up local files older than retention
find "$BACKUP_DIR" -name "ambari-db-*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Ambari DB backup completed: $DUMP_FILE"
```

Cron schedule (daily at 2:00 AM):
```
0 2 * * * /opt/scripts/backup-ambari-db.sh >> /var/log/backup-ambari-db.log 2>&1
```

---

## Backup NameNode Metadata

NameNode metadata (fsimage + edit logs) is critical for HDFS recovery. If using ADLS Gen2 as the primary storage (`fs.defaultFS = abfs://...`), HDFS metadata is less critical but still important for any local HDFS data.

### Manual Backup

```bash
# Fetch the current fsimage
sudo mkdir -p /backup/namenode
hdfs dfsadmin -fetchImage /backup/namenode/fsimage-$(date +%Y%m%d)

# Upload to Azure Blob
az storage blob upload \
  --account-name backupstorageaccount \
  --container-name ambari-backups \
  --name namenode/fsimage-$(date +%Y%m%d) \
  --file /backup/namenode/fsimage-$(date +%Y%m%d) \
  --auth-mode login
```

### Automated Backup Script

Save as `/opt/scripts/backup-namenode.sh`:

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/backup/namenode"
STORAGE_ACCOUNT="backupstorageaccount"
CONTAINER="ambari-backups"
RETENTION_DAYS=14
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"

# Fetch fsimage
FSIMAGE="$BACKUP_DIR/fsimage-$TIMESTAMP"
hdfs dfsadmin -fetchImage "$FSIMAGE"
gzip "$FSIMAGE"

# Upload
az storage blob upload \
  --account-name "$STORAGE_ACCOUNT" \
  --container-name "$CONTAINER" \
  --name "namenode/fsimage-$TIMESTAMP.gz" \
  --file "${FSIMAGE}.gz" \
  --auth-mode login --no-progress

# Cleanup
find "$BACKUP_DIR" -name "fsimage-*" -mtime +$RETENTION_DAYS -delete

echo "[$(date)] NameNode metadata backup completed: ${FSIMAGE}.gz"
```

Cron (daily at 3:00 AM, after Ambari DB backup):
```
0 3 * * * /opt/scripts/backup-namenode.sh >> /var/log/backup-namenode.log 2>&1
```

---

## Backup VM Inventory

The VM inventory file tracks all managed VMs. Without it, the VM Manager loses track of which VMs it created (though it reconciles with Azure on startup).

```bash
# One-liner backup
cp /var/lib/azure-vm-manager/vm_inventory.json \
  /backup/vm-inventory/vm_inventory-$(date +%Y%m%d).json

# Upload
az storage blob upload \
  --account-name backupstorageaccount \
  --container-name ambari-backups \
  --name vm-inventory/vm_inventory-$(date +%Y%m%d).json \
  --file /backup/vm-inventory/vm_inventory-$(date +%Y%m%d).json \
  --auth-mode login
```

---

## Backup Cluster Configuration

Export the Ambari blueprint to capture the full cluster configuration.

```bash
# Export blueprint
curl -u admin:$AMBARI_PASSWORD \
  "http://localhost:8080/api/v1/clusters/$(curl -s -u admin:$AMBARI_PASSWORD \
    http://localhost:8080/api/v1/clusters | python3 -c 'import sys,json; print(json.load(sys.stdin)["items"][0]["Clusters"]["cluster_name"])')?format=blueprint" \
  > /backup/blueprints/cluster-blueprint-$(date +%Y%m%d).json

# Also export the host mapping
curl -u admin:$AMBARI_PASSWORD \
  "http://localhost:8080/api/v1/clusters/mycluster/hosts" \
  > /backup/blueprints/host-mapping-$(date +%Y%m%d).json

# Upload both
for f in /backup/blueprints/*-$(date +%Y%m%d).json; do
  az storage blob upload \
    --account-name backupstorageaccount \
    --container-name ambari-backups \
    --name "blueprints/$(basename $f)" \
    --file "$f" \
    --auth-mode login
done
```

---

## Recovery Scenarios

### Single Worker Node Failure

**RTO**: 5-15 minutes (automatic), 10-30 minutes (manual)
**RPO**: Zero (workers are stateless for task nodes; HDFS replicates data for core nodes)

**Automatic recovery**:
- The VM Manager detects the missing VM during inventory reconciliation
- If the autoscaler is running and worker count drops below minimum, a replacement is provisioned automatically
- The Ambari `azure_vm_health` alert fires to notify the operator

**Manual recovery**:
1. Confirm the VM is gone: `az vm show -g my-hadoop-cluster -n <vm-name>` returns not found
2. Remove from Ambari: **Hosts > (dead host) > Host Actions > Delete Host**
3. Provision a replacement:
   ```bash
   curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
     -d '{"count": 1}' http://localhost:8470/api/v1/workers/provision
   ```
4. Once the new VM registers, assign components in Ambari

### Head Node Failure

**RTO**: 30-60 minutes
**RPO**: Last Ambari DB backup (daily by default)

If HA is configured (2 head nodes, `azure.vm.pool.head.count = 2`):

1. **Automatic failover**: The standby head node takes over for HDFS NameNode (if configured with HDFS HA) and YARN ResourceManager (if configured with RM HA)
2. **Ambari Server**: Move Ambari Server to the standby node or restore from backup

If no HA:

1. Restore the head node VM from Azure backup or rebuild it
2. Install Ambari Server
3. Restore the Ambari database:
   ```bash
   # Download the latest backup
   az storage blob download \
     --account-name backupstorageaccount \
     --container-name ambari-backups \
     --name ambari-db/ambari-db-latest.sql.gz \
     --file /tmp/ambari-db-latest.sql.gz \
     --auth-mode login

   gunzip /tmp/ambari-db-latest.sql.gz

   # Restore
   sudo -u postgres dropdb ambari
   sudo -u postgres createdb ambari
   sudo -u postgres psql ambari < /tmp/ambari-db-latest.sql

   sudo ambari-server start
   ```
4. Restart the VM Manager and Autoscaler services

### ZooKeeper Node Failure

**RTO**: Immediate (if quorum is maintained), 15-30 minutes (if quorum is lost)
**RPO**: Zero (ZK data is replicated across all ZK nodes)

**Quorum intact** (1 of 3 nodes failed, or 1-2 of 5 nodes failed):
- The ZooKeeper ensemble continues to function
- Replace the failed node: provision a new VM, install ZooKeeper, add to the ensemble

**Quorum lost** (2 of 3 nodes failed):
- All ZK-dependent services are impacted (HDFS HA failover, YARN RM HA, HBase)
- Recover at least one more ZK node to restore quorum
- If VMs are recoverable, restart ZooKeeper on them
- If VMs are lost, provision new ones, restore ZK data from the surviving node, and reconfigure `zoo.cfg`

### Storage Account Outage

**RTO**: Depends on Azure (typically 1-4 hours for regional outage)
**RPO**: Zero (Azure Storage provides built-in redundancy)

**If using ADLS Gen2 with LRS/ZRS**:
- Wait for Azure to resolve the issue. Monitor [Azure Status](https://status.azure.com/).
- If the storage account is on GRS/RA-GRS, initiate a failover to the secondary region:
  ```bash
  az storage account failover --name mystorageaccount -g my-hadoop-cluster
  ```
  **Warning**: Storage failover changes the account endpoint and may cause data loss for writes not yet replicated.

**Mitigation**: Jobs will fail with storage errors. Pause the autoscaler to prevent unnecessary scaling. Resume operations after storage is restored.

### Complete Cluster Loss

**RTO**: 1-3 hours
**RPO**: Last backup cycle (daily)

1. **Redeploy infrastructure**:
   ```bash
   cd bootstrap/
   ./deploy.sh
   ```
   Or manually recreate VMs using the ARM template.

2. **Restore Ambari database** (see Head Node Failure procedure above)

3. **Restore VM inventory**:
   ```bash
   az storage blob download \
     --account-name backupstorageaccount \
     --container-name ambari-backups \
     --name vm-inventory/vm_inventory-latest.json \
     --file /var/lib/azure-vm-manager/vm_inventory.json \
     --auth-mode login
   ```

4. **Restore NameNode metadata** (if using local HDFS):
   ```bash
   az storage blob download \
     --account-name backupstorageaccount \
     --container-name ambari-backups \
     --name namenode/fsimage-latest.gz \
     --file /tmp/fsimage-latest.gz \
     --auth-mode login
   gunzip /tmp/fsimage-latest.gz
   cp /tmp/fsimage-latest /hadoop/hdfs/namenode/current/
   ```

5. **Start services** in order: ZooKeeper, HDFS, YARN, Azure Hadoop Cloud, Azure VM Manager, Azure Autoscaler

6. **Verify**: Run Ambari service checks, test storage connectivity, submit a test YARN job

### Ambari DB Corruption

**RTO**: 15-30 minutes
**RPO**: Last `pg_dump` backup

```bash
# Stop Ambari
sudo ambari-server stop

# Backup the corrupted database (for analysis)
sudo -u postgres pg_dump ambari > /tmp/ambari-corrupted-$(date +%Y%m%d).sql 2>/dev/null || true

# Drop and recreate
sudo -u postgres dropdb ambari
sudo -u postgres createdb ambari

# Restore from latest good backup
LATEST=$(ls -t /backup/ambari-db/ambari-db-*.sql.gz | head -1)
gunzip -c "$LATEST" | sudo -u postgres psql ambari

# Start Ambari
sudo ambari-server start

# Verify
curl -u admin:password http://localhost:8080/api/v1/clusters
```

---

## RTO/RPO Summary

| Scenario | RTO | RPO | Auto-Recovery |
|----------|-----|-----|---------------|
| Single worker failure (task node) | 5-15 min | 0 | Yes (autoscaler) |
| Single worker failure (core node) | 10-30 min | 0 (HDFS replication) | Partial |
| Head node failure (HA) | 5 min (failover) | 0 | Yes (automatic failover) |
| Head node failure (no HA) | 30-60 min | Last daily backup | No |
| ZooKeeper failure (quorum intact) | 0 (transparent) | 0 | No (manual replacement) |
| ZooKeeper failure (quorum lost) | 15-30 min | 0 | No |
| Storage account outage | 1-4 hours | 0 (Azure SLA) | No (wait for Azure) |
| Complete cluster loss | 1-3 hours | Last daily backup | No |
| Ambari DB corruption | 15-30 min | Last daily backup | No |
| Spot VM eviction | 5-10 min | 0 | Yes (autoscaler) |

---

## DR Testing Procedures

Run DR tests quarterly to validate backup integrity and recovery procedures.

### Quarterly DR Test Plan

**Week 1: Backup Verification**
- [ ] Download the latest Ambari DB backup from Azure Blob
- [ ] Restore it to a test PostgreSQL instance (not the production one)
- [ ] Verify the restore completes without errors
- [ ] Query the restored database to confirm cluster and host records exist:
  ```bash
  sudo -u postgres psql ambari_test -c "SELECT count(*) FROM clusters;"
  sudo -u postgres psql ambari_test -c "SELECT count(*) FROM hosts;"
  ```
- [ ] Download and verify the latest NameNode fsimage backup
- [ ] Download and verify the latest VM inventory backup

**Week 2: Single Node Recovery**
- [ ] Identify a non-critical worker node
- [ ] Manually stop the Ambari agent on it (simulating failure)
- [ ] Verify the `azure_vm_health` alert fires within 5 minutes
- [ ] Verify the autoscaler provisions a replacement (if autoscaling is enabled)
- [ ] Or manually provision a replacement via the VM Manager
- [ ] Verify the replacement registers in Ambari and becomes healthy
- [ ] Restart the original node's agent, remove the replacement

**Week 3: Credential Rotation Drill**
- [ ] Rotate a SAS token or storage key in a non-production cluster
- [ ] Update the credential in Ambari
- [ ] Verify storage access resumes after service restart
- [ ] Document the time to complete the rotation

**Week 4: Documentation Review**
- [ ] Review this DR guide for accuracy
- [ ] Verify all backup scripts are running (check cron logs)
- [ ] Verify backup retention (old backups are being cleaned up)
- [ ] Update the RTO/RPO table if infrastructure has changed
- [ ] File a report with findings and any corrective actions
