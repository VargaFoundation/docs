---
id: installation-deployment
title: Installation and deployment
sidebar_position: 4
---

## Installing dependencies

### Ubuntu/Debian

```bash
sudo apt-get install -y \
    build-essential cmake pkg-config \
    unixodbc-dev libglib2.0-dev \
    libthrift-c-glib-dev thrift-compiler \
    libcurl4-openssl-dev libjson-glib-dev \
    libssl-dev libcmocka-dev
```

### Fedora/RHEL

```bash
sudo dnf install -y \
    gcc cmake pkgconfig \
    unixODBC-devel glib2-devel \
    thrift-devel libcurl-devel \
    json-glib-devel libcmocka-devel
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
    mingw-w64-ucrt-x86_64-pkg-config \
    mingw-w64-ucrt-x86_64-glib2 \
    mingw-w64-ucrt-x86_64-thrift \
    mingw-w64-ucrt-x86_64-curl \
    mingw-w64-ucrt-x86_64-json-glib \
    mingw-w64-ucrt-x86_64-cmocka
```

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
| `CMAKE_BUILD_TYPE` | Release | Debug or Release |

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

### Linux/macOS

```bash
cd build && sudo make install
```

Installs `libargus_odbc.so` to `<prefix>/lib/` and headers to `<prefix>/include/argus/`.

### Windows

Build the DLL, then use the NSIS installer:

```bash
makensis installer/argus-odbc.nsi
```

## Verifying

```bash
nm -D build/libargus_odbc.so | grep SQL
```

Should show `SQLAllocHandle`, `SQLConnect`, `SQLDriverConnect`, `SQLExecDirect`, etc.
