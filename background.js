/**
 * KoalaFlyff — Background Service Worker
 *
 * Manages multi-boxing key routing, config persistence,
 * session history, and system logging.
 *
 * Key mappings are now a list: each entry has { keyA, keyB }
 * and all share the same global tabAId / tabBId.
 */

let config = {
  tabAId: null,
  tabBId: null,
  mappings: [{ keyA: 'c', keyB: '1' }],
  toggleKey: 'ö',
  enableLogs: false,
  isRunning: false
};

let sessionStartTime = null;
let systemLogs = [];

// ─── Logging ───────────────────────────────────────────────

const addLogEntry = (msg, ts = Date.now()) => {
  systemLogs.push({ time: ts, text: msg });
  if (systemLogs.length > 200) systemLogs.shift();
  chrome.storage.session.set({ systemLogs });
};

const LOG = (...args) => {
  if (!config.enableLogs) return;
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
  addLogEntry(`[Worker] ${message}`);
};

// ─── Badge ─────────────────────────────────────────────────

function updateBadge() {
  if (config.isRunning) {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
  } else {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  }
}

// ─── Config Persistence ────────────────────────────────────

function saveConfig() {
  chrome.storage.local.set({ multiBoxConfig: config });

  if (config.tabAId) {
    chrome.tabs.sendMessage(config.tabAId, { type: 'CONFIG_CHANGED', config }).catch(() => {});
  }
  if (config.tabBId) {
    chrome.tabs.sendMessage(config.tabBId, { type: 'CONFIG_CHANGED', config }).catch(() => {});
  }
  LOG("Config saved and broadcasted:", config);
}

// ─── Service Toggle ────────────────────────────────────────

function toggleService(newState) {
  LOG("toggleService called with state:", newState);
  if (config.isRunning === newState) {
    LOG("State already matches, ignoring.");
    return;
  }

  config.isRunning = newState;
  saveConfig();
  updateBadge();

  if (config.isRunning) {
    sessionStartTime = Date.now();
    chrome.storage.session.set({ sessionStartTime });
    LOG("Service Started. sessionStartTime recorded:", sessionStartTime);
  } else {
    LOG("Service Stopped. Calculating session duration...");
    if (sessionStartTime) {
      const sessionDuration = Date.now() - sessionStartTime;
      sessionStartTime = null;
      chrome.storage.session.remove('sessionStartTime');

      chrome.storage.local.get(['sessionHistory'], (result) => {
        const history = result.sessionHistory || [];
        history.unshift({
          start: Date.now() - sessionDuration,
          end: Date.now(),
          duration: sessionDuration
        });
        if (history.length > 50) history.length = 50;
        chrome.storage.local.set({ sessionHistory: history });
        LOG("Session saved. Duration:", sessionDuration, "ms");
      });
    }
  }
}

// ─── Initialization ────────────────────────────────────────

async function initialize() {
  const localData = await chrome.storage.local.get(['multiBoxConfig']);
  if (localData.multiBoxConfig) {
    config = { ...config, ...localData.multiBoxConfig };
    // Migrate old single-key config to mappings list
    if (!config.mappings) {
      config.mappings = [{
        keyA: config.keyA || 'c',
        keyB: config.keyB || '1'
      }];
      delete config.keyA;
      delete config.keyB;
    }
    LOG("Restored config from storage:", config);
  }

  const sessionData = await chrome.storage.session.get(['sessionStartTime', 'systemLogs']);
  if (sessionData.sessionStartTime) {
    sessionStartTime = sessionData.sessionStartTime;
    LOG("Restored sessionStartTime:", sessionStartTime);
  }
  if (sessionData.systemLogs && Array.isArray(sessionData.systemLogs)) {
    systemLogs = sessionData.systemLogs;
  }

  if (config.isRunning && !sessionStartTime) {
    LOG("Worker restarted but session start time lost. Stopping service.");
    config.isRunning = false;
    saveConfig();
  }

  updateBadge();
}

initialize();

// ─── Tab Removal Handler ───────────────────────────────────

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === config.tabAId || tabId === config.tabBId) {
    LOG("Configured tab removed (ID:", tabId, "). Disabling service.");
    if (config.isRunning) {
      toggleService(false);
    }
    if (tabId === config.tabAId) config.tabAId = null;
    if (tabId === config.tabBId) config.tabBId = null;
    saveConfig();
  }
});

// ─── Message Handler ───────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === 'ADD_LOG') {
    if (config.enableLogs) {
      addLogEntry(message.log, message.timestamp);
    }
    return false;
  }

  if (message.type === 'REQUEST_LOGS') {
    sendResponse(systemLogs);
    return false;
  }

  if (message.type === 'UPDATE_CONFIG') {
    LOG("Received UPDATE_CONFIG", message.payload);

    const requestedState = message.payload.isRunning;
    const newConfig = { ...message.payload };
    delete newConfig.isRunning;

    config = { ...config, ...newConfig };
    saveConfig();
    sendResponse({ status: 'success' });

    if (requestedState !== config.isRunning) {
      LOG("State mismatch found, triggering service toggle!");
      toggleService(requestedState);
    }
    return false;
  }

  if (message.type === 'REQUEST_CONFIG') {
    LOG("Received REQUEST_CONFIG. Sending back config block.");
    sendResponse({ ...config, sessionStartTime });
    return false;
  }

  if (message.type === 'TOGGLE_SERVICE_REQUEST') {
    LOG("Received TOGGLE_SERVICE_REQUEST hotkey ping.");
    toggleService(!config.isRunning);
    return false;
  }

  if (message.type === 'KEY_PRESSED') {
    if (!config.isRunning) return false;

    if (sender.tab && sender.tab.id === config.tabAId) {
      const pressedKey = message.key.toLowerCase();

      // Find all matching mappings and simulate the target key for each
      const matches = (config.mappings || []).filter(
        m => m.keyA.toLowerCase() === pressedKey
      );

      if (matches.length > 0 && config.tabBId) {
        matches.forEach(m => {
          LOG("Matched mapping:", m, "— routing key to Tab B.");
          chrome.tabs.sendMessage(config.tabBId, {
            type: 'SIMULATE_KEY',
            key: m.keyB
          }).catch(err => {
            LOG("Failed to send SIMULATE_KEY to Tab B:", err.message || err);
            toggleService(false);
          });
        });
      }
    }
    return false;
  }

  return false;
});
