---
id: faq
title: FAQ
sidebar_position: 10
---

- **Does Kirka provide MLflow UI?** No, it is a headless tracking server. Use MLflow clients or integrate with custom UI.
- **What HBase tables does it use?** `mlflow_experiments`, `mlflow_runs`, `mlflow_metrics`, `mlflow_model_versions` etc. (auto-created).
- **Can I use S3 instead of HDFS?** Currently HDFS only.
- **Multi-tenancy?** Use HBase namespaces or separate instances.