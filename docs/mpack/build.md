---
id: build
title: Building the Mpack
sidebar_position: 2
---

The Varga Mpack is built using a provided script that compiles the source code for Kirka and Tarn and bundles them into a single archive.

## Prerequisites

- **Java JDK 8 or 11**
- **Maven** (the project uses `./mvnw` wrappers)
- **Git**
- **Bash environment**

## Build Procedure

1.  Navigate to the `mpack/build` directory:
    ```bash
    cd mpack/build
    ```

2.  Run the build script:
    ```bash
    ./build_mpack.sh
    ```

## What the script does

The `build_mpack.sh` script automates the following steps:
1.  **Clones or updates** the Kirka and Tarn repositories.
2.  **Compiles** both projects using Maven (`clean package`).
3.  **Prepares** the Mpack structure by creating the necessary directories.
4.  **Copies** the generated JAR files into the Mpack package folders.
5.  **Bundles** everything into a `.tar.gz` archive.

## Output

The generated Mpack archive will be located in:
`mpack/build/target/varga-mpack-1.0.0.0.tar.gz`
