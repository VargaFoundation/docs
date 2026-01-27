---
id: installation-deployment
title: Installation and deployment
sidebar_position: 4
---

## Building the project

```bash
mvn clean package
```

The resulting JAR will be located in the `target/` directory (`kirka-<version>.jar`).

## Running the application

Run with Maven:

```bash
mvn spring-boot:run
```

Or directly:

```bash
java -jar target/kirka-*.jar
```

## Production deployment

- Deploy as a systemd service or container (Docker/Kubernetes).
- Ensure JVM options: `-Xmx2g -XX:+UseG1GC` or similar.
- Use process manager (systemd, supervisord) for restarts.
- Expose via load balancer or Knox gateway (see [Examples](./examples.md)).