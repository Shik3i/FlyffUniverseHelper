/**
 * KoalaFlyff — Content Script
 *
 * Captures keystrokes on Flyff Universe tabs and relays them
 * to the background service worker for multi-box routing.
 * Also handles simulated key presses on the target tab.
 */

let enableLogs = false;

const LOG = (...args) => {
  if (enableLogs) {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
    chrome.runtime.sendMessage({
      type: 'ADD_LOG',
      log: `[Content] ${msg}`,
      timestamp: Date.now()
    }).catch(() => {});
  }
};

let isActive = false;
let currentToggleKey = 'ö';
// All keyA values we should intercept — kept in sync with mappings
let watchedKeys = new Set();

// ─── Initial Config Fetch ──────────────────────────────────

try {
  chrome.runtime.sendMessage({ type: 'REQUEST_CONFIG' }, (config) => {
    if (chrome.runtime.lastError) {
      console.error('Failed to fetch initial config:', chrome.runtime.lastError);
      return;
    }
    if (!config) return;

    isActive = config.isRunning;
    currentToggleKey = (config.toggleKey || '').toLowerCase();
    if (config.enableLogs !== undefined) enableLogs = config.enableLogs;
    rebuildWatchedKeys(config.mappings);

    LOG('Initialized Config:', { isActive, currentToggleKey, watchedKeys: [...watchedKeys] });
  });
} catch (e) {
  // Extension context invalidated — silently ignore
}

function rebuildWatchedKeys(mappings) {
  watchedKeys = new Set((mappings || []).map(m => m.keyA.toLowerCase()));
}

// ─── Message Listener ──────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CONFIG_CHANGED') {
    isActive = message.config.isRunning;
    currentToggleKey = (message.config.toggleKey || '').toLowerCase();
    if (message.config.enableLogs !== undefined) enableLogs = message.config.enableLogs;
    rebuildWatchedKeys(message.config.mappings);

    LOG('CONFIG_CHANGED received:', { isActive, currentToggleKey, watchedKeys: [...watchedKeys] });
  } else if (message.type === 'SIMULATE_KEY') {
    simulateKeyPress(message.key);
  }
});

// ─── Keystroke Capture ─────────────────────────────────────

window.addEventListener('keydown', (e) => {
  // Skip programmatically generated/simulated keys to prevent feedback loops
  if (!e.isTrusted) return;

  // Skip if user is typing in a text field
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

  const pressedKey = e.key.toLowerCase();

  // Handle toggle hotkey
  if (currentToggleKey && pressedKey === currentToggleKey) {
    e.preventDefault();
    e.stopPropagation();
    LOG('Service Toggle Hotkey caught!');
    try {
      chrome.runtime.sendMessage({ type: 'TOGGLE_SERVICE_REQUEST' });
    } catch (err) {
      // Extension context invalidated
    }
    return;
  }

  // Relay any key that matches one of the watched mappings
  if (isActive && watchedKeys.has(pressedKey)) {
    LOG('Watched key caught! Relaying to background.', pressedKey);
    try {
      chrome.runtime.sendMessage({ type: 'KEY_PRESSED', key: pressedKey });
    } catch (err) {
      // Extension context invalidated
    }
  }
}, true); // Capture phase

// ─── Key Simulation ────────────────────────────────────────

function simulateKeyPress(keyChar) {
  if (!keyChar) return;

  const canvas = document.querySelector('canvas') || document.body;
  const upperChar = keyChar.toUpperCase();
  
  // Handle special keys with proper key codes
  let keyCode;
  let code;
  
  if (keyChar.length > 1) {
    // Special keys (F1, Enter, Escape, etc.)
    code = keyChar;
    const specialKeyCodes = {
      'Enter': 13,
      'Escape': 27,
      'Space': 32,
      'ArrowUp': 38,
      'ArrowDown': 40,
      'ArrowLeft': 37,
      'ArrowRight': 39,
      'F1': 112, 'F2': 113, 'F3': 114, 'F4': 115, 'F5': 116,
      'F6': 117, 'F7': 118, 'F8': 119, 'F9': 120, 'F10': 121,
      'F11': 122, 'F12': 123,
      'Tab': 9,
      'Backspace': 8,
      'Delete': 46,
      'Insert': 45,
      'Home': 36,
      'End': 35,
      'PageUp': 33,
      'PageDown': 34
    };
    keyCode = specialKeyCodes[keyChar] || keyChar.charCodeAt(0);
  } else if (/^[0-9]$/.test(keyChar)) {
    // Digit keys
    code = `Digit${keyChar}`;
    keyCode = keyChar.charCodeAt(0);
  } else if (keyChar === ' ') {
    // Space
    code = 'Space';
    keyCode = 32;
  } else {
    // Letter keys
    code = `Key${upperChar}`;
    keyCode = upperChar.charCodeAt(0);
  }

  const baseProps = {
    key: keyChar,
    code: code,
    keyCode: keyCode,
    which: keyCode,
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window
  };

  // Network/Reaction latency simulation (5ms - 15ms)
  const reactionDelay = Math.floor(Math.random() * 11) + 5;

  setTimeout(() => {
    LOG(`Dispatching KEYDOWN for "${keyChar}"`);
    canvas.dispatchEvent(new KeyboardEvent('keydown', baseProps));

    // Variable keystroke hold duration (30ms - 60ms)
    const holdDuration = Math.floor(Math.random() * 31) + 30;

    setTimeout(() => {
      LOG(`Dispatching KEYUP for "${keyChar}"`);
      canvas.dispatchEvent(new KeyboardEvent('keyup', baseProps));
    }, holdDuration);

  }, reactionDelay);
}
