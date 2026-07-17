---
id: installation-deployment
title: Installation and deployment
sidebar_position: 4
---

## Installing dependencies

Backends are enabled by **auto-detection** at CMake time: install only the libraries for the backends you need.

### Ubuntu/Debian

```bash
sudo apt-get install -y \
    build-essential cmake pkg-config \
    unixodbc-dev libglib2.0-dev \
    libssl-dev libcmocka-dev

# Hive/Impala (optional)
sudo apt-get install -y libthrift-c-glib-dev thrift-compiler

# Trino/Phoenix/Pinot/Druid/BigQuery (optional)
sudo apt-get install -y libcurl4-openssl-dev libjson-glib-dev

# MySQL-wire: StarRocks/Doris/ClickHouse (optional)
sudo apt-get install -y libmariadb-dev

# Flight SQL: Dremio/InfluxDB 3 (optional; Apache Arrow APT repo, GCC 14+)
sudo apt-get install -y libarrow-flight-sql-dev
```

### Fedora/RHEL

```bash
sudo dnf install -y \
    gcc cmake pkgconfig \
    unixODBC-devel glib2-devel \
    thrift-devel libcurl-devel \
    json-glib-devel mariadb-connector-c-devel libcmocka-devel
```

### macOS

```bash
brew install cmake unixodbc glib thrift cmocka pkg-config curl json-glib
```

### Windows (MSYS2/UCRT64)

```bash
pacman -S \
    mingw-w64-ucrt-x86_64-gcc \
    mingw-w64-ucrt-x86_64-cmake \
    mingw-w64-ucrt-x86_64-ninja \
    mingw-w64-ucrt-x86_64-pkgconf \
    mingw-w64-ucrt-x86_64-glib2 \
    mingw-w64-ucrt-x86_64-curl \
    mingw-w64-ucrt-x86_64-json-glib \
    mingw-w64-ucrt-x86_64-openssl \
    mingw-w64-ucrt-x86_64-glib-networking \
    mingw-w64-ucrt-x86_64-libmariadbclient \
    mingw-w64-ucrt-x86_64-thrift \
    mingw-w64-ucrt-x86_64-cmocka
```

MSYS2 ships the thrift **compiler** but not the c_glib **runtime**. Build the portable subset once, then point pkg-config at it:

```bash
bash scripts/build-thrift-c-glib.sh "$PWD/thrift-c-glib-prefix" 0.23.0
PKG_CONFIG_PATH="$PWD/thrift-c-glib-prefix/lib/pkgconfig" \
    cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
```

Hive/Impala then build on Windows (they use Argus's GIO socket transport, not thrift's POSIX sockets). `glib-networking` provides TLS for that transport; the installer bundles its module and the driver loads it automatically. Add `mingw-w64-ucrt-x86_64-nsis` to build the installer.

## Building

```bash
cmake -B build
cmake --build build
```

### CMake options

| Option | Default | Description |
|--------|---------|-------------|
| `BUILD_TESTING` | ON | Build unit tests |
| `BUILD_INTEGRATION_TESTS` | OFF | Build integration tests |
| `BUILD_SHARED_LIBS` | ON | Build shared library |
| `BUILD_ADBC` | ON | Build the Arrow ADBC driver (`libargus_adbc`) |
| `CMAKE_BUILD_TYPE` | Release | Debug or Release |
| `ARGUS_BUILD_THRIFT_BACKENDS` | auto | Hive + Impala (thrift_c_glib) |
| `ARGUS_BUILD_TRINO` / `_PHOENIX` / `_PINOT` / `_DRUID` / `_BIGQUERY` | auto | HTTP/JSON backends (libcurl + json-glib) |
| `ARGUS_BUILD_MYSQL` | auto | MySQL-wire backend (libmariadb) |
| `ARGUS_BUILD_FLIGHTSQL` | auto | Arrow Flight SQL backend (C++) |
| `ARGUS_BUILD_KUDU` | auto | Kudu backend (deprecated) |

The `ARGUS_BUILD_*` options default to whatever the dependency detection finds; the CMake output lists which backends are enabled.

### Debug build

```bash
cmake -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build
```

## Running tests

### Unit tests

```bash
cd build
ctest --output-on-failure -L unit
```

### Integration tests

```bash
docker compose -f tests/integration/docker-compose.yml up -d
ctest -L integration --output-on-failure
docker compose -f tests/integration/docker-compose.yml down
```

## Installation

### Linux — .deb package

Tagged releases attach a `.deb` to [GitHub Releases](https://github.com/VargaFoundation/argus/releases). Its runtime dependencies are derived automatically from the built library (`dpkg-shlibdeps`), so `apt install ./argus-odbc_*.deb` pulls what the enabled backends need. The package registers the driver with unixODBC.

### Linux/macOS — from source

```bash
cd build && sudo make install
```

Installs `libargus_odbc.so` (and `libargus_adbc.so` when `BUILD_ADBC` is on) to `<prefix>/lib/` and headers to `<prefix>/include/argus/`.

:::note unixODBC
Using the driver through the unixODBC Driver Manager (isql, BI tools) requires **v0.5.8 or later** — earlier builds failed with `IM005` under the DM. See [Troubleshooting](./troubleshooting.md).
:::

### Windows

Use the NSIS installer from [GitHub Releases](https://github.com/VargaFoundation/argus/releases) (or build it: `makensis installer/argus-odbc.nsi`). It registers `Argus ODBC Driver`, bundles the dependency DLLs and the glib-networking TLS module, and ships **eight backends**: Hive, Impala, Trino, Phoenix, Pinot, Druid, BigQuery and MySQL-wire. Flight SQL and Kudu need dependencies MSYS2 does not provide.

For fleet deployment, see [Deploying with Microsoft Intune](./intune-deployment.md).

## BI connectors

Tagged releases also attach the **Power BI connector** (`Argus.mez`, plus a signed `Argus.pqx` when a certificate is configured) and the **Tableau connectors** (`argus-*.taco`). They sit on top of the installed driver — install the driver first. See [BI tools](./bi-tools.md).

## Verifying

```bash
nm -D build/libargus_odbc.so | grep SQL
```

Should show `SQLAllocHandle`, `SQLConnect`, `SQLDriverConnect`, `SQLExecDirect`, etc.
