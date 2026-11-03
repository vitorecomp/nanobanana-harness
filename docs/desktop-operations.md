# Desktop Operations & Packaging Guide — Nano Banana Atelier Studio 🍌✦

This document provides a comprehensive operational guide for developing, building, and distributing the **Nano Banana Atelier Studio** native desktop application powered by **Tauri v2** and **Next.js 15 / React 19**.

---

## 1. Architecture Overview

Nano Banana Studio operates as a desktop application with a lightweight native shell:

- **Frontend WebView**: Next.js 15 static export (`output: "export"`, placed into `frontend/out`) rendered inside the OS native WebView (WebKitGTK on Linux, WebKit on macOS, WebView2 on Windows).
- **Native Rust Core (`src-tauri/`)**: Tauri v2 orchestrator managing local SQLite persistence via `rusqlite`, native filesystem storage (`~/Pictures/nanobanana/`), and window control protocols.
- **Universal Bridge (`frontend/src/core/tauri/tauriBridge.ts`)**: Automatically switches between Tauri IPC invocation (`@tauri-apps/api/core`) in the desktop window and the Next.js SQLite dev route (`/api/db`) during standalone browser development.

---

## 2. System Prerequisites

### Linux (Debian / Ubuntu / Devuan)
Install the Rust toolchain, Node.js 22+, and the WebKitGTK 4.1 development libraries:

```bash
# 1. Rust Toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# 2. System Libraries (WebKit2GTK 4.1, AppIndicator, SSL, XDO)
sudo apt-get update && sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

### macOS
- Xcode Command Line Tools (`xcode-select --install`).
- Node.js 22+ (`brew install node@22`).
- Rust toolchain (`rustup`).

### Windows
- Visual Studio Build Tools (C++ development workload).
- WebView2 Runtime (pre-installed on Windows 10/11).
- Rust toolchain (`rustup-init.exe` targeting `x86_64-pc-windows-msvc`).

---

## 3. Development Workflows

### Mode A: Standalone Browser Dev (`http://localhost:8080`)
Ideal for rapid UI styling, component testing, and design system iteration:

```bash
cd nanobanana-inspiration
npm --prefix frontend install
npm run dev
```

- Spawns the Next.js dev server on port `8080`.
- Emulates Tauri IPC commands via built-in Node 22 SQLite routes (`/api/db`) and image streaming (`/api/image`).
- Live hot-reloading active.

### Mode B: Native Tauri Desktop Dev Window
Launches the native operating system desktop window:

```bash
cd nanobanana-inspiration
npm run tauri:dev
```

- Compiles `src-tauri` in debug mode.
- Launches the native window connected directly to the live frontend development server.
- Supports native OS window controls, system tray, and native dialogs.

---

## 4. Production Packaging & Distribution

To compile production-ready native installers for your operating system:

```bash
cd nanobanana-inspiration
npm run tauri:build
```

### Build Pipeline Stages:
1. **Frontend Static Bundle**: Executes `node frontend/scripts/build-tauri.mjs`, temporarily stashing dynamic API routes, running `npx next build`, and outputting static assets to `frontend/out`.
2. **Cargo Release Compilation**: Compiles `src-tauri` with optimizations (`lto = true`, `opt-level = 3`, `strip = true`).
3. **OS Bundle Packaging**: Bundles the executable with application icons and desktop files:
   - **Linux**: `.deb` installer and `.AppImage` bundle in `src-tauri/target/release/bundle/deb/` and `src-tauri/target/release/bundle/appimage/`.
   - **macOS**: `.dmg` disk image and `.app` bundle in `src-tauri/target/release/bundle/dmg/` and `src-tauri/target/release/bundle/macos/`.
   - **Windows**: `.msi` and `.exe` (NSIS) installers in `src-tauri/target/release/bundle/msi/` and `src-tauri/target/release/bundle/nsis/`.

---

## 5. Continuous Integration & Release Automation

A GitHub Actions workflow (`.github/workflows/release.yml`) automatically builds and publishes cross-platform desktop releases on every git tag:

```yaml
on:
  push:
    tags:
      - "v*"
```

The workflow matrix builds across:
- `ubuntu-22.04` (outputs `.deb` and `.AppImage`)
- `macos-latest` (outputs `.dmg`)
- `windows-latest` (outputs `.msi` and `.exe`)

---

## 6. Troubleshooting

### 1. `failed to open icon .../icons/icon.png: No such file or directory`
Generate missing desktop icons using Tauri's icon generator:
```bash
npx @tauri-apps/cli icon src-tauri/icons/icon.png
```

### 2. `failed to get cargo metadata: No such file or directory`
Ensure cargo is installed and available in `$PATH`:
```bash
export PATH="$HOME/.cargo/bin:$PATH"
cargo --version
```

### 3. Missing WebKit2GTK Headers on Linux
Verify `libwebkit2gtk-4.1-dev` is installed. If using an older Debian/Ubuntu, replace with `libwebkit2gtk-4.0-dev` and adjust `src-tauri/Cargo.toml`.
