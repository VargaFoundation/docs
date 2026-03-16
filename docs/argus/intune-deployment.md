---
id: intune-deployment
title: Deploying with Microsoft Intune
sidebar_position: 8
---

Argus can be deployed at scale on Windows endpoints using Microsoft Intune as a **Win32 app**. The driver is packaged as an `.intunewin` archive containing a signed NSIS installer and PowerShell lifecycle scripts.

## Prerequisites

- Microsoft Intune administrator access ([Intune admin center](https://intune.microsoft.com))
- [Microsoft Win32 Content Prep Tool](https://github.com/microsoft/Microsoft-Win32-Content-Prep-Tool) (`IntuneWinAppUtil.exe`) if you are packaging manually
- The signed `argus-odbc-installer.exe` (built via `makensis installer/argus-odbc.nsi`)
- Target devices: Windows 10 64-bit or later

:::tip Automated builds
The CI pipeline (`.github/workflows/release.yml`) generates the `.intunewin` package automatically on tagged releases and uploads it to GitHub Releases. You can skip the manual packaging step and download the artifact directly.
:::

## Packaging the .intunewin file

If you are packaging manually, stage the installer alongside the PowerShell scripts and run the content prep tool:

```powershell
# Create a staging directory
New-Item -ItemType Directory -Path installer\staging -Force

# Copy artifacts
Copy-Item build\argus-odbc-installer.exe installer\staging\
Copy-Item installer\intune\Install.ps1   installer\staging\
Copy-Item installer\intune\Detect.ps1    installer\staging\
Copy-Item installer\intune\Uninstall.ps1 installer\staging\

# Generate the .intunewin package
IntuneWinAppUtil.exe `
    -c installer\staging `
    -s argus-odbc-installer.exe `
    -o installer\output
```

The output file `installer\output\argus-odbc-installer.intunewin` is ready for upload to Intune.

## Configuring the app in Intune

### 1. Create a new Win32 app

In the [Intune admin center](https://intune.microsoft.com), navigate to **Apps > Windows > Add** and select **Windows app (Win32)**.

Upload `argus-odbc-installer.intunewin` as the app package file.

### 2. App information

| Field | Value |
|-------|-------|
| **Name** | Argus ODBC Driver |
| **Description** | Universal ODBC driver for Hive, Impala, Trino, Phoenix, and Kudu |
| **Publisher** | Varga Foundation |
| **App version** | Match the release version (e.g. `0.2.0`) |
| **Category** | Business / Productivity |

### 3. Program settings

| Field | Value |
|-------|-------|
| **Install command** | `powershell.exe -ExecutionPolicy Bypass -File Install.ps1` |
| **Uninstall command** | `powershell.exe -ExecutionPolicy Bypass -File Uninstall.ps1` |
| **Install behavior** | **System** |
| **Device restart behavior** | No specific action |

The install runs under the SYSTEM account with administrator privileges, which is required for ODBC driver registration in `HKLM`.

### 4. Requirements

| Field | Value |
|-------|-------|
| **Operating system architecture** | 64-bit |
| **Minimum operating system** | Windows 10 1607 |

### 5. Detection rules

Select **Use a custom detection script** and upload `Detect.ps1`.

The detection script checks two conditions:
1. The registry key `HKLM:\SOFTWARE\ODBC\ODBCINST.INI\Argus ODBC Driver` exists
2. The `Driver` value points to an existing `argus_odbc.dll` file on disk

If both conditions are met, the script writes to stdout and exits `0` (detected). Otherwise it exits silently with `0` (not detected).

### 6. Return codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Failed |
| `3010` | Soft reboot required |

### 7. Assignments

Assign the app to the appropriate **device groups** or **user groups**. Use:
- **Required** for mandatory deployments across the organization
- **Available for enrolled devices** to let users install on demand from the Company Portal

## What the installer does

The NSIS installer (`argus-odbc-installer.exe /S`) performs the following in silent mode:

1. Copies `argus_odbc.dll` and bundled dependencies to `C:\Program Files\Argus ODBC Driver\`
2. Registers the ODBC driver in the 64-bit registry:
   ```
   HKLM:\SOFTWARE\ODBC\ODBCINST.INI\Argus ODBC Driver
       Driver      = C:\Program Files\Argus ODBC Driver\argus_odbc.dll
       Setup       = C:\Program Files\Argus ODBC Driver\argus_odbc.dll
       Description = Argus ODBC Driver for Hive, Impala, Trino, Phoenix, and Kudu
       CompanyName = Varga Foundation
       UsageCount  = 1
   ```
3. Adds the driver to `HKLM:\SOFTWARE\ODBC\ODBCINST.INI\ODBC Drivers`
4. Creates Start Menu shortcuts (ODBC Data Source Administrator, Uninstaller)
5. Registers in Add/Remove Programs for standard uninstallation
6. Stores the install directory in `HKLM:\Software\Argus ODBC Driver\InstallDir`

## Testing locally

Before uploading to Intune, validate the scripts on a test machine:

```powershell
# Install
powershell.exe -ExecutionPolicy Bypass -File installer\intune\Install.ps1

# Verify driver appears in ODBC Data Source Administrator
odbcad32.exe

# Detect (should print "Argus ODBC Driver detected")
powershell.exe -ExecutionPolicy Bypass -File installer\intune\Detect.ps1

# Uninstall
powershell.exe -ExecutionPolicy Bypass -File installer\intune\Uninstall.ps1
```

## Post-deployment DSN configuration

Once the driver is installed on endpoints, DSNs can be configured in several ways:

### Via Group Policy (registry preferences)

Push a System DSN to all target machines via GPO registry preferences targeting:

```
HKLM:\SOFTWARE\ODBC\ODBC.INI\<DSN Name>
    Driver   = Argus ODBC Driver
    HOST     = <backend-host>
    PORT     = <backend-port>
    BACKEND  = <hive|impala|trino|phoenix|kudu>
    DATABASE = <default-database>
```

And add the DSN name to:

```
HKLM:\SOFTWARE\ODBC\ODBC.INI\ODBC Data Sources
    <DSN Name> = Argus ODBC Driver
```

### Via PowerShell remediation script

Deploy a [Proactive Remediation](https://learn.microsoft.com/en-us/mem/intune/fundamentals/remediations) script through Intune to configure DSNs programmatically:

```powershell
# Example: create a system DSN for Trino
$dsnName = "Trino Production"
$dsnPath = "HKLM:\SOFTWARE\ODBC\ODBC.INI\$dsnName"

New-Item -Path $dsnPath -Force | Out-Null
Set-ItemProperty -Path $dsnPath -Name "Driver"   -Value "C:\Program Files\Argus ODBC Driver\argus_odbc.dll"
Set-ItemProperty -Path $dsnPath -Name "HOST"      -Value "trino.example.com"
Set-ItemProperty -Path $dsnPath -Name "PORT"      -Value "8443"
Set-ItemProperty -Path $dsnPath -Name "BACKEND"   -Value "trino"
Set-ItemProperty -Path $dsnPath -Name "DATABASE"  -Value "analytics"
Set-ItemProperty -Path $dsnPath -Name "SSL"       -Value "1"

# Register the DSN
$dsPath = "HKLM:\SOFTWARE\ODBC\ODBC.INI\ODBC Data Sources"
Set-ItemProperty -Path $dsPath -Name $dsnName -Value "Argus ODBC Driver"
```

## Monitoring deployment

Track the rollout in the Intune admin center under **Apps > Monitor > App install status**. Devices will report one of:

- **Installed** — Detection script confirmed the driver is present
- **Failed** — Install script returned exit code `1`
- **Pending** — Waiting for device check-in
- **Not applicable** — Device does not meet requirements (e.g. 32-bit OS)

For troubleshooting failed deployments on a device, check the Intune Management Extension logs:

```
C:\ProgramData\Microsoft\IntuneManagementExtension\Logs\IntuneManagementExtension.log
```

## Updating the driver

To push a new version:

1. Build and package the new `.intunewin` file
2. In the Intune admin center, edit the existing **Argus ODBC Driver** app
3. Upload the new package file under **App package file**
4. Update the **App version** field
5. Save — Intune will reinstall on devices where the detection script no longer matches

The NSIS installer overwrites the previous DLL in-place, so no separate uninstall step is needed for upgrades.
