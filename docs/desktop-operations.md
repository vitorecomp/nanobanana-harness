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
### OS Bundle Packaging (`"targets": "all"`):
- **Windows (`x64` & `x86` 32-bit)**: `.exe` (NSIS installer) and `.msi` (WiX installer) in `src-tauri/target/<triple>/release/bundle/nsis/` and `msi/`.
- **Linux (`x86_64`)**: `.deb` (Debian/Ubuntu), `.AppImage` (Portable AppImage), and `.rpm` (Fedora/RHEL/openSUSE) in `src-tauri/target/<triple>/release/bundle/`.
- **macOS (`aarch64` Apple Silicon & `x86_64` Intel)**: `.dmg` disk image and `.app` bundle in `src-tauri/target/<triple>/release/bundle/`.
- **Dev / Debug Desktop Builds**: Run `npm run tauri:build:debug` locally (or trigger `build_profile: dev` in GitHub Actions) to produce unstripped debug bundles in `src-tauri/target/<triple>/debug/bundle/`.

---

## 5. Continuous Integration & Release Automation

Two GitHub Actions workflows automate verification and cross-platform installer builds:

1. **Continuous Integration (`.github/workflows/ci.yml`)**:
   - Runs on every `push` and `pull_request` to `main`/`master`/`develop`.
   - Verifies TypeScript compilation (`npm run typecheck`), builds the Next.js static export (`npm run build:tauri-web`), uploads the `nanobanana-web-static-dev` artifact, and runs `cargo check --manifest-path src-tauri/Cargo.toml` against WebKit2GTK 4.1 headers.
2. **Cross-Platform Release & Dev Installers (`.github/workflows/release.yml`)**:
   - Triggers automatically on semantic version tags (`v*`, e.g., `v1.0.0`) to publish a full GitHub Release, **or** manually via `workflow_dispatch` (`build_profile: release | dev`) to produce downloadable installer/debug artifacts without creating a tag.
   - Builds across **5 target architectures**:
     - `ubuntu-22.04` (`x86_64-unknown-linux-gnu`) $\rightarrow$ **`.deb`**, **`.AppImage`**, **`.rpm`**, + `nanobanana-studio-web-<tag>.tar.gz`
     - `windows-latest` (`x86_64-pc-windows-msvc`) $\rightarrow$ **Windows 64-bit `.exe` (NSIS) & `.msi` (WiX)**
     - `windows-latest` (`i686-pc-windows-msvc`) $\rightarrow$ **Windows 32-bit x86 `.exe` (NSIS) & `.msi` (WiX)**
     - `macos-latest` (`aarch64-apple-darwin`) $\rightarrow$ **macOS Apple Silicon `.dmg` & `.app.tar.gz`**
     - `macos-latest` (`x86_64-apple-darwin`) $\rightarrow$ **macOS Intel `.dmg` & `.app.tar.gz`**

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
