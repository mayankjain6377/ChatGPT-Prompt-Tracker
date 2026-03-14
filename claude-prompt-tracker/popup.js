// Claude Prompt Tracker - Popup Script

let allPrompts = [];
let currentTabId = null;

function formatTime(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function highlightText(text, query) {
  if (!query) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(new RegExp(`(${escapedQuery})`, 'gi'), '<span class="highlight">$1</span>');
}

function renderPrompts(prompts, query = '') {
  const list = document.getElementById('prompt-list');
  const emptyState = document.getElementById('empty-state');
  const noResults = document.getElementById('no-results');
  const countEl = document.getElementById('prompt-count');

  countEl.textContent = allPrompts.length;

  list.innerHTML = '';

  if (allPrompts.length === 0) {
    emptyState.style.display = 'flex';
    noResults.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';

  if (prompts.length === 0 && query) {
    noResults.style.display = 'block';
    return;
  }

  noResults.style.display = 'none';

  prompts.forEach((prompt, i) => {
    const globalIndex = allPrompts.findIndex(p => p.id === prompt.id);
    const item = document.createElement('div');
    item.className = 'prompt-item';
    item.innerHTML = `
      <div class="prompt-number">#${globalIndex + 1}</div>
      <div class="prompt-content">
        <div class="prompt-text">${highlightText(prompt.text, query)}</div>
        <div class="prompt-meta">
          <span class="prompt-time">${formatTime(prompt.timestamp)}</span>
          <button class="copy-btn" data-text="${escapeHtml(prompt.text)}">copy</button>
        </div>
      </div>
    `;

    // Click on item → scroll to that prompt in claude.ai
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('copy-btn')) return;
      if (currentTabId) {
        chrome.tabs.sendMessage(currentTabId, {
          type: 'SCROLL_TO_PROMPT',
          domIndex: prompt.domIndex
        }, (res) => {
          if (chrome.runtime.lastError) {
            // Content script not ready, try injecting
            console.log('Could not reach content script.');
          }
        });
        // Close popup after jump
        setTimeout(() => window.close(), 300);
      }
    });

    // Copy button
    item.querySelector('.copy-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const text = prompt.text;
      navigator.clipboard.writeText(text).then(() => {
        const btn = e.target;
        btn.textContent = 'copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'copy';
          btn.classList.remove('copied');
        }, 1500);
      });
    });

    list.appendChild(item);
  });
}

function filterAndRender(query) {
  if (!query) {
    renderPrompts(allPrompts, '');
    return;
  }
  const lower = query.toLowerCase();
  const filtered = allPrompts.filter(p => p.text.toLowerCase().includes(lower));
  renderPrompts(filtered, query);
}

// Load prompts from current tab
function loadPrompts(tabId) {
  chrome.tabs.sendMessage(tabId, { type: 'GET_PROMPTS' }, (response) => {
    if (chrome.runtime.lastError || !response) {
      // Content script might not be ready
      document.getElementById('status-dot').className = 'status-dot';
      document.getElementById('status-text').textContent = 'Could not connect to page';
      renderPrompts([]);
      return;
    }

    allPrompts = response.prompts || [];
    document.getElementById('status-dot').className = 'status-dot active';
    document.getElementById('status-text').textContent = `Chat: ${response.chatId?.slice(0, 8) || 'unknown'}...`;
    renderPrompts(allPrompts);
  });
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];

    if (!tab || !tab.url || !tab.url.includes('claude.ai')) {
      document.getElementById('main-view').style.display = 'none';
      document.getElementById('not-claude-view').style.display = 'flex';

      document.getElementById('open-claude-btn').addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://claude.ai' });
        window.close();
      });
      return;
    }

    currentTabId = tab.id;
    document.getElementById('main-view').style.display = 'flex';
    document.getElementById('not-claude-view').style.display = 'none';

    loadPrompts(tab.id);
  });

  // Search
  document.getElementById('search').addEventListener('input', (e) => {
    filterAndRender(e.target.value.trim());
  });

  // Clear all
  document.getElementById('clear-btn').addEventListener('click', () => {
    if (!currentTabId) return;
    if (!confirm('Clear all tracked prompts for this chat?')) return;
    chrome.tabs.sendMessage(currentTabId, { type: 'CLEAR_PROMPTS' }, () => {
      allPrompts = [];
      renderPrompts([]);
      document.getElementById('prompt-count').textContent = '0';
    });
  });
});

// Listen for updates from content script
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'PROMPTS_UPDATED' && currentTabId) {
    loadPrompts(currentTabId);
  }
});
