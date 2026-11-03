# Security Architecture & API Key Governance — Nano Banana Atelier Studio 🍌✦

This document defines the security architecture, credential governance model, and data sovereignty guarantees enforced across **Nano Banana Atelier Studio**.

---

## 1. Foundational Security Invariant: Zero-Storage Policy

The paramount security requirement of Nano Banana Studio is complete user ownership and sovereignty over their **Google AI Studio API Key (`AIza...`)**:

```mermaid
flowchart TD
    subgraph BrowserSpace["User Browser / Tauri Native WebView"]
        Input["User types Google Gemini API Key"]
        RAMState["Volatile React State (useState)\nHeld ONLY in component RAM"]
        ClearAction["'Clear from RAM' Action / Window Close\nWipes Key Immediately"]
    end

    subgraph DirectCall["Direct Client-to-Google HTTPS"]
        GoogleAPI["Google AI Studio API\n(generativelanguage.googleapis.com)"]
    end

    subgraph ForbiddenStores["Forbidden Credential Locations (ZERO-STORAGE)"]
        NoCookies["❌ Cookies"]
        NoLocalStorage["❌ LocalStorage / SessionStorage"]
        NoRemoteServer["❌ Remote Backend Servers / Proxies"]
        NoLogging["❌ Application Log Files"]
    end

    Input --> RAMState
    RAMState -->|Direct HTTPS Request| GoogleAPI
    RAMState -.->|Explicit User Consent ONLY| Vault[("Local SQLite app_vault\n(Desktop Workstation Disk)")]
    ClearAction -.->|Wipes| RAMState

    RAMState x.-.x NoCookies
    RAMState x.-.x NoLocalStorage
    RAMState x.-.x NoRemoteServer
    RAMState x.-.x NoLogging
```

---

## 2. Credential Isolation Modes

### Mode 1: Volatile RAM Isolation (Default)
- **Component RAM**: When entered in the Studio header, the API key is passed into `StudioSessionContext` and held exclusively in React `useState`.
- **Zero Browser Storage**: The key is never written to `localStorage`, `sessionStorage`, `IndexedDB`, or cookies.
- **Immediate Erasure**:
  - Closing the desktop window or refreshing the browser tab purges the key instantly.
  - Clicking **"Clear from RAM"** in the UI resets component state to empty string immediately.

### Mode 2: Local Desktop App Vault (Opt-In Convenience)
- Desktop creators who prefer not to re-enter their API key upon every application launch can check **"Remember in Local App Vault"** in the **⚙ Config** modal.
- This stores the key in the local SQLite table:
  ```sql
  INSERT OR REPLACE INTO app_vault (key, value, updated_at)
  VALUES ('gemini_api_key', 'AIza...', datetime('now'));
  ```
- **Local Isolation**: The database file (`nanobanana.sqlite3`) resides exclusively in the user's local operating system profile directory (`~/.local/share/com.nanobanana.studio/nanobanana.sqlite3`). It is never uploaded to any remote server or third-party service.
- **1-Click Revocation**: Clicking **"Purge Saved Key"** executes `DELETE FROM app_vault WHERE key = 'gemini_api_key'`.

---

## 3. Direct Client-to-Google Execution

Image generation and prompt analysis calls do not route through any intermediary proxy or proxy server:

1. **Direct Endpoint**: Requests are sent directly from the client WebView to:
   ```text
   https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent
   ```
2. **Header Injection**: The API key is passed as an HTTP header:
   ```typescript
   headers: {
     "Content-Type": "application/json",
     "x-goog-api-key": apiKey,
   }
   ```
3. **No-Store Caching**: All client requests set `cache: "no-store"` to prevent browsers and WebViews from caching base64 payloads or request bodies in local disk caches.

---

## 4. Local Data Privacy & Telemetry Refusal

- **Zero Analytics**: The application includes no third-party telemetry, tracking pixels, or usage reporting scripts.
- **Local Image Ownership**: All generated image files (`.png`) are stored directly on the user's disk (`~/Pictures/nanobanana/<project-name>/`).
- **Offline Inspection**: The entire prompt history, variant JSON, and parameters can be inspected offline via standard SQLite tools (`sqlite3 ~/.local/share/com.nanobanana.studio/nanobanana.sqlite3`).
