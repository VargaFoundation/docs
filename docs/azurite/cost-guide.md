---
sidebar_position: 6
title: Cost Guide
---

# Cost Management Guide

Estimating, controlling, and optimizing costs for the Azurite Ambari Management Pack on Azure.

All prices are approximate US East region pay-as-you-go rates. Actual prices vary by region, commitment, and Azure pricing changes. Check the [Azure Pricing Calculator](https://azure.microsoft.com/en-us/pricing/calculator/) for current rates.

---

## Cluster Cost Estimation

### Default VM Sizes and Rates

These are the default VM sizes from the mpack configuration (azure-vm-pool-site):

| Node Type | Default VM Size | vCPUs | RAM (GB) | Approx $/hr | Approx $/month (730 hrs) |
|-----------|----------------|-------|----------|-------------|-------------------------|
| Head Node | Standard_D4_v3 | 4 | 16 | $0.192 | $140 |
| Worker Node | Standard_D4_v3 | 4 | 16 | $0.192 | $140 |
| ZooKeeper | Standard_A2_v2 | 2 | 4 | $0.091 | $66 |

### Storage Costs

| Storage Type | Unit | Approx Rate |
|-------------|------|-------------|
| ADLS Gen2 (Hot tier) | Per GB/month | $0.018 |
| ADLS Gen2 (Cool tier) | Per GB/month | $0.010 |
| ADLS Gen2 read operations | Per 10,000 | $0.004 |
| ADLS Gen2 write operations | Per 10,000 | $0.065 |
| Premium SSD (P10, 128 GB) | Per disk/month | $19.71 |
| Standard SSD (E10, 128 GB) | Per disk/month | $9.60 |
| Standard HDD (S10, 128 GB) | Per disk/month | $5.89 |

### Managed Disk Costs per Node

| Node Type | OS Disk | Data Disks | Monthly Disk Cost |
|-----------|---------|------------|-------------------|
| Head Node | 128 GB Premium SSD ($19.71) | 2 x 256 GB Premium SSD ($39.42) | $59.13 |
| Worker Node | 128 GB Standard HDD ($5.89) | 4 x 512 GB Standard HDD ($23.56) | $29.45 |
| ZooKeeper | 128 GB Standard SSD ($9.60) | None | $9.60 |

---

## Example Cluster Costs

### Small Cluster (Dev/Test): 5 Workers

| Component | Count | VM $/month | Disk $/month | Subtotal |
|-----------|-------|------------|-------------|----------|
| Head nodes | 2 | $280 | $118 | $398 |
| ZooKeeper nodes | 3 | $198 | $29 | $227 |
| Worker nodes | 5 | $700 | $147 | $847 |
| ADLS Gen2 (1 TB) | - | - | $18 | $18 |
| **Total** | **10 VMs** | | | **~$1,490/month** |

### Medium Cluster (Production): 15 Workers

| Component | Count | VM $/month | Disk $/month | Subtotal |
|-----------|-------|------------|-------------|----------|
| Head nodes | 2 | $280 | $118 | $398 |
| ZooKeeper nodes | 3 | $198 | $29 | $227 |
| Worker nodes (D8_v3) | 15 | $4,204 | $442 | $4,646 |
| ADLS Gen2 (10 TB) | - | - | $184 | $184 |
| **Total** | **20 VMs** | | | **~$5,455/month** |

(D8_v3 used for medium: 8 vCPUs, 32 GB RAM, ~$0.384/hr)

### Large Cluster (Enterprise): 50 Workers

| Component | Count | VM $/month | Disk $/month | Subtotal |
|-----------|-------|------------|-------------|----------|
| Head nodes (D8_v3) | 2 | $561 | $118 | $679 |
| ZooKeeper nodes | 5 | $330 | $48 | $378 |
| Worker nodes (D16_v3) | 50 | $28,032 | $1,473 | $29,505 |
| ADLS Gen2 (100 TB) | - | - | $1,843 | $1,843 |
| **Total** | **57 VMs** | | | **~$32,405/month** |

(D16_v3 used for large: 16 vCPUs, 64 GB RAM, ~$0.768/hr)

---

## Cost Optimization Strategies

### 1. Use Spot VMs for Task Workers (Save 60-80%)

Spot VMs are unused Azure capacity sold at a deep discount. They can be evicted with 30 seconds notice.

**When to use**: Task worker nodes that run compute-only (no HDFS DataNode). Lost work can be retried.

**Configuration** in azure-vm-pool-site:
```
azure.vm.pool.worker.type = task
azure.vm.pool.worker.spot.enabled = true
azure.vm.pool.worker.spot.max.price = -1   (up to on-demand price)
```

**Savings example** (Standard_D4_v3):
| Mode | $/hr | $/month (730 hrs) | Savings |
|------|------|--------------------|---------|
| On-demand | $0.192 | $140 | - |
| Spot (typical) | $0.038-$0.077 | $28-$56 | 60-80% |

**Risk mitigation**:
- Set `azure.vm.pool.worker.secondary.sizes` to provide fallback VM sizes if your primary size is unavailable on Spot
- Keep a base of on-demand core workers for HDFS, use Spot only for task nodes
- The autoscaler replaces evicted Spot VMs automatically

### 2. Schedule-Based Scaling (Scale Down Overnight/Weekends)

If workloads are business-hours only, scale down during off-hours.

**Configuration** in azure-autoscaler-schedule-site:
```json
[
  {"cron": "0 8 * * MON-FRI", "target_count": 15, "label": "Business hours"},
  {"cron": "0 20 * * MON-FRI", "target_count": 3, "label": "Evening"},
  {"cron": "0 0 * * SAT", "target_count": 1, "label": "Weekend"}
]
```

Set `autoscaler.mode = schedule_based` or `hybrid`.

**Savings example** (15 workers at D4_v3):
| Schedule | Hours/month | Worker-hrs | Cost |
|----------|-------------|------------|------|
| 24/7 (no scaling) | 730 | 10,950 | $2,102 |
| Business hours only (12h x 22d) | 264 | 3,960 | $760 |
| Weekend minimal (1 worker) | 466 | 466 | $89 |
| **Total with scheduling** | | | **$849** |
| **Savings** | | | **$1,253/month (60%)** |

### 3. Right-Size VMs

Monitor actual CPU and memory utilization via the Autoscaler dashboard. If utilization is consistently below 50%, you are over-provisioned.

**How to check**:
```bash
# Get current metrics from autoscaler
TOKEN=$(python3 -c "import json; print(json.load(open('/var/log/azure-autoscaler/autoscaler_config.json'))['api_token'])")
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8471/api/v1/status \
  | python3 -c "import sys,json; m=json.load(sys.stdin)['last_metrics']; print('CPU: {:.1f}%  Memory: {:.1f}%'.format(m.get('avg_cpu_pct',0), m.get('avg_memory_pct',0)))"
```

**Common right-sizing moves**:
| Current | Utilization | Recommendation |
|---------|-------------|----------------|
| D8_v3 (8 vCPU, 32 GB) | CPU <30%, Mem <40% | Downsize to D4_v3 (4 vCPU, 16 GB) |
| D4_v3 (4 vCPU, 16 GB) | CPU >80% sustained | Upsize to D8_v3 or add more workers |
| D16_v3 (16 vCPU, 64 GB) | Memory <25% | Switch to D8_v3 (half the memory) |

Change worker VM size in `azure.vm.pool.worker.size`. Existing workers keep their size; only new workers use the new size. To resize existing workers, decommission and reprovision them.

### 4. Use Reserved Instances for Head Nodes and ZooKeeper (Save 30-60%)

Head nodes and ZooKeeper run 24/7 and are not scaled. Azure Reserved Instances (1 or 3 year commitment) provide significant savings.

| VM Size | Pay-as-you-go $/month | 1-Year RI $/month | 3-Year RI $/month | 1Y Savings | 3Y Savings |
|---------|----------------------|-------------------|-------------------|------------|------------|
| Standard_D4_v3 | $140 | $87 | $56 | 38% | 60% |
| Standard_A2_v2 | $66 | $41 | $28 | 38% | 58% |

Purchase RIs via **Azure Portal > Reservations > Purchase**. Select the VM size, region, and term.

**What to reserve**: Head nodes (2x D4_v3) and ZK nodes (3x A2_v2). Do not reserve worker nodes since their count varies.

### 5. Storage Tiering

| Data Category | Tier | Rate/GB/month | When to Use |
|-------------|------|---------------|-------------|
| Active data | Hot | $0.018 | Current job input/output |
| Recent data | Cool | $0.010 | Last 30-90 days, occasional access |
| Archive data | Archive | $0.002 | Compliance, rarely accessed |

**Set up lifecycle management** on the storage account:
```bash
az storage account management-policy create \
  --account-name mystorageaccount \
  --resource-group my-hadoop-cluster \
  --policy '{
    "rules": [
      {
        "name": "cool-after-30",
        "enabled": true,
        "type": "Lifecycle",
        "definition": {
          "filters": {"blobTypes": ["blockBlob"], "prefixMatch": ["data/"]},
          "actions": {
            "baseBlob": {
              "tierToCool": {"daysAfterModificationGreaterThan": 30},
              "tierToArchive": {"daysAfterModificationGreaterThan": 180}
            }
          }
        }
      }
    ]
  }'
```

### 6. Auto-Shutdown Dev/Test Clusters

For dev/test clusters that are only needed during business hours, use Azure Auto-Shutdown:

```bash
# Set auto-shutdown at 8 PM local time for all VMs
for vm in $(az vm list -g my-dev-cluster --query "[].name" -o tsv); do
  az vm auto-shutdown --resource-group my-dev-cluster --name $vm \
    --time 2000 --timezone "Eastern Standard Time"
done
```

To start VMs in the morning, use an Azure Automation runbook or a Logic App on a schedule.

---

## Budget Alerting

### Azure Budget Alerts

Set up a budget on the resource group to get email alerts:

```bash
# Create a monthly budget of $2,000 with alerts at 80% and 100%
az consumption budget create \
  --budget-name hadoop-cluster-budget \
  --amount 2000 \
  --category Cost \
  --time-grain Monthly \
  --resource-group my-hadoop-cluster \
  --start-date $(date +%Y-%m-01) \
  --end-date $(date -d '+1 year' +%Y-%m-01)

# Note: Budget alert notifications must be configured in the Azure Portal
# Go to: Subscriptions > your-sub > Budgets > hadoop-cluster-budget > Alert conditions
```

### VM Manager Daily Budget (Optional)

If you want the VM Manager to refuse provisioning when a daily spend limit is approached, you can add a `vm_manager_daily_budget` property to the VM Manager configuration. This is not a built-in mpack feature but can be implemented as a custom guard in the provisioning workflow.

---

## Azure Cost Management Integration

### Resource Tagging

All VMs created by the VM Manager are tagged with:
```json
{"managed-by": "ambari-azure-mpack", "role": "<worker|head|zookeeper>"}
```

Add custom tags in azure-vm-manager-site > `azure.vm.tags`:
```json
{
  "managed-by": "ambari-azure-mpack",
  "environment": "production",
  "cost-center": "data-engineering",
  "project": "hadoop-analytics"
}
```

### Filtering in Azure Cost Management

Use these filters in **Azure Portal > Cost Management > Cost analysis**:
- **Resource group**: `my-hadoop-cluster` (all cluster costs)
- **Tag**: `managed-by = ambari-azure-mpack` (only mpack-managed VMs)
- **Tag**: `role = worker` (worker VM costs only)
- **Service name**: Virtual Machines, Storage, etc.

Export cost data for custom analysis:
```bash
# Export current month costs for the resource group
az cost management export create \
  --name monthly-hadoop-costs \
  --type ActualCost \
  --scope /subscriptions/<sub-id>/resourceGroups/my-hadoop-cluster \
  --storage-account backupstorageaccount \
  --storage-container cost-exports \
  --timeframe MonthToDate \
  --recurrence Monthly
```

---

## Monthly Cost Review Checklist

Run this review on the first business day of each month.

- [ ] **Check Azure Cost Management**: Compare actual spend vs. budget for the previous month
- [ ] **Review VM utilization**: Pull the Autoscaler dashboard metrics. Are workers consistently under 40% CPU? Consider right-sizing.
- [ ] **Check Spot savings**: Compare Spot vs. on-demand spending. If Spot evictions are frequent, consider adjusting max price or switching some workers to on-demand.
- [ ] **Review scaling events**: Check the Autoscaler "Scaling Events" graph. Frequent scale-out/scale-in cycles indicate thrashing -- increase cooldown timers or trigger durations.
- [ ] **Storage costs**: Check storage account costs. Is archive-eligible data still in Hot tier? Verify lifecycle management rules are working.
- [ ] **Orphaned resources**: Check for VMs, NICs, or disks in the resource group that are not in the VM inventory:
  ```bash
  # List all VMs
  az vm list -g my-hadoop-cluster --query "[].{Name:name, Status:powerState}" -o table
  # Compare with VM Manager inventory
  cat /var/lib/azure-vm-manager/vm_inventory.json | python3 -c "import sys,json; [print(v['name']) for v in json.load(sys.stdin)['vms']]"
  ```
- [ ] **Reserved Instance coverage**: Check RI utilization in **Azure Portal > Reservations**. Unused RI capacity is wasted money.
- [ ] **Update cost estimates**: If cluster size or VM types changed, update the cost projection in your internal tracking.
- [ ] **Document findings**: Record observations and actions taken for next month's review.
