---
sidebar_position: 3
title: Networking Guide
---

# Networking Guide

Network architecture and configuration for the Azurite Ambari Management Pack on Azure.

---

## Architecture Diagram

```
                           Internet
                              |
                         [ Azure NSG ]
                              |
                    +---------+---------+
                    |    Azure VNet     |
                    |  10.0.0.0/16      |
                    |                   |
                    |  +-------------+  |
                    |  |   Subnet    |  |
                    |  | 10.0.0.0/24 |  |
                    |  |             |  |
                    |  |  Head-0     |  |        +---------------------------+
                    |  |  (Ambari    |  |        |  Azure Storage (ADLS Gen2)|
                    |  |   Server,   |  |        |                           |
                    |  |   NameNode, |  |  abfs  |  account.dfs.core.        |
                    |  |   VM Mgr,   |---------->|    windows.net            |
                    |  |   Autoscaler)|  |        |                           |
                    |  |             |  |        +---------------------------+
                    |  |  Head-1     |  |               ^
                    |  |  (Standby)  |  |               |
                    |  |             |  |        (Optional Private Endpoint)
                    |  |  ZK-0       |  |
                    |  |  ZK-1       |  |
                    |  |  ZK-2       |  |
                    |  |             |  |
                    |  |  Worker-0   |  |
                    |  |  Worker-1   |  |
                    |  |  Worker-N   |  |
                    |  |  (dynamic)  |  |
                    |  +-------------+  |
                    |                   |
                    +-------------------+
                              |
                     (Optional VNet Peering)
                              |
                    +-------------------+
                    | On-Premises /     |
                    | Other VNets       |
                    +-------------------+
```

All cluster VMs reside in a single subnet within an Azure VNet. The NSG is applied at the subnet level or NIC level. Storage access goes over the Azure backbone (or via private endpoint for production). Outbound internet access is required for Azure SDK API calls to `management.azure.com`.

---

## Required NSG Inbound Rules

These rules allow necessary traffic into the cluster subnet. Adjust the Source column based on your security requirements.

| Priority | Name | Port | Source | Protocol | Direction | Purpose |
|----------|------|------|--------|----------|-----------|---------|
| 100 | SSH | 22 | Admin IP/range | TCP | Inbound | SSH access for administration |
| 200 | Ambari-HTTP | 8080 | VNet (10.0.0.0/16) | TCP | Inbound | Ambari Server web UI and API |
| 300 | Ambari-HTTPS | 8443 | VNet (10.0.0.0/16) | TCP | Inbound | Ambari Server HTTPS (if enabled) |
| 400 | HDFS-NN | 8020 | VNet (10.0.0.0/16) | TCP | Inbound | HDFS NameNode RPC |
| 500 | HDFS-Web | 50070 | VNet (10.0.0.0/16) | TCP | Inbound | HDFS NameNode web UI |
| 600 | YARN-RM | 8088 | VNet (10.0.0.0/16) | TCP | Inbound | YARN ResourceManager web UI and API |
| 700 | ZooKeeper | 2181 | VNet (10.0.0.0/16) | TCP | Inbound | ZooKeeper client connections |
| 800 | VM-Manager | 8470 | VNet (10.0.0.0/16) | TCP | Inbound | Azure VM Manager REST API |
| 900 | Autoscaler | 8471 | VNet (10.0.0.0/16) | TCP | Inbound | Azure Autoscaler REST API |
| 1000 | YARN-NM | 8042 | VNet (10.0.0.0/16) | TCP | Inbound | YARN NodeManager web UI |
| 1100 | Ambari-Agent | 8670-8671 | VNet (10.0.0.0/16) | TCP | Inbound | Ambari Agent heartbeat and registration |
| 1200 | ZK-Election | 2888 | VNet (10.0.0.0/16) | TCP | Inbound | ZooKeeper peer communication |
| 1300 | ZK-Leader | 3888 | VNet (10.0.0.0/16) | TCP | Inbound | ZooKeeper leader election |
| 4096 | DenyAllInbound | * | * | * | Inbound | Deny everything else (implicit) |

**Minimal external exposure**: Only SSH (priority 100) should be open to external IPs. All other rules should be scoped to the VNet or subnet CIDR.

### Create NSG Rules with Azure CLI

```bash
RG="my-hadoop-cluster"
NSG="hadoop-nsg"

# SSH from your admin IP only
az network nsg rule create -g $RG --nsg-name $NSG \
  --name SSH --priority 100 --direction Inbound \
  --source-address-prefixes "203.0.113.10/32" --destination-port-ranges 22 \
  --protocol Tcp --access Allow

# Ambari HTTP from VNet
az network nsg rule create -g $RG --nsg-name $NSG \
  --name Ambari-HTTP --priority 200 --direction Inbound \
  --source-address-prefixes "10.0.0.0/16" --destination-port-ranges 8080 \
  --protocol Tcp --access Allow

# Ambari HTTPS from VNet
az network nsg rule create -g $RG --nsg-name $NSG \
  --name Ambari-HTTPS --priority 300 --direction Inbound \
  --source-address-prefixes "10.0.0.0/16" --destination-port-ranges 8443 \
  --protocol Tcp --access Allow

# HDFS NameNode from VNet
az network nsg rule create -g $RG --nsg-name $NSG \
  --name HDFS-NN --priority 400 --direction Inbound \
  --source-address-prefixes "10.0.0.0/16" --destination-port-ranges 8020 \
  --protocol Tcp --access Allow

# HDFS Web UI from VNet
az network nsg rule create -g $RG --nsg-name $NSG \
  --name HDFS-Web --priority 500 --direction Inbound \
  --source-address-prefixes "10.0.0.0/16" --destination-port-ranges 50070 \
  --protocol Tcp --access Allow

# YARN ResourceManager from VNet
az network nsg rule create -g $RG --nsg-name $NSG \
  --name YARN-RM --priority 600 --direction Inbound \
  --source-address-prefixes "10.0.0.0/16" --destination-port-ranges 8088 \
  --protocol Tcp --access Allow

# ZooKeeper from VNet
az network nsg rule create -g $RG --nsg-name $NSG \
  --name ZooKeeper --priority 700 --direction Inbound \
  --source-address-prefixes "10.0.0.0/16" --destination-port-ranges 2181 \
  --protocol Tcp --access Allow

# VM Manager from VNet
az network nsg rule create -g $RG --nsg-name $NSG \
  --name VM-Manager --priority 800 --direction Inbound \
  --source-address-prefixes "10.0.0.0/16" --destination-port-ranges 8470 \
  --protocol Tcp --access Allow

# Autoscaler from VNet
az network nsg rule create -g $RG --nsg-name $NSG \
  --name Autoscaler --priority 900 --direction Inbound \
  --source-address-prefixes "10.0.0.0/16" --destination-port-ranges 8471 \
  --protocol Tcp --access Allow
```

---

## Required NSG Outbound Rules

| Priority | Name | Port | Destination | Protocol | Direction | Purpose |
|----------|------|------|-------------|----------|-----------|---------|
| 100 | Azure-ARM-API | 443 | AzureResourceManager | TCP | Outbound | VM Manager calls to Azure management API |
| 200 | Azure-Storage | 443 | Storage | TCP | Outbound | ADLS Gen2 / Blob Storage access |
| 300 | Azure-Identity | 443 | AzureActiveDirectory | TCP | Outbound | OAuth2 token acquisition |
| 400 | Azure-IMDS | 80 | 169.254.169.254/32 | TCP | Outbound | Instance Metadata Service (managed identity) |
| 500 | Ubuntu-Repos | 80,443 | Internet | TCP | Outbound | Package manager (apt) for cloud-init |
| 600 | VNet-Internal | * | VirtualNetwork | * | Outbound | Intra-cluster communication |
| 4096 | DenyAllOutbound | * | * | * | Outbound | (optional) Deny all other outbound |

Use Azure [service tags](https://learn.microsoft.com/en-us/azure/virtual-network/service-tags-overview) (`AzureResourceManager`, `Storage`, `AzureActiveDirectory`) instead of IP ranges for outbound rules. Service tags are maintained by Microsoft and update automatically.

**Note**: If you deny all outbound by default, you must explicitly allow the destinations above. The Azure IMDS endpoint (169.254.169.254) is required for managed identity token acquisition.

---

## DNS Configuration

### Azure-Provided DNS (Default)

Azure VNets use Azure-provided DNS by default (168.63.129.16). This resolves:
- Azure VM hostnames within the VNet (e.g., `head-0.internal.cloudapp.net`)
- Public Azure service endpoints (e.g., `mystorageaccount.dfs.core.windows.net`)

This works for most deployments with no additional configuration.

### Custom DNS

If you use a custom DNS server (e.g., for on-premises name resolution):

1. Set custom DNS on the VNet:
   ```bash
   az network vnet update -g $RG --name hadoop-vnet \
     --dns-servers 10.1.0.4 168.63.129.16
   ```
   Always include `168.63.129.16` as a secondary to resolve Azure service endpoints.

2. Configure a DNS forwarder on your custom DNS server to forward `*.dfs.core.windows.net` and `*.blob.core.windows.net` to 168.63.129.16.

3. After changing DNS settings, restart the VMs or run `systemctl restart systemd-resolved` for changes to take effect.

### Hostnames and Ambari

Ambari uses hostnames for component communication. Ensure:
- All cluster VMs can resolve each other by hostname
- The `azure.vm.ambari.server.url` is resolvable from new worker VMs
- If using private DNS zones, add A records for all cluster hosts

---

## Private Endpoints for Storage

Recommended for production. Private endpoints route storage traffic over the Azure backbone via a private IP in your VNet, eliminating public internet exposure.

### Create a Private Endpoint

```bash
# Get the storage account ID
STORAGE_ID=$(az storage account show --name mystorageaccount -g $RG --query id -o tsv)

# Create the private endpoint
az network private-endpoint create \
  --name pe-storage-dfs \
  --resource-group $RG \
  --vnet-name hadoop-vnet \
  --subnet default \
  --private-connection-resource-id $STORAGE_ID \
  --group-id dfs \
  --connection-name storage-dfs-connection

# Create a private DNS zone for ADLS Gen2
az network private-dns zone create \
  --resource-group $RG \
  --name "privatelink.dfs.core.windows.net"

# Link the DNS zone to the VNet
az network private-dns zone link vnet create \
  --resource-group $RG \
  --zone-name "privatelink.dfs.core.windows.net" \
  --name storage-dns-link \
  --virtual-network hadoop-vnet \
  --registration-enabled false

# Create DNS records for the private endpoint
NIC_ID=$(az network private-endpoint show --name pe-storage-dfs -g $RG --query 'networkInterfaces[0].id' -o tsv)
PRIVATE_IP=$(az network nic show --ids $NIC_ID --query 'ipConfigurations[0].privateIpAddress' -o tsv)

az network private-dns record-set a create \
  --resource-group $RG \
  --zone-name "privatelink.dfs.core.windows.net" \
  --name mystorageaccount

az network private-dns record-set a add-record \
  --resource-group $RG \
  --zone-name "privatelink.dfs.core.windows.net" \
  --record-set-name mystorageaccount \
  --ipv4-address $PRIVATE_IP
```

After setup, `mystorageaccount.dfs.core.windows.net` resolves to the private IP from within the VNet.

### Verify

```bash
# From a cluster VM
nslookup mystorageaccount.dfs.core.windows.net
# Should return a 10.x.x.x private IP, not a public IP

hdfs dfs -ls abfs://hadoop@mystorageaccount.dfs.core.windows.net/
```

---

## VNet Peering for On-Premises Connectivity

If you need to connect the Hadoop cluster to an on-premises network or another Azure VNet:

### VNet-to-VNet Peering

```bash
# Peer hadoop-vnet with another VNet
az network vnet peering create \
  --name hadoop-to-corp \
  --resource-group $RG \
  --vnet-name hadoop-vnet \
  --remote-vnet /subscriptions/<sub>/resourceGroups/<other-rg>/providers/Microsoft.Network/virtualNetworks/corp-vnet \
  --allow-vnet-access

# Create the reverse peering
az network vnet peering create \
  --name corp-to-hadoop \
  --resource-group <other-rg> \
  --vnet-name corp-vnet \
  --remote-vnet /subscriptions/<sub>/resourceGroups/$RG/providers/Microsoft.Network/virtualNetworks/hadoop-vnet \
  --allow-vnet-access
```

Ensure non-overlapping address spaces between peered VNets.

### VPN Gateway (On-Premises)

For on-premises connectivity, create a VPN Gateway or use ExpressRoute. This is outside the scope of this guide -- refer to [Azure VPN Gateway documentation](https://learn.microsoft.com/en-us/azure/vpn-gateway/).

Key considerations:
- The on-premises DNS must resolve Azure hostnames (use a DNS forwarder)
- NSG rules must allow traffic from the on-premises CIDR
- Bandwidth planning: Hadoop generates significant inter-node traffic

---

## Firewall Configuration (Azure Firewall or NVA)

If your organization routes all outbound traffic through Azure Firewall or a network virtual appliance (NVA):

### Required Application Rules (FQDN-based)

| Rule Name | Protocol | Target FQDNs | Purpose |
|-----------|----------|--------------|---------|
| Azure-Management | HTTPS (443) | `management.azure.com`, `login.microsoftonline.com` | ARM API and authentication |
| Azure-Storage | HTTPS (443) | `*.dfs.core.windows.net`, `*.blob.core.windows.net` | Storage access |
| Azure-IMDS | HTTP (80) | `169.254.169.254` | Managed identity tokens |
| Ubuntu-Repos | HTTP/HTTPS | `archive.ubuntu.com`, `security.ubuntu.com`, `*.launchpad.net` | Package manager |
| Python-PyPI | HTTPS (443) | `pypi.org`, `files.pythonhosted.org` | pip install for Azure SDK |

### Required Network Rules (non-HTTP)

| Rule Name | Protocol | Destination | Port | Purpose |
|-----------|----------|-------------|------|---------|
| Azure-Monitor | TCP | AzureMonitor service tag | 443 | Optional: Azure monitoring |
| NTP | UDP | * | 123 | Time synchronization |

### Route Table

If using forced tunneling, create a route table to send traffic to the firewall:

```bash
az network route-table create -g $RG --name hadoop-rt

az network route-table route create -g $RG \
  --route-table-name hadoop-rt \
  --name default-route \
  --address-prefix 0.0.0.0/0 \
  --next-hop-type VirtualAppliance \
  --next-hop-ip-address <firewall-private-ip>

# Associate with the subnet
az network vnet subnet update -g $RG \
  --vnet-name hadoop-vnet --name default \
  --route-table hadoop-rt
```

---

## Proxy Configuration

If outbound internet access goes through an HTTP proxy:

### Configure on All Cluster VMs

```bash
# /etc/environment (system-wide)
export HTTP_PROXY="http://proxy.corp.example.com:8080"
export HTTPS_PROXY="http://proxy.corp.example.com:8080"
export NO_PROXY="localhost,127.0.0.1,10.0.0.0/8,169.254.169.254,.dfs.core.windows.net,.blob.core.windows.net"
```

Critical: The `NO_PROXY` list must include:
- `169.254.169.254` -- Azure IMDS (managed identity token endpoint)
- Storage account FQDNs if using private endpoints
- The VNet CIDR for intra-cluster communication

### Configure for Azure SDK (Python)

The Azure SDK for Python respects `HTTPS_PROXY` environment variables. No additional configuration is needed if the system environment is set correctly.

### Configure for Hadoop

Add to `core-site.xml` via Ambari if HDFS needs the proxy for storage access (unusual -- only needed if not using private endpoints and the storage FQDN is not in NO_PROXY):

```xml
<property>
  <name>fs.azure.proxy.host</name>
  <value>proxy.corp.example.com</value>
</property>
<property>
  <name>fs.azure.proxy.port</name>
  <value>8080</value>
</property>
```
