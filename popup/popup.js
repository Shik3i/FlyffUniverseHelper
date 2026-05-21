/**
 * KoalaFlyff — Popup Script
 *
 * Controls the extension popup UI: tab selection, key mappings list,
 * service toggle, session history, and system logs.
 */

const MAX_MAPPINGS = 10;

let currentConfig = {
  enableLogs: false,
  mappings: [{ keyA: 'c', keyB: '1' }]
};

const LOG = (...args) => {
  if (currentConfig && currentConfig.enableLogs) {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
    chrome.runtime.sendMessage({
      type: 'ADD_LOG',
      log: `[Popup] ${msg}`,
      timestamp: Date.now()
    }).catch(() => {});
  }
};

// ─── Utility: Debounce ─────────────────────────────────────

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ─── Main ──────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const tabASelect         = document.getElementById('tabASelect');
  const tabBSelect         = document.getElementById('tabBSelect');
  const toggleKeyInput     = document.getElementById('toggleKey');
  const toggleBtn          = document.getElementById('toggleBtn');
  const btnText            = toggleBtn.querySelector('.btn-text');
  const statusIndicator    = document.getElementById('status-indicator');
  const historyList        = document.getElementById('history-list');
  const liveTimer          = document.getElementById('live-timer');
  const enableLogsCheckbox = document.getElementById('enableLogsCheckbox');
  const logsList           = document.getElementById('logs-list');
  const addMappingBtn      = document.getElementById('addMappingBtn');
  const mappingsList       = document.getElementById('mappings-list');

  let liveTimerInterval = null;

  // ─── Tab Navigation ────────────────────────────────────

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

      e.target.classList.add('active');
      document.getElementById(e.target.dataset.target).classList.add('active');

      if (e.target.dataset.target === 'panel-history') renderHistory();
      else if (e.target.dataset.target === 'panel-logs') renderLogs();
    });
  });

  // ─── Fetch Flyff Tabs ──────────────────────────────────

  const fetchTabs = async () => {
    const tabs = await chrome.tabs.query({ url: ['*://*.flyff.com/*'] });
    tabs.forEach(tab => {
      const title = tab.title.length > 35 ? tab.title.substring(0, 35) + '...' : tab.title;
      tabASelect.add(new Option(`${title} (ID: ${tab.id})`, String(tab.id)));
      tabBSelect.add(new Option(`${title} (ID: ${tab.id})`, String(tab.id)));
    });
  };

  await fetchTabs();

  // ─── Mappings UI ───────────────────────────────────────

  /**
   * Renders the full mappings list from currentConfig.mappings.
   * Each row: [keyA input] → [keyB input] [remove button]
   */
  function renderMappings() {
    mappingsList.innerHTML = '';
    const mappings = currentConfig.mappings || [];

    mappings.forEach((mapping, index) => {
      const row = buildMappingRow(mapping.keyA, mapping.keyB, index);
      mappingsList.appendChild(row);
    });

    // Hide add button when at max
    addMappingBtn.style.display = mappings.length >= MAX_MAPPINGS ? 'none' : 'flex';
  }

  function buildMappingRow(keyA, keyB, index) {
    const row = document.createElement('div');
    row.className = 'mapping-row';
    row.dataset.index = index;

    // Key A input
    const inputA = document.createElement('input');
    inputA.type = 'text';
    inputA.maxLength = 1;
    inputA.className = 'key-input';
    inputA.placeholder = 'A';
    inputA.value = keyA || '';
    inputA.title = 'Key to listen for on Listener Tab';

    // Arrow
    const arrow = document.createElement('span');
    arrow.className = 'mapping-arrow';
    arrow.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"></line>
      <polyline points="12 5 19 12 12 19"></polyline>
    </svg>`;

    // Key B input
    const inputB = document.createElement('input');
    inputB.type = 'text';
    inputB.maxLength = 1;
    inputB.className = 'key-input';
    inputB.placeholder = 'B';
    inputB.value = keyB || '';
    inputB.title = 'Key to simulate on Target Tab';

    // Remove button (hide if only 1 mapping left)
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove';
    removeBtn.title = 'Remove mapping';
    removeBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>`;
    removeBtn.style.visibility = (currentConfig.mappings.length <= 1) ? 'hidden' : 'visible';

    // Events
    const onKeyChange = debounce(() => {
      currentConfig.mappings[index] = {
        keyA: inputA.value.trim().toLowerCase(),
        keyB: inputB.value.trim().toLowerCase()
      };
      saveConfig();
    }, 300);

    inputA.addEventListener('keyup', onKeyChange);
    inputA.addEventListener('change', onKeyChange);
    inputB.addEventListener('keyup', onKeyChange);
    inputB.addEventListener('change', onKeyChange);

    removeBtn.addEventListener('click', () => {
      currentConfig.mappings.splice(index, 1);
      saveConfig();
      renderMappings();
    });

    row.appendChild(inputA);
    row.appendChild(arrow);
    row.appendChild(inputB);
    row.appendChild(removeBtn);

    return row;
  }

  addMappingBtn.addEventListener('click', () => {
    if ((currentConfig.mappings || []).length >= MAX_MAPPINGS) return;
    currentConfig.mappings.push({ keyA: '', keyB: '' });
    renderMappings();
    saveConfig();
    // Scroll to bottom of list
    mappingsList.scrollTop = mappingsList.scrollHeight;
  });

  // ─── Load Config ───────────────────────────────────────

  chrome.runtime.sendMessage({ type: 'REQUEST_CONFIG' }, (response) => {
    if (chrome.runtime.lastError) {
      LOG('Failed to fetch initial config:', chrome.runtime.lastError);
      return;
    }
    if (!response) return;

    currentConfig = response;

    // Ensure mappings array exists (migration safety)
    if (!currentConfig.mappings || !Array.isArray(currentConfig.mappings)) {
      currentConfig.mappings = [{
        keyA: response.keyA || 'c',
        keyB: response.keyB || '1'
      }];
    }

    if (response.tabAId) tabASelect.value = String(response.tabAId);
    if (response.tabBId) tabBSelect.value = String(response.tabBId);
    if (response.toggleKey !== undefined) {
      toggleKeyInput.value = response.toggleKey === ' ' ? 'Space' : response.toggleKey;
    }
    if (response.enableLogs !== undefined) enableLogsCheckbox.checked = response.enableLogs;

    renderMappings();
    LOG('Initial CONFIG fetched and DOM hydrated.');
    updateRunningUI(response.isRunning, response.sessionStartTime);
  });

  // ─── Save Config ───────────────────────────────────────

  const saveConfig = () => {
    const parsedTabA = parseInt(tabASelect.value, 10);
    const parsedTabB = parseInt(tabBSelect.value, 10);

    const newConfig = {
      tabAId: !isNaN(parsedTabA) ? parsedTabA : null,
      tabBId: !isNaN(parsedTabB) ? parsedTabB : null,
      mappings: currentConfig.mappings || [],
      toggleKey: toggleKeyInput.value === 'Space' ? ' ' : toggleKeyInput.value.toLowerCase(),
      enableLogs: enableLogsCheckbox.checked,
      isRunning: currentConfig.isRunning
    };

    LOG('Saving config:', newConfig);
    currentConfig = newConfig;

    chrome.runtime.sendMessage({ type: 'UPDATE_CONFIG', payload: newConfig }, (response) => {
      if (chrome.runtime.lastError) {
        LOG('Failed to save config:', chrome.runtime.lastError);
      }
    });
  };

  const debouncedSave = debounce(saveConfig, 300);

  [tabASelect, tabBSelect, enableLogsCheckbox].forEach(el => el.addEventListener('change', saveConfig));

  toggleKeyInput.addEventListener('keydown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
    const keyName = e.key;
    toggleKeyInput.value = keyName === ' ' ? 'Space' : keyName;
    saveConfig();
  });

  // ─── React to External State Changes ──────────────────

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.multiBoxConfig) {
      const newCfg = changes.multiBoxConfig.newValue;
      if (newCfg && currentConfig.isRunning !== newCfg.isRunning) {
        LOG('Storage change detected — syncing UI.');
        currentConfig.isRunning = newCfg.isRunning;
        updateRunningUI(newCfg.isRunning, null);

        chrome.runtime.sendMessage({ type: 'REQUEST_CONFIG' }, (response) => {
          if (chrome.runtime.lastError) {
            LOG('Failed to fetch config after storage change:', chrome.runtime.lastError);
            return;
          }
          if (!response) return;
          updateRunningUI(response.isRunning, response.sessionStartTime);
        });
      }
    }
  });

  // ─── Start / Stop Toggle ──────────────────────────────

  toggleBtn.addEventListener('click', () => {
    LOG('Toggled Service UI Button');
    currentConfig.isRunning = !currentConfig.isRunning;
    saveConfig();
    updateRunningUI(currentConfig.isRunning, currentConfig.isRunning ? Date.now() : null);
  });

  // ─── UI State Helpers ─────────────────────────────────

  function updateRunningUI(isRunning, startTime = null) {
    if (isRunning) {
      toggleBtn.classList.add('active');
      btnText.textContent = 'Stop Service';
      statusIndicator.classList.add('active');
      startLiveTimer(startTime);
    } else {
      toggleBtn.classList.remove('active');
      btnText.textContent = 'Start Service';
      statusIndicator.classList.remove('active');
      stopLiveTimer();
      renderHistory();
    }
  }

  function startLiveTimer(startTime) {
    if (!startTime) return;
    liveTimer.style.display = 'block';
    if (liveTimerInterval) clearInterval(liveTimerInterval);

    const update = () => {
      const diff = Math.max(0, Date.now() - startTime);
      let s = Math.floor(diff / 1000);
      let m = Math.floor(s / 60);
      let h = Math.floor(m / 60);
      s %= 60; m %= 60;
      liveTimer.textContent = `Current Session: ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    };

    update();
    liveTimerInterval = setInterval(update, 1000);
  }

  function stopLiveTimer() {
    if (liveTimerInterval) { clearInterval(liveTimerInterval); liveTimerInterval = null; }
    liveTimer.style.display = 'none';
    liveTimer.textContent = 'Current Session: 00:00:00';
  }

  // ─── History Rendering ────────────────────────────────

  function renderHistory() {
    chrome.storage.local.get(['sessionHistory'], (result) => {
      const history = result.sessionHistory || [];
      if (history.length === 0) {
        historyList.innerHTML = '<p class="empty-state">No sessions recorded yet.</p>';
        return;
      }

      historyList.innerHTML = '';
      history.forEach(session => {
        const date = new Date(session.start).toLocaleDateString();
        const time = new Date(session.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let s = Math.floor(session.duration / 1000);
        let m = Math.floor(s / 60);
        let h = Math.floor(m / 60);
        s %= 60; m %= 60;

        const parts = [];
        if (h > 0) parts.push(`${h}h`);
        if (m > 0) parts.push(`${m}m`);
        parts.push(`${s}s`);

        const item = document.createElement('div');
        item.className = 'history-item';

        const details = document.createElement('div');
        details.className = 'h-details';
        const dateEl = document.createElement('strong');
        dateEl.textContent = date;
        const timeEl = document.createElement('span');
        timeEl.textContent = time;
        details.appendChild(dateEl);
        details.appendChild(timeEl);

        const dur = document.createElement('div');
        dur.className = 'h-duration badge-time';
        dur.textContent = parts.join(' ');

        item.appendChild(details);
        item.appendChild(dur);
        historyList.appendChild(item);
      });
    });
  }

  // ─── Logs Rendering ───────────────────────────────────

  function renderLogs() {
    chrome.runtime.sendMessage({ type: 'REQUEST_LOGS' }, (logs) => {
      if (chrome.runtime.lastError) {
        LOG('Failed to fetch logs:', chrome.runtime.lastError);
        logsList.innerHTML = '<p class="empty-state">Failed to load logs.</p>';
        return;
      }
      if (!logs || logs.length === 0) {
        logsList.innerHTML = '<p class="empty-state">No debug logs captured yet. Make sure Logging is enabled in Settings!</p>';
        return;
      }

      logsList.innerHTML = '';
      [...logs].reverse().forEach(l => {
        const timeStr = new Date(l.time).toISOString().split('T')[1].slice(0, 12);

        const item = document.createElement('div');
        item.className = 'log-item';

        const timeDiv = document.createElement('div');
        timeDiv.className = 'l-time';
        timeDiv.textContent = timeStr;

        const textDiv = document.createElement('div');
        textDiv.className = 'l-text';
        textDiv.textContent = l.text;

        item.appendChild(timeDiv);
        item.appendChild(textDiv);
        logsList.appendChild(item);
      });
    });
  }
});
