---
id: troubleshooting
title: Troubleshooting
sidebar_position: 11
---

## Common Issues

### Connection to HBase/ZK fails

- Check `hbase.zookeeper.quorum` config.
- Verify network reachability.
- Logs: look for ZK session errors.

### HDFS write denied

- Kerberos: validate principal/keytab.
- Permissions: service user ACL on artifact dir.

### MLflow client 404/500

- Verify supported endpoints (see [Compatibility](./compatibility.md)).
- Enable DEBUG logging.

### Knox proxy issues

- Service/role name match.
- Knox logs for rewrite errors.

## Debug Tips

- Set `logging.level.root=DEBUG`.
- Test HBase shell connectivity.
- `curl` API endpoints directly.