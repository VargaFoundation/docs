---
id: installation
title: Installation
sidebar_position: 2
---

## Prerequisites

- **Apache Ambari** 2.7+ with an active cluster
- **Python 3.6+** on all cluster nodes
- **pip** (Python package manager)
- Root or sudo access on the Ambari Server host

## Download the Mpack

Download the latest mpack archive from the [GitHub Releases](https://github.com/VargaFoundation/supportcollector/releases) page:

```bash
curl -LO https://github.com/VargaFoundation/supportcollector/releases/latest/download/odpsc-mpack-2.0.tar.gz
```

Alternatively, you can build the mpack from source:

```bash
git clone https://github.com/VargaFoundation/supportcollector.git
cd supportcollector
bash build_mpack.sh
# Output: build/odpsc-mpack-2.0.tar.gz
```

### Build Requirements

- Python 3.6+ (for syntax validation)
- Bash
- tar

## Install the Mpack

On the Ambari Server host, run:

```bash
ambari-server install-mpack --mpack=odpsc-mpack-2.0.tar.gz --verbose
```

Restart Ambari Server to apply:

```bash
ambari-server restart
```

## Deploy the Service

1. Open the **Ambari Web UI**
2. Navigate to **Actions** → **Add Service**
3. Select **ODP Support Collector** from the list
4. Follow the installation wizard:
   - **ODPSC Master**: Assign to one master node (cardinality: 1)
   - **ODPSC Agent**: Assign to all cluster nodes (cardinality: ALL)
5. Configure the service parameters (see [Configuration](./configuration.md))
6. Complete the wizard and start the service

## Verify Installation

After deployment, verify that the service is running:

```bash
# Check master status
curl -u admin:admin http://<master-host>:8085/api/v2/status
```

Expected response:

```json
{
  "status": "running",
  "version": "2.1",
  "collection_enabled": true,
  "bundle_count": 0
}
```

## Upgrade

To upgrade an existing mpack:

```bash
ambari-server upgrade-mpack --mpack=odpsc-mpack-2.0.tar.gz --verbose
ambari-server restart
```

Then restart the ODPSC service from the Ambari UI.

## Uninstall

1. Stop and delete the ODPSC service from Ambari UI
2. Remove the mpack:
   ```bash
   ambari-server uninstall-mpack --mpack-name=odpsc-mpack
   ambari-server restart
   ```
