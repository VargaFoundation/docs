---
sidebar_position: 4
title: Troubleshooting
---

# Troubleshooting Guide

Problem/solution reference for the Azurite Ambari Management Pack.

---

## Worker VM Doesn't Register in Ambari

**Symptoms**: New worker VM appears in Azure Portal as "Running" but never shows up in Ambari as a registered host.

**Investigation**:
```bash
# SSH into the worker VM
ssh azureadmin@<worker-ip>

# Check cloud-init execution
cat /var/log/cloud-init-output.log

# Check if Ambari agent is installed
dpkg -l | grep ambari-agent

# Check if Ambari agent is running
systemctl status ambari-agent

# Check agent config
cat /etc/ambari-agent/conf/ambari-agent.ini | grep hostname

# Test connectivity to Ambari server
curl -v http://<ambari-server>:8080/
```

**Common causes and fixes**:

1. **Cloud-init failed silently**: The `azure.vm.ambari.server.url` in azure-vm-manager-site is empty or wrong. Set it to `http://<ambari-host>:8080` and restart VM Manager. Newly provisioned VMs will get the correct URL.

2. **DNS resolution failure**: The worker VM cannot resolve the Ambari server hostname. Fix: Use an IP address in the Ambari server URL, or configure Azure DNS / custom DNS on the VNet.

3. **NSG blocking traffic**: The worker VM cannot reach port 8080 or 8443 on the Ambari server. Fix: Add an inbound NSG rule allowing TCP 8080 from the VNet subnet (see [NETWORKING.md](NETWORKING.md)).

4. **Ambari agent installed but not started**: Run `systemctl enable ambari-agent && systemctl start ambari-agent` on the worker VM.

---

## ADLS Gen2 Storage Inaccessible

**Symptoms**: `hdfs dfs -ls abfs://container@account.dfs.core.windows.net/` returns an authorization error or timeout. The `azure_storage_connectivity` alert fires.

**Investigation**:
```bash
# Test Azure identity from the VM
curl -s -H "Metadata: true" \
  "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://storage.azure.com/" \
  | python3 -m json.tool

# Test storage access with az CLI
az storage fs list --account-name mystorageaccount --auth-mode login

# Check the managed identity assignment on this VM
az vm identity show --resource-group my-hadoop-cluster --name $(hostname)

# Verify the role assignment
az role assignment list --assignee <managed-identity-principal-id> --scope <storage-account-id>
```

**Common causes and fixes**:

1. **Managed identity not assigned to the VM**: Each VM must have the user-assigned managed identity attached.
   ```bash
   az vm identity assign --resource-group my-hadoop-cluster \
     --name <vm-name> --identities hadoop-cluster-identity
   ```

2. **Wrong role on storage account**: ADLS Gen2 requires "Storage Blob Data Contributor" (not just "Contributor" or "Reader").
   ```bash
   az role assignment create \
     --assignee-object-id <principal-id> \
     --role "Storage Blob Data Contributor" \
     --scope <storage-account-resource-id>
   ```

3. **`fs.defaultFS` misconfigured**: Check that core-site.xml has the correct value. For ADLS Gen2 it should be `abfs://<container>@<account>.dfs.core.windows.net`. The service advisor auto-computes this, but manual edits can break it.

4. **Hierarchical namespace not enabled**: The storage account must have HNS enabled for ADLS Gen2. This cannot be changed after account creation -- you must create a new storage account with `--hns true`.

5. **Network firewall on storage account**: If the storage account has "Selected networks" enabled, the cluster VNet/subnet must be in the allowed list, or use a private endpoint.

---

## Autoscaler Won't Scale Out

**Symptoms**: YARN shows pending containers, CPU is high, but no new workers are provisioned.

**Investigation**:
```bash
# Check autoscaler status
TOKEN=$(python3 -c "import json; print(json.load(open('/var/log/azure-autoscaler/autoscaler_config.json'))['api_token'])")
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8471/api/v1/status | python3 -m json.tool

# Check the autoscaler log
tail -100 /var/log/azure-autoscaler/autoscaler.log

# Check if autoscaling is paused
curl -s http://localhost:8471/api/v1/health
```

**Common causes and fixes**:

1. **Autoscaler is paused**: The `/api/v1/health` endpoint shows `"paused": true`. Resume via Ambari custom command RESUME_AUTOSCALING.

2. **Worker count already at maximum**: Check `azure.vm.pool.worker.max.count` in azure-vm-pool-site. The `worker_count_at_maximum` alert will be firing. Increase the max or request more Azure vCPU quota.

3. **Metrics not breaching long enough**: The default `scale.out.trigger.duration.seconds` is 300 (5 minutes). The metrics must stay above the threshold for the full duration. Check the log for "Scaling operation" vs "sustained breach" messages.

4. **Cooldown period active**: After a scale-out, the autoscaler waits `cooldown.scale.out.seconds` (default 300s) before scaling out again. The log will show "Scale-out triggered but in cooldown".

5. **YARN ResourceManager URL wrong**: If `autoscaler.yarn.resourcemanager.url` is misconfigured, metrics collection fails. Check the log for "Failed to collect YARN metrics". Fix the URL or leave it empty for auto-detection.

6. **VM quota exceeded**: The VM Manager may be failing to provision. Check `/var/log/azure-vm-manager/vm_manager.log` for "OperationNotAllowed" or "QuotaExceeded" errors.

7. **VM Manager unreachable**: The autoscaler calls `http://localhost:8470` by default. If the VM Manager is on a different host, update `autoscaler.vm.manager.url`.

---

## Autoscaler Won't Scale In

**Symptoms**: Cluster is idle but worker count stays the same.

**Investigation**:
```bash
# Check autoscaler status
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8471/api/v1/status | python3 -m json.tool

# Look for scale-in thread activity
grep -i "scale.in\|scale_in\|decommission" /var/log/azure-autoscaler/autoscaler.log | tail -20
```

**Common causes and fixes**:

1. **Scale-in thread stuck**: The autoscaler runs scale-in in a background thread. If YARN graceful decommission is waiting for containers to drain, the thread blocks until `graceful.decommission.timeout.seconds` (default 3600s = 1 hour). During this time, no new scale-in actions are taken. Check the log for "Scale-in already in progress, skipping".

2. **Already at minimum**: The worker count equals `azure.vm.pool.worker.min.count`. No further scale-in is possible.

3. **Scale-in cooldown active**: Default is 600 seconds. Log will show "Scale-in triggered but in cooldown".

4. **Metrics not low enough**: Scale-in requires CPU below 30% AND memory below 30% AND YARN available memory above 60% for the full trigger duration (300s). Check the actual metric values in the `/api/v1/status` response.

5. **Scale-out takes priority**: If any scale-out condition is also active, scale-in is suppressed (safety bias in the policy engine).

---

## VM Manager Daemon Won't Start

**Symptoms**: The AZURE_VM_MANAGER service fails to start in Ambari. The `vm_manager_process` alert fires.

**Investigation**:
```bash
# Check if the process is running
ps aux | grep azure_vm_operations

# Check the PID file
cat /var/run/azure-vm-manager/azure_vm_manager.pid

# Check logs
cat /var/log/azure-vm-manager/vm_manager.log

# Check the config file (contains sensitive data)
sudo cat /var/lib/azure-vm-manager/vm_manager_config.json | python3 -m json.tool
```

**Common causes and fixes**:

1. **Invalid config JSON**: A typo or missing value in the configuration causes a JSON parse error on startup. Check the log for "JSONDecodeError". Fix the config via Ambari and restart.

2. **Azure credential failure**: If using service principal and the secret is wrong, the daemon crashes on `_init_clients()`. Check for "Failed to initialize Azure clients" in the log.

3. **Port conflict**: Another process is using port 8470. Check with `ss -tlnp | grep 8470`. Change the port in `azure-vm-manager-env` > `vm_manager_port`.

4. **Missing Azure SDK**: Check for "Azure SDK not installed" in the log. Fix: `sudo pip3 install azure-mgmt-compute azure-mgmt-network azure-mgmt-resource azure-identity`.

5. **Permission denied**: The `azurevmgr` user cannot write to the data or log directories. Fix:
   ```bash
   sudo chown -R azurevmgr:hadoop /var/lib/azure-vm-manager /var/log/azure-vm-manager /var/run/azure-vm-manager
   ```

---

## SAS Token Expired

**Symptoms**: Storage access fails with "403 AuthenticationFailed" or "Server failed to authenticate the request". The `azure_credential_expiry` alert fires.

**Fix**:

1. Generate a new SAS token:
   ```bash
   az storage account generate-sas \
     --account-name mystorageaccount \
     --permissions rwdlacup \
     --services b \
     --resource-types sco \
     --expiry $(date -u -d '+90 days' +%Y-%m-%dT%H:%MZ) \
     -o tsv
   ```

2. In Ambari, go to **Azure Hadoop Cloud > Configs > azure-storage-site**

3. Update `azure.storage.sas.token` with the new token

4. Save and restart all affected services

**Prevention**: Set a calendar reminder to rotate SAS tokens before expiry. The `azure_credential_expiry` alert checks every 60 minutes and warns 7 days before expiration.

---

## Spot VM Was Evicted

**Symptoms**: A worker VM disappears from the Azure portal. Ambari shows the host as unhealthy. The `azure_vm_health` alert fires.

**Investigation**:
```bash
# Check Azure Activity Log for eviction events
az monitor activity-log list \
  --resource-group my-hadoop-cluster \
  --start-time $(date -u -d '-1 day' +%Y-%m-%dT%H:%MZ) \
  --query "[?contains(operationName.value, 'deallocate') || contains(operationName.value, 'delete')].{Time:eventTimestamp, Operation:operationName.value, Resource:resourceId}" \
  -o table

# Check VM Manager inventory
cat /var/lib/azure-vm-manager/vm_inventory.json | python3 -m json.tool
```

**Recovery**:

1. The VM Manager reconciles inventory with Azure on startup and periodically. Evicted VMs are detected and removed from inventory.

2. If the autoscaler is running and worker count drops below the minimum, it will automatically provision a replacement.

3. For manual recovery:
   ```bash
   # Force reconciliation by restarting VM Manager
   # Then provision a replacement
   curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
     -d '{"count": 1}' http://localhost:8470/api/v1/workers/provision
   ```

**Prevention**: Set `azure.vm.pool.worker.spot.max.price` to `-1` (up to on-demand price) to reduce eviction risk. For critical workloads, use on-demand VMs (`azure.vm.pool.worker.spot.enabled = false`).

---

## Ambari Server Unreachable

**Symptoms**: Cannot access the Ambari UI at port 8080. Worker VMs cannot register their agents.

**Investigation**:
```bash
# Check Ambari Server process
sudo ambari-server status

# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check Ambari Server logs
tail -50 /var/log/ambari-server/ambari-server.log

# Check port binding
ss -tlnp | grep 8080

# Check firewall/NSG
# From another VM in the same VNet:
curl -v http://<ambari-host>:8080/
```

**Common causes and fixes**:

1. **Ambari Server process crashed**: Check the log for OutOfMemoryError or other exceptions. Restart with `sudo ambari-server start`.

2. **PostgreSQL is down**: Ambari depends on PostgreSQL. Restart it: `sudo systemctl start postgresql`.

3. **PostgreSQL connection limit exceeded**: Too many connections. Check `max_connections` in `postgresql.conf`. Restart PostgreSQL after changing.

4. **NSG blocking inbound 8080/8443**: Verify NSG rules allow TCP 8080 and 8443 from the VNet (see [NETWORKING.md](NETWORKING.md)).

5. **Disk full on head node**: Check `df -h`. Clean up old logs: `find /var/log -name "*.log.*" -mtime +30 -delete`.

---

## YARN Jobs Failing

**Symptoms**: MapReduce or Spark jobs fail with container launch errors, storage access errors, or OutOfMemoryError.

**Investigation**:
```bash
# Check YARN application status
yarn application -list -appStates FAILED

# Get logs for a specific failed application
yarn logs -applicationId application_1234567890_0001

# Check NodeManager logs on the worker where the container ran
cat /var/log/hadoop-yarn/yarn-yarn-nodemanager-*.log | grep -i error | tail -20

# Check storage connectivity from the worker
hdfs dfs -ls abfs://container@account.dfs.core.windows.net/
```

**Common causes and fixes**:

1. **Storage connectivity lost on workers**: New worker VMs may not have the managed identity assigned, or the `hadoop-azure` JARs are missing. Check the `azure_storage_connectivity` and `hadoop_azure_jar_present` alerts.

2. **Container OOM killed**: The container exceeded its memory allocation. Increase `yarn.nodemanager.resource.memory-mb` or the job's mapper/reducer memory settings.

3. **NodeManager not running**: The NodeManager on the worker VM is down. Restart it from Ambari.

4. **Too many pending containers**: The cluster is undersized for the workload. Check if the autoscaler is working, or manually add workers.

5. **Temporary storage throttling**: Azure storage may throttle requests at high throughput. Check for "503 ServerBusy" or "500 OperationTimedOut" in the logs. Wait and retry, or use a Premium storage account.

---

## Bearer Token Rejected

**Symptoms**: Autoscaler cannot communicate with VM Manager. Log shows "401 Unauthorized" responses.

**Cause**: The VM Manager generates a new random `api_token` on every configure/start cycle. If the Autoscaler was started before the VM Manager was reconfigured, it holds a stale token reference.

**Fix**:

1. Restart the VM Manager service in Ambari (this generates a new token)
2. Restart the Autoscaler service in Ambari (it reads the VM Manager URL but uses its own internal token for its API)
3. If using direct API calls, re-read the token from the config file:
   ```bash
   TOKEN=$(python3 -c "import json; print(json.load(open('/var/lib/azure-vm-manager/vm_manager_config.json'))['api_token'])")
   ```

Note: The Autoscaler communicates with the VM Manager using the `vm_manager_api_token` from its own config. If both services are restarted together via Ambari, this is handled automatically.

---

## High Storage Latency

**Symptoms**: HDFS operations are slow. MapReduce jobs spend excessive time on I/O. Latency spikes in Ambari metrics.

**Investigation**:
```bash
# Test raw storage latency
time hdfs dfs -ls abfs://container@account.dfs.core.windows.net/

# Check Azure Storage metrics in Portal
# Go to Storage Account > Monitoring > Metrics
# Look at: Success E2E Latency, Success Server Latency, Transactions

# Check for throttling
# In Azure Monitor, filter for status code 503 (ServerBusy) or 429 (TooManyRequests)

# Check network path
traceroute account.dfs.core.windows.net
```

**Common causes and fixes**:

1. **Storage account is Standard tier**: Standard (HDD-backed) storage has higher latency than Premium. For latency-sensitive workloads, use a Premium storage account or Premium SSD managed disks for HDFS.

2. **Storage throttling**: Azure enforces per-account IOPS and throughput limits. If you exceed them, requests get 503 responses. Solutions:
   - Reduce concurrent I/O (fewer mapper tasks)
   - Distribute across multiple storage accounts
   - Upgrade to a higher storage tier

3. **Network bottleneck**: VMs in a different region than the storage account incur cross-region latency. Always co-locate VMs and storage in the same region.

4. **Missing private endpoint**: Traffic goes over the public internet instead of the Azure backbone. Create a private endpoint for the storage account in your VNet (see [NETWORKING.md](NETWORKING.md)).

5. **Small file problem**: Many small files cause high metadata overhead. Use SequenceFiles, ORC, or Parquet to consolidate. Run `hadoop archive` to reduce file count.
