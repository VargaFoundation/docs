---
id: troubleshooting
title: Troubleshooting
sidebar_position: 6
---

## Common Issues

### Agent cannot connect to master

- Verify the master is running: `curl http://<master-host>:8085/api/v2/status`
- Check that port 8085 is open between agent and master nodes
- Verify the `api_key` is the same on master and agents
- Check agent logs: `/var/log/odpsc/agent.log`

### Bundles not being sent to support

- Verify `auto_send_enabled` is `true`
- Check that `support_endpoint` or `supportplane_endpoint` is configured
- Review master logs for HTTP errors: `/var/log/odpsc/master.log`
- Test connectivity to the support endpoint from the master node

### SupportPlane OTP validation fails

- OTPs expire after 10 minutes by default — generate a new one
- Ensure the `cluster_id` matches the one registered in SupportPlane
- Verify the `supportplane_endpoint` URL is correct (should end with `/api/v1/bundles/upload`)

### Bundle upload returns 429 (rate limited)

The master enforces a rate limit of 30 requests per 60 seconds per IP. This can happen if many agents restart simultaneously. The agents will automatically retry with exponential backoff.

### Collection returns empty bundles

- For L1: Verify `config_paths` patterns match existing files
- For L2: Ensure Ambari API is accessible from the agent (`ambari_server_url`)
- For L3: Check `log_paths` patterns and `log_retention_days`

### Build fails

- Ensure Python 3.6+ is installed
- Verify all required files are present in `odpsc-mpack/`
- Check for syntax errors: `python3 -m py_compile <file>`

## Log Locations

| Component | Log File |
|-----------|----------|
| ODPSC Master | `/var/log/odpsc/master.log` |
| ODPSC Agent | `/var/log/odpsc/agent.log` |
| Ambari Server | `/var/log/ambari-server/ambari-server.log` |

## Getting Help

If you encounter issues not covered here, please [open an issue](https://github.com/VargaFoundation/supportcollector/issues) on GitHub.
