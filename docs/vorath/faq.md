---
id: faq
title: FAQ
sidebar_position: 9
---

Frequently asked questions:

Does the driver support ReadWriteMany (RWX)?

- Yes. HDFS is a distributed filesystem suitable for concurrent access. Ensure your application’s access patterns align with HDFS semantics.

Can I use this driver without dynamic provisioning?

- Yes, by creating static PVs that point to existing HDFS paths.

Which Kubernetes versions are supported?

- Recommended 1.26–1.30 (see “Compatibility”).

Can I encrypt data?

- Use HDFS at-rest encryption capabilities and TLS/SSL per your distribution for communication.

Is Kerberos mandatory?

- Not for unsecured HDFS, but strongly recommended in production. A keytab and a service principal are required when Kerberos is enabled. Manage keytabs and krb5.conf via Secrets.

How to diagnose a PVC stuck in Pending?

- Check the StorageClass, events (`kubectl describe pvc`), and logs of the csi-provisioner/controller.
