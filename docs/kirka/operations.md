---
id: operations
title: Operations
sidebar_position: 9
---

## Health Checks

Kirka exposes Spring Boot Actuator endpoints (if enabled):
- `/actuator/health`
- `/actuator/info`

## Logging

Configure logback.xml or properties for levels:
```
logging.level.varga.kirka=DEBUG
```

Tail logs:
```bash
tail -f logs/kirka.log
```

## Scaling

- Vertical: increase JVM heap/CPU.
- Horizontal: stateless, run multiple instances behind load balancer.
- Database: HBase scales horizontally.

## Monitoring

- Metrics: integrate with Prometheus (expose /actuator/prometheus).
- Alerts: HBase connection errors, HDFS write failures, high metric ingestion latency.

## Upgrades

- Build new JAR, deploy with zero-downtime (blue-green).
- Backup HBase tables and HDFS artifacts before major changes.