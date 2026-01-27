---
id: troubleshooting
title: Troubleshooting
sidebar_position: 7
---

## Common Issues

- **YARN containers fail to start**:
  - Verify Docker is whitelisted in `yarn-site.xml`.
  - Check Linux Container Executor configuration and permissions (`container-executor.cfg`).
  - Ensure the Triton image is allowed in Docker runtime settings.
  - Review YARN NodeManager logs for Docker launch errors.

- **Models fail to load**:
  - Confirm model repository path is accessible (HDFS permissions for copy mode).
  - For NFS: Verify mount is active on all NodeManagers (`df -h /mnt/hdfs`).
  - Check AM dashboard for load errors.

- **Ranger authorization failures**:
  - Ensure `triton` service definition is registered in Ranger Admin.
  - Verify policies grant `list`, `metadata`, `infer` permissions.
  - Confirm user identity propagation (Kerberos ticket or `X-TARN-User` header).
  - Enable `--ranger-audit` and check audit logs.

- **HAProxy updater not working**:
  - Socket permissions: `chmod 660 /var/run/haproxy.sock`, group `haproxy`.
  - Script token matches `--token`.
  - YARN CLI can discover AM (`yarn application -list`).

- **No GPU allocation**:
  - `yarn.io/gpu` defined in `resource-types.xml`.
  - NodeManagers report GPUs (`yarn node -list -showDetails`).
  - Scheduler uses `DominantResourceCalculator`.

## Diagnostics

- **AM Dashboard**: `http://<AM_HOST>:<AM_PORT>/dashboard` (token required).
- **Metrics**: `http://<AM_HOST>:<AM_PORT>/metrics?token=<TOKEN>`.
- **YARN UI**: Application logs and container status.
- **Triton Health**: `/v2/health/ready` on each container.