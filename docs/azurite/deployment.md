---
sidebar_position: 1
title: Deployment Guide
---

# Deployment Guide

Complete guide for deploying the Azurite Ambari Management Pack on Azure.

---

## Prerequisites Checklist

Before starting, confirm the following:

### Azure Account

- [ ] Active Azure subscription with Owner or Contributor role
- [ ] Sufficient quota in your target region (check via **Azure Portal > Subscriptions > Usage + quotas**):
  - Standard Dv3 Family vCPUs: at least 32 (2 head nodes x 4 vCPUs + 3 workers x 4 vCPUs + 3 ZK x 2 vCPUs)
  - Standard Av2 Family vCPUs: at least 6 (for ZooKeeper nodes)
  - Total Regional vCPUs: at least 38
  - If using Spot VMs: Spot vCPU quota for your worker VM family
- [ ] A resource group created for the cluster (or permission to create one)
- [ ] A storage account with hierarchical namespace enabled (for ADLS Gen2)

### Local Tools

- [ ] Azure CLI (`az`) version 2.40+ installed and authenticated (`az login`)
- [ ] SSH key pair generated (`ssh-keygen -t rsa -b 4096`)
- [ ] `jq` installed (used by bootstrap scripts)
- [ ] Git (to clone this repository)

### Network

- [ ] A VNet and subnet created (or the bootstrap will create one)
- [ ] NSG rules planned (see [NETWORKING.md](NETWORKING.md))

### Ambari

- [ ] Ambari Server 2.7.0+ installed on the head node (or planned for bootstrap)
- [ ] HDP 2.6, 3.0, or 3.1 stack available

---

## Option A: Bootstrap with ARM Template

The fastest path. The bootstrap script creates all Azure infrastructure and installs the mpack.

### Step 1: Configure

```bash
cd bootstrap/
cp deploy.env.example deploy.env
```

Edit `deploy.env` with your values:

```bash
AZURE_SUBSCRIPTION_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
AZURE_RESOURCE_GROUP="my-hadoop-cluster"
AZURE_REGION="eastus"
AZURE_VNET_NAME="hadoop-vnet"
AZURE_SUBNET_NAME="default"
SSH_PUBLIC_KEY_FILE="~/.ssh/id_rsa.pub"
AMBARI_ADMIN_PASSWORD="<strong-password>"
STORAGE_ACCOUNT_NAME="myadlsgen2acct"
STORAGE_CONTAINER_NAME="hadoop"
```

### Step 2: Deploy

```bash
chmod +x deploy.sh
./deploy.sh
```

The script will:
1. Create the resource group (if it does not exist)
2. Create VNet, subnet, and NSG
3. Create a user-assigned managed identity
4. Create the ADLS Gen2 storage account and assign the identity the "Storage Blob Data Contributor" role
5. Deploy head nodes, ZooKeeper nodes, and initial worker nodes via ARM template
6. Install Ambari Server on the primary head node
7. Install the mpack and register services

Typical deployment time: 15-25 minutes.

### Step 3: Verify Bootstrap

```bash
# Check Ambari is running
curl -u admin:$AMBARI_ADMIN_PASSWORD http://<head-node-ip>:8080/api/v1/clusters

# SSH to head node
ssh azureadmin@<head-node-ip>
```

---

## Option B: Manual Deployment on Existing VMs

Use this when you already have VMs with Ambari and HDP installed.

### Step 1: Build the Mpack

```bash
cd /path/to/azure-hadoop-cloud-mpack
mvn clean package -DskipTests
```

The mpack tarball is created at `target/azure-hadoop-cloud-mpack-*.tar.gz`.

### Step 2: Install the Mpack

Copy the tarball to the Ambari Server host and install:

```bash
scp target/azure-hadoop-cloud-mpack-*.tar.gz azureadmin@ambari-host:/tmp/

ssh azureadmin@ambari-host
sudo ambari-server install-mpack --mpack=/tmp/azure-hadoop-cloud-mpack-*.tar.gz --verbose
sudo ambari-server restart
```

### Step 3: Add Services via Ambari UI

1. Open Ambari at `http://<ambari-host>:8080`
2. Go to **Services > Add Service**
3. Add services in this order (dependencies are enforced):
   - **Azure Hadoop Cloud** -- storage integration (deployed to ALL nodes as a client)
   - **Azure VM Manager** -- VM lifecycle management (single master on head node)
   - **Azure Autoscaler** -- automatic scaling (single master, co-located with VM Manager recommended)
4. Follow the wizard to assign components to hosts

### Step 4: Install Azure SDK on the VM Manager Host

The Ambari install hook runs this automatically, but if it fails:

```bash
sudo pip3 install azure-mgmt-compute azure-mgmt-network azure-mgmt-resource azure-identity
```

---

## Post-Deployment: Storage Configuration

The recommended path is ADLS Gen2 with Managed Identity.

### Create the Storage Account (if not already done)

```bash
az storage account create \
  --name mystorageaccount \
  --resource-group my-hadoop-cluster \
  --location eastus \
  --sku Standard_LRS \
  --kind StorageV2 \
  --hns true  # Enables hierarchical namespace (ADLS Gen2)

az storage fs create \
  --name hadoop \
  --account-name mystorageaccount
```

### Create and Assign a Managed Identity

```bash
# Create the identity
az identity create \
  --name hadoop-cluster-identity \
  --resource-group my-hadoop-cluster

# Get the identity's principal ID and client ID
PRINCIPAL_ID=$(az identity show --name hadoop-cluster-identity \
  --resource-group my-hadoop-cluster --query principalId -o tsv)
CLIENT_ID=$(az identity show --name hadoop-cluster-identity \
  --resource-group my-hadoop-cluster --query clientId -o tsv)

# Assign Storage Blob Data Contributor to the storage account
STORAGE_ID=$(az storage account show --name mystorageaccount \
  --resource-group my-hadoop-cluster --query id -o tsv)

az role assignment create \
  --assignee-object-id $PRINCIPAL_ID \
  --role "Storage Blob Data Contributor" \
  --scope $STORAGE_ID

# Assign the identity to all cluster VMs
for vm in $(az vm list -g my-hadoop-cluster --query "[].name" -o tsv); do
  az vm identity assign --resource-group my-hadoop-cluster \
    --name $vm \
    --identities hadoop-cluster-identity
done
```

### Configure in Ambari

Navigate to **Azure Hadoop Cloud > Configs** and set:

| Config Section | Property | Value |
|---|---|---|
| azure-cloud-env | Storage Backend | Azure Data Lake Storage Gen2 |
| azure-cloud-env | Subscription ID | Your subscription ID |
| azure-cloud-env | Resource Group | my-hadoop-cluster |
| azure-cloud-env | Region | eastus |
| azure-storage-site | Storage Account Name | mystorageaccount |
| azure-storage-site | Storage Container Name | hadoop |
| azure-storage-site | Authentication Type | Managed Identity |
| azure-storage-site | Managed Identity Client ID | (the CLIENT_ID from above) |
| azure-identity-site | Identity Provider | Managed Identity |
| azure-identity-site | Client ID | (the CLIENT_ID from above) |

Save and restart all affected services when prompted.

The `fs.defaultFS` property in core-site is auto-computed by the service advisor:
```
abfs://hadoop@mystorageaccount.dfs.core.windows.net
```

---

## Validation Steps

### 1. Service Checks

In Ambari, run service checks for all three services:
- **Azure Hadoop Cloud**: verifies storage connectivity via `hdfs dfs -ls`
- **Azure VM Manager**: verifies the daemon is running and Azure ARM API is reachable
- **Azure Autoscaler**: verifies the daemon is running

### 2. Storage Connectivity

From the head node:

```bash
# ADLS Gen2
hdfs dfs -ls abfs://hadoop@mystorageaccount.dfs.core.windows.net/

# Write test
hdfs dfs -mkdir abfs://hadoop@mystorageaccount.dfs.core.windows.net/test
hdfs dfs -touchz abfs://hadoop@mystorageaccount.dfs.core.windows.net/test/hello.txt
hdfs dfs -ls abfs://hadoop@mystorageaccount.dfs.core.windows.net/test/

# Cleanup
hdfs dfs -rm -r abfs://hadoop@mystorageaccount.dfs.core.windows.net/test
```

### 3. YARN Job Test

```bash
# Run a simple MapReduce job to confirm YARN and storage are working together
yarn jar /usr/hdp/current/hadoop-mapreduce-client/hadoop-mapreduce-examples.jar pi 4 100
```

### 4. VM Manager Health

```bash
curl http://localhost:8470/api/v1/health
# Expected: {"status": "healthy", "mode": "managed", "vm_count": 3, "azure_sdk": true}
```

### 5. Autoscaler Health

```bash
curl http://localhost:8471/api/v1/health
# Expected: {"status": "healthy", "paused": false}
```

---

## Common Deployment Errors

### "ambari-server install-mpack" fails with version error

**Cause**: Ambari Server version is below 2.7.0.0.

**Fix**: Upgrade Ambari Server to 2.7.0+ before installing the mpack. The minimum version is defined in `mpack.json`.

### Azure SDK import errors when VM Manager starts

**Cause**: Python Azure SDK packages are not installed.

**Fix**:
```bash
sudo pip3 install azure-mgmt-compute azure-mgmt-network azure-mgmt-resource azure-identity
```

### "Storage Blob Data Contributor role assignment not found"

**Cause**: The managed identity does not have the correct role on the storage account. ADLS Gen2 requires `Storage Blob Data Contributor`, not the classic `Reader` or `Contributor` roles.

**Fix**:
```bash
az role assignment create \
  --assignee-object-id <managed-identity-principal-id> \
  --role "Storage Blob Data Contributor" \
  --scope /subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.Storage/storageAccounts/<acct>
```

### "No FileSystem for scheme: abfs"

**Cause**: The `hadoop-azure` and `azure-storage` JARs are missing from the Hadoop classpath.

**Fix**: Ensure these JARs are present in `/usr/hdp/current/hadoop-client/lib/`:
- `hadoop-azure-*.jar`
- `azure-storage-*.jar`
- `wildfly-openssl-*.jar` (for TLS)

The `hadoop_azure_jar_present` alert will fire if these are missing.

### VM creation fails with "OperationNotAllowed -- Quota exceeded"

**Cause**: Your subscription does not have enough vCPU quota in the target region.

**Fix**: Request a quota increase via **Azure Portal > Subscriptions > Usage + quotas > Request Increase**. Allow 1-3 business days for approval.

### Cloud-init script does not run on new worker VMs

**Cause**: The `azure.vm.ambari.server.url` is empty or incorrect.

**Fix**: Set this property in **Azure VM Manager > Configs > azure-vm-manager-site** to the Ambari server URL (e.g., `https://ambari-head-0.internal:8443`), then restart the VM Manager service.

### Ambari agent fails to register on new VMs

**Cause**: DNS resolution or network connectivity issue between worker VMs and the Ambari server.

**Fix**:
1. SSH into the new worker VM
2. Check `/var/log/cloud-init-output.log` for errors
3. Verify DNS: `nslookup <ambari-server-hostname>`
4. Verify connectivity: `curl -v http://<ambari-server>:8080/`
5. Check NSG rules allow inbound 8080/8443 from the VNet
