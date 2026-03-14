// Claude Prompt Tracker - Content Script v2 FIXED

(function () {
  let currentChatId = null;
  let observer = null;
  let savedPromptTexts = new Set();

  function getChatId() {
    const match = window.location.pathname.match(/\/chat\/([a-zA-Z0-9-]+)/);
    return match ? match[1] : 'default';
  }

  function getStorageKey() {
    return `claude_prompts_${getChatId()}`;
  }

  function getStoredPrompts() {
    try {
      const stored = localStorage.getItem(getStorageKey());
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  }

  function savePrompt(text, domIndex) {
    if (!text || text.trim().length === 0) return;
    text = text.trim();
    if (savedPromptTexts.has(text)) return;
    savedPromptTexts.add(text);

    const prompts = getStoredPrompts();
    prompts.push({
      id: Date.now() + Math.random(),
      text,
      domIndex,
      timestamp: new Date().toISOString()
    });

    localStorage.setItem(getStorageKey(), JSON.stringify(prompts));
    chrome.runtime.sendMessage({ type: 'PROMPTS_UPDATED', chatId: getChatId() }).catch(() => {});
    console.log('[PromptTracker] Saved:', text.slice(0, 60));
  }

  function findHumanMessages() {
    // Strategy 1: data-testid
    let nodes = document.querySelectorAll('[data-testid="human-turn"]');
    if (nodes.length > 0) return Array.from(nodes);

    // Strategy 2: class with Human
    nodes = document.querySelectorAll('[class*="Human"]');
    if (nodes.length > 0) return Array.from(nodes);

    // Strategy 3: font-user-message class
    nodes = document.querySelectorAll('[class*="font-user-message"]');
    if (nodes.length > 0) return Array.from(nodes);

    // Strategy 4: whitespace-pre-wrap inside human ancestor
    const allPre = document.querySelectorAll('.whitespace-pre-wrap');
    const humanPre = Array.from(allPre).filter(el => {
      let p = el.parentElement;
      for (let i = 0; i < 8; i++) {
        if (!p) break;
        const cls = p.className || '';
        const tid = p.getAttribute('data-testid') || '';
        if (tid.includes('human') || cls.includes('human') || cls.includes('Human')) return true;
        p = p.parentElement;
      }
      return false;
    });
    if (humanPre.length > 0) return humanPre;

    // Strategy 5: any message/user class container
    nodes = document.querySelectorAll('[class*="message"],[class*="Message"]');
    return Array.from(nodes).filter(el => {
      const cls = el.className || '';
      return /human|Human|user|User/.test(cls);
    });
  }

  function scanAndSavePrompts() {
    const msgs = findHumanMessages();
    console.log(`[PromptTracker] Scanning... found ${msgs.length} human msgs`);
    msgs.forEach((el, i) => {
      const text = (el.innerText || el.textContent || '').trim();
      if (text && text.length > 0 && text.length < 5000) {
        savePrompt(text, i);
      }
    });
  }

  function interceptSubmit() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const el = document.activeElement;
        if (el && (el.tagName === 'TEXTAREA' || el.getAttribute('contenteditable'))) {
          setTimeout(scanAndSavePrompts, 800);
          setTimeout(scanAndSavePrompts, 2500);
        }
      }
    }, true);

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const label = btn.getAttribute('aria-label') || '';
      const tid = btn.getAttribute('data-testid') || '';
      if (label.toLowerCase().includes('send') || tid.includes('send')) {
        setTimeout(scanAndSavePrompts, 800);
        setTimeout(scanAndSavePrompts, 2500);
      }
    }, true);
  }

  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(() => {
      const newId = getChatId();
      if (newId !== currentChatId) {
        currentChatId = newId;
        savedPromptTexts = new Set();
        setTimeout(scanAndSavePrompts, 1500);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_PROMPTS') {
      scanAndSavePrompts();
      setTimeout(() => {
        sendResponse({ prompts: getStoredPrompts(), chatId: getChatId() });
      }, 400);
      return true;
    }

    if (msg.type === 'SCROLL_TO_PROMPT') {
      const msgs = findHumanMessages();
      const target = msgs[msg.domIndex];
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.style.transition = 'outline 0.3s';
        target.style.outline = '2px solid rgba(204,120,92,0.8)';
        target.style.borderRadius = '8px';
        setTimeout(() => { target.style.outline = ''; }, 2500);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false });
      }
      return true;
    }

    if (msg.type === 'CLEAR_PROMPTS') {
      localStorage.removeItem(getStorageKey());
      savedPromptTexts = new Set();
      sendResponse({ success: true });
      return true;
    }
  });

  // Init
  currentChatId = getChatId();
  getStoredPrompts().forEach(p => savedPromptTexts.add(p.text));
  interceptSubmit();
  startObserver();
  setTimeout(scanAndSavePrompts, 1500);
  setTimeout(scanAndSavePrompts, 3500);

  // SPA URL change watcher
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      currentChatId = getChatId();
      savedPromptTexts = new Set();
      getStoredPrompts().forEach(p => savedPromptTexts.add(p.text));
      setTimeout(scanAndSavePrompts, 1500);
      setTimeout(scanAndSavePrompts, 3500);
    }
  }, 1000);

})();
