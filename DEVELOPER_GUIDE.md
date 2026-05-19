# KoalaFlyff — Human Developer Guide

This document is the onboarding manual for developers working on the **KoalaFlyff** extension. It details how to set up the development environment, explains the architecture, and details our storage and communication protocols.

---

## 🚀 Setting Up Local Development

KoalaFlyff is a standard Chromium browser extension built with Vanilla JS, HTML, and CSS (Manifest V3). It requires no build step.

### Loading the Extension:
1. Open your Chromium-based browser (Chrome, Brave, Edge, Opera).
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle switch in the top right corner).
4. Click **Load unpacked** in the top left corner.
5. Select the root folder of this repository (the folder containing `manifest.json`).

### Debugging the Components:
- **The Popup Panel:** Right-click the extension icon in the toolbar, select **Inspect popup**, and use the standard DevTools console/inspector.
- **The Background Service Worker:** In `chrome://extensions/`, click the blue link `service worker` under KoalaFlyff to open the dedicated background console.
- **The Content Scripts:** Open the game page (`*.flyff.com`), open standard DevTools (`F12`), and look under the Console tab. Ensure you filter context by selecting `KoalaFlyff` in the console frame dropdown if you wish to run script-specific queries.

---

## 💾 Storage Architecture

We split storage between durable parameters and transient runtime variables:

| Storage Type | Key | Scope | Content Description |
| :--- | :--- | :--- | :--- |
| `chrome.storage.local` | `multiBoxConfig` | Durable | Tab IDs, key mappings list, global hotkey, debug toggle. |
| `chrome.storage.local` | `sessionHistory` | Durable | History list containing play session start/end timestamps and durations (limit: 50). |
| `chrome.storage.session` | `sessionStartTime` | Transient | Start timestamp of the active session. Extracted to calculate duration on stop. |
| `chrome.storage.session` | `systemLogs` | Transient | Diagnostic log entries gathered across worker, popup, and content pages (limit: 200). |

*Note:* `chrome.storage.session` survives Service Worker suspension but is completely wiped clean when the browser session is terminated (browser close).

---

## 📞 Messaging Protocol Reference

All components communicate asynchronously using the custom message schemas detailed below.

### 1. `REQUEST_CONFIG`
- **Sender:** Content / Popup
- **Receiver:** Background Worker
- **Payload:** *None*
- **Response:** `{ tabAId, tabBId, mappings, toggleKey, enableLogs, isRunning, sessionStartTime }`
- **Purpose:** Fetches the restored global configuration from storage.

### 2. `UPDATE_CONFIG`
- **Sender:** Popup
- **Receiver:** Background Worker
- **Payload:** `{ payload: config }`
- **Response:** `{ status: "success" }`
- **Purpose:** Commits a config adjustment made in the UI, saves it to storage, and broadcasts `CONFIG_CHANGED` to active tabs.

### 3. `CONFIG_CHANGED`
- **Sender:** Background Worker
- **Receiver:** Content Script (Tab A and Tab B)
- **Payload:** `{ type: "CONFIG_CHANGED", config }`
- **Response:** *None*
- **Purpose:** Syncs running options (e.g. mapping list, logs status, toggle key) directly inside loaded game tabs.

### 4. `KEY_PRESSED`
- **Sender:** Content Script (Tab A / Listener)
- **Receiver:** Background Worker
- **Payload:** `{ type: "KEY_PRESSED", key: String }`
- **Response:** *None*
- **Purpose:** Informs the background worker that a watched key (e.g., `'c'`) was pressed on the main character tab.

### 5. `SIMULATE_KEY`
- **Sender:** Background Worker
- **Receiver:** Content Script (Tab B / Target)
- **Payload:** `{ type: "SIMULATE_KEY", key: String }`
- **Response:** *None*
- **Purpose:** Directs the target tab's script to simulate key interaction (e.g., `'1'`) on the WebGL canvas.

### 6. `ADD_LOG`
- **Sender:** Content / Popup
- **Receiver:** Background Worker
- **Payload:** `{ type: "ADD_LOG", log: String, timestamp: Number }`
- **Response:** *None*
- **Purpose:** Pipes a diagnostic event into the transient, shared system logs list.

### 7. `REQUEST_LOGS`
- **Sender:** Popup
- **Receiver:** Background Worker
- **Payload:** *None*
- **Response:** `Array<{ time: Number, text: String }>`
- **Purpose:** Pulls the active log list to populate the popup interface.

### 8. `TOGGLE_SERVICE_REQUEST`
- **Sender:** Content Script (Tab A)
- **Receiver:** Background Worker
- **Payload:** *None*
- **Response:** *None*
- **Purpose:** Dispatched when the global toggle hotkey (default: `'ö'`) is hit on the game tab to start/stop the service.

---

## ⌨️ Keystroke Simulation Nuances

WebGL canvases inside browser windows (such as Flyff Universe) ignore standard text input events. Keystrokes must be simulated by dispatching standard low-level browser `KeyboardEvent` instances onto the `<canvas>` element (or fallback to `document.body`).

To trigger reaction hooks inside the game engine, we emulate realistic human latency:
1. **Reaction Delay:** A random latency between **5ms and 15ms** before dispatching the `keydown` event.
2. **Hold Duration:** The synthetic key is held down for a random duration between **30ms and 60ms** before releasing it with the `keyup` event.

### Target Event Properties:
Simulated keyboard events must resemble real physical actions. The following fields must be defined:
```javascript
const baseProps = {
  key: keyChar,
  code: code,      // e.g. "KeyC", "Digit1", or "Space"
  keyCode: keyCode,
  which: keyCode,
  bubbles: true,
  cancelable: true,
  composed: true,
  view: window
};
```
