/* =========================================================
   WordSmart — Application Logic
   - Cross-book navigation (WS1 -> WS2 seamlessly)
   - Combined progress across both books (total: 1654)
   - Global word counter (e.g. "427 / 1654")
   - localStorage persistence
   ========================================================= */

// ── CONSTANTS ──
const STORAGE_KEY = 'wordsmart_v3';
const WS1_LEN = () => VOCAB_DATA.ws1.length; // 827
const WS2_LEN = () => VOCAB_DATA.ws2.length; // 827
const TOTAL   = () => WS1_LEN() + WS2_LEN(); // 1654

// ── STATE ──
// book:  'ws1' | 'ws2'
// index: position in the ORDER[book] array
const STATE = {
  book:    'ws1',
  index:   0,
  view:    'flashcard', // 'flashcard' | 'list'
  flipped: false,
};

// Per-book saved positions
const BOOK_INDEX = { ws1: 0, ws2: 0 };

// Covered words: { ws1: { id: true, ... }, ws2: { ... } }
const COVERED = { ws1: {}, ws2: {} };

// Display order (array of indices into VOCAB_DATA[book]).
// Sequential by default; shuffled on user request.
const ORDER = { ws1: [], ws2: [] };

// ── HELPERS ──
function data()        { return VOCAB_DATA[STATE.book]; }
function currentWord() { return data()[ORDER[STATE.book][STATE.index]]; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function initOrder(book) {
  ORDER[book] = Array.from({ length: VOCAB_DATA[book].length }, (_, i) => i);
}

// Global sequential position across both books (1-based for display)
function globalPosition() {
  return STATE.book === 'ws1'
    ? STATE.index + 1
    : WS1_LEN() + STATE.index + 1;
}

// ── PERSISTENCE ──
function persist() {
  BOOK_INDEX[STATE.book] = STATE.index;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      covered:   COVERED,
      bookIndex: { ws1: BOOK_INDEX.ws1, ws2: BOOK_INDEX.ws2 },
      book:      STATE.book,
      theme:     document.documentElement.getAttribute('data-theme'),
    }));
  } catch (_) {}

  // Automatically sync to cloud if user is signed in
  if (typeof scheduleCloudSync === 'function') {
    scheduleCloudSync();
  }
}

function hydrate() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (s.covered?.ws1) COVERED.ws1 = s.covered.ws1;
    if (s.covered?.ws2) COVERED.ws2 = s.covered.ws2;
    if (s.bookIndex?.ws1 != null) BOOK_INDEX.ws1 = Number(s.bookIndex.ws1) || 0;
    if (s.bookIndex?.ws2 != null) BOOK_INDEX.ws2 = Number(s.bookIndex.ws2) || 0;
    if (s.book) STATE.book = s.book;
    if (s.theme) document.documentElement.setAttribute('data-theme', s.theme);
  } catch (_) {}
}

// ── DOM REFS ──
const $ = (id) => document.getElementById(id);
const EL = {
  cardBody:         $('card-body'),
  cardWord:         $('card-word'),
  cardBadge:        $('card-badge'),
  backDef:          $('back-definition'),
  backBangla:       $('back-bangla'),
  backPhrases:      $('back-phrases'),
  cardIndex:        $('card-index'),
  cardTotal:        $('card-total'),
  progressFill:     $('progress-fill'),
  progressPct:      $('progress-pct'),
  progressCount:    $('progress-count'),
  coveredBtn:       $('covered-btn'),
  coveredBtnTxt:    $('covered-btn-text'),
  coveredList:      $('covered-list'),
  coveredEmpty:     $('covered-list-empty'),
  listStats:        $('list-stats'),
  flashcardView:    $('flashcard-view'),
  listView:         $('list-view'),
  tabWs1:           $('tab-ws1'),
  tabWs2:           $('tab-ws2'),
  prevBtn:          $('prev-btn'),
  nextBtn:          $('next-btn'),
  toast:            $('toast'),
  iconGrid:         $('icon-grid'),
  iconCard:         $('icon-card'),
  iconMoon:         $('icon-moon'),
  iconSun:          $('icon-sun'),
  // Auth & Cloud Elements
  authBtn:          $('auth-btn'),
  authBtnLabel:     $('auth-btn-label'),
  syncDot:          $('sync-dot'),
  authModal:        $('auth-modal'),
  authUserView:     $('auth-user-view'),
  authFormView:     $('auth-form-view'),
  userNameDisplay:  $('user-name-display'),
  userEmailDisplay: $('user-email-display'),
  userAvatarImg:    $('user-avatar-img'),
  defaultAvatarSvg: $('default-avatar-svg'),
  cloudSyncStatus:  $('cloud-sync-status'),
  authAlert:        $('auth-alert'),
  googleSigninBtn:  $('google-signin-btn'),
};

// ── RENDER CARD ──
function renderCard() {
  const word = currentWord();
  if (!word) return;

  // Always unflip when showing a new card
  if (STATE.flipped) {
    STATE.flipped = false;
    EL.cardBody.classList.remove('flipped');
  }

  // Front content
  EL.cardBadge.textContent = STATE.book === 'ws1' ? 'Word Smart 1' : 'Word Smart 2';
  EL.cardWord.textContent  = word.word;

  // Animate word in
  EL.cardWord.classList.remove('word-enter');
  void EL.cardWord.offsetWidth;
  EL.cardWord.classList.add('word-enter');

  // Back content with target word highlighted in example sentences
  EL.backDef.textContent    = word.definition;
  EL.backBangla.textContent = word.bangla;
  EL.backPhrases.innerHTML  = word.phrases.map(p => `<li>${highlightWord(p, word.word)}</li>`).join('');

  // Global counter — shows position across ALL 1654 words
  EL.cardIndex.textContent = globalPosition();
  EL.cardTotal.textContent = TOTAL();

  // Nav button disabled states
  // Prev disabled only at very first word (WS1, index 0)
  // Next disabled only at very last word (WS2, last index)
  EL.prevBtn.disabled = (STATE.book === 'ws1' && STATE.index === 0);
  EL.nextBtn.disabled = (STATE.book === 'ws2' && STATE.index === WS2_LEN() - 1);

  // Covered button state
  const covered = !!COVERED[STATE.book][word.id];
  EL.coveredBtn.classList.toggle('is-covered', covered);
  EL.coveredBtnTxt.textContent = covered ? 'Covered' : 'Mark as Covered';

  updateProgress();
  persist();
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── HIGHLIGHT WORD IN EXAMPLES ──
function highlightWord(text, rawWord) {
  if (!text) return '';
  const escapedText = esc(text);
  if (!rawWord) return escapedText;

  const cleanWord = rawWord.trim().toLowerCase().replace(/[`'"]+$/g, '');
  const escRegex = (s) => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

  const forms = new Set();
  forms.add(escRegex(cleanWord));
  forms.add(escRegex(cleanWord) + '(?:s|es|ed|ing|d|r|rs|ly|ness|ment|tion|tions|able)?');

  if (cleanWord.endsWith('e') && cleanWord.length > 3) {
    const base = escRegex(cleanWord.slice(0, -1));
    forms.add(base + '(?:e|ed|es|ing|ion|ions|ive|ly|ment|al|ation|ations|able|ibility|or|ors|er|ers)');
  }
  if (cleanWord.endsWith('y') && cleanWord.length > 3) {
    const base = escRegex(cleanWord.slice(0, -1));
    forms.add(base + '(?:y|ies|ied|ying|i(?:st|stic|fication|ly|ness)?)');
  }
  if (cleanWord.endsWith('ent') && cleanWord.length > 4) {
    const base = escRegex(cleanWord.slice(0, -3));
    forms.add(base + '(?:ent|ence|ency|ently|ain|ained|aining)');
  }
  if (cleanWord.endsWith('ant') && cleanWord.length > 4) {
    const base = escRegex(cleanWord.slice(0, -3));
    forms.add(base + '(?:ant|ance|ancy|antly)');
  }
  if (cleanWord.endsWith('ious') && cleanWord.length > 5) {
    const base = escRegex(cleanWord.slice(0, -4));
    forms.add(base + '(?:ious|iously|iousness|y)');
  }
  if (cleanWord.endsWith('ation') && cleanWord.length > 6) {
    const base = escRegex(cleanWord.slice(0, -5));
    forms.add(base + '(?:ation|ations|ed|ing|s|e)');
  }
  if (cleanWord.endsWith('ic') && cleanWord.length > 4) {
    const base = escRegex(cleanWord.slice(0, -2));
    forms.add(base + '(?:ic|ical|ically|ics)');
  }

  const lastChar = cleanWord.slice(-1);
  if (/[bdfgklmnprstz]/.test(lastChar)) {
    forms.add(escRegex(cleanWord) + escRegex(lastChar) + '(?:ed|ing|er|est)');
  }

  const regex = new RegExp('\\b(' + Array.from(forms).join('|') + ')\\b', 'gi');
  return escapedText.replace(regex, '<span class="word-hl">$1</span>');
}

// ── PROGRESS — combined across both books ──
function updateProgress() {
  const total   = TOTAL();
  const covered = Object.keys(COVERED.ws1).length + Object.keys(COVERED.ws2).length;
  const pct     = total ? Math.round((covered / total) * 100) : 0;
  EL.progressFill.style.width  = pct + '%';
  EL.progressPct.textContent   = pct + '%';
  EL.progressCount.textContent = `${covered} / ${total} covered`;
}

// ── FLIP ──
function flipCard() {
  STATE.flipped = !STATE.flipped;
  EL.cardBody.classList.toggle('flipped', STATE.flipped);
}

// ── NAVIGATE — crosses from WS1 to WS2 and back ──
function navigate(dir) {
  if (dir === 1) {
    // Moving forward
    if (STATE.book === 'ws1') {
      if (STATE.index < WS1_LEN() - 1) {
        // Normal forward within WS1
        STATE.index++;
        BOOK_INDEX.ws1 = STATE.index;
        renderCard();
      } else {
        // End of WS1 → jump to start of WS2
        BOOK_INDEX.ws1 = STATE.index;
        STATE.book  = 'ws2';
        STATE.index = 0;
        BOOK_INDEX.ws2 = 0;
        syncTabs();
        renderCard();
      }
    } else {
      // Within WS2
      if (STATE.index < WS2_LEN() - 1) {
        STATE.index++;
        BOOK_INDEX.ws2 = STATE.index;
        renderCard();
      }
      // At end of WS2 — next button should be disabled (handled in renderCard)
    }
  } else {
    // Moving backward
    if (STATE.book === 'ws2') {
      if (STATE.index > 0) {
        // Normal back within WS2
        STATE.index--;
        BOOK_INDEX.ws2 = STATE.index;
        renderCard();
      } else {
        // Start of WS2 → jump to end of WS1
        BOOK_INDEX.ws2 = 0;
        STATE.book  = 'ws1';
        STATE.index = WS1_LEN() - 1;
        BOOK_INDEX.ws1 = STATE.index;
        syncTabs();
        renderCard();
      }
    } else {
      // Within WS1
      if (STATE.index > 0) {
        STATE.index--;
        BOOK_INDEX.ws1 = STATE.index;
        renderCard();
      }
      // At start of WS1 — prev button should be disabled
    }
  }
}

// ── MARK COVERED ──
function markCovered() {
  const word = currentWord();
  if (!word) return;
  const wasCovered = !!COVERED[STATE.book][word.id];
  if (wasCovered) {
    delete COVERED[STATE.book][word.id];
    showToast(`"${word.word}" removed from covered list`);
  } else {
    COVERED[STATE.book][word.id] = true;
    showToast(`"${word.word}" marked as covered`);
  }
  renderCard();
  if (STATE.view === 'list') renderListView();
}

// ── SWITCH BOOK (tab click) ──
function switchBook(book) {
  if (STATE.book === book) return;
  BOOK_INDEX[STATE.book] = STATE.index;
  STATE.book  = book;
  STATE.index = clamp(BOOK_INDEX[book], 0, VOCAB_DATA[book].length - 1);
  syncTabs();
  if (STATE.view === 'list') {
    renderListView();
    updateProgress();
  } else {
    renderCard();
  }
}

// Update tab button classes and aria attributes
function syncTabs() {
  EL.tabWs1.classList.toggle('active', STATE.book === 'ws1');
  EL.tabWs2.classList.toggle('active', STATE.book === 'ws2');
  EL.tabWs1.setAttribute('aria-selected', String(STATE.book === 'ws1'));
  EL.tabWs2.setAttribute('aria-selected', String(STATE.book === 'ws2'));
}

// ── SHUFFLE ──
function shuffleCards() {
  const order = ORDER[STATE.book];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  STATE.index            = 0;
  BOOK_INDEX[STATE.book] = 0;
  renderCard();
  showToast('Cards shuffled');
}

// ── RESET ──
function resetProgress() {
  if (!confirm('Reset all covered words for both books? This cannot be undone.')) return;
  COVERED.ws1 = {};
  COVERED.ws2 = {};
  STATE.index = 0;
  BOOK_INDEX.ws1 = 0;
  BOOK_INDEX.ws2 = 0;
  initOrder('ws1');
  initOrder('ws2');
  renderCard();
  if (STATE.view === 'list') renderListView();
  showToast('Progress reset');
}

// ── TOGGLE VIEW ──
function toggleView() {
  if (STATE.view === 'flashcard') {
    STATE.view = 'list';
    EL.flashcardView.classList.add('hidden');
    EL.listView.classList.remove('hidden');
    EL.iconGrid.classList.add('hidden');
    EL.iconCard.classList.remove('hidden');
    renderListView();
  } else {
    STATE.view = 'flashcard';
    EL.listView.classList.add('hidden');
    EL.flashcardView.classList.remove('hidden');
    EL.iconCard.classList.add('hidden');
    EL.iconGrid.classList.remove('hidden');
  }
}

// ── RENDER LIST VIEW ──
function renderListView() {
  // Show covered words from BOTH books in the list view
  const ws1Entries = VOCAB_DATA.ws1.filter(w => COVERED.ws1[w.id]);
  const ws2Entries = VOCAB_DATA.ws2.filter(w => COVERED.ws2[w.id]);
  const entries    = [...ws1Entries, ...ws2Entries];
  const count      = entries.length;

  EL.listStats.textContent = `${count} word${count !== 1 ? 's' : ''}`;
  EL.coveredEmpty.classList.toggle('hidden', count > 0);

  if (count === 0) {
    EL.coveredList.innerHTML = '';
    return;
  }

  EL.coveredList.innerHTML = entries.map(w => {
    // Determine book from id prefix
    const book      = w.id.startsWith('ws1') ? 'ws1' : 'ws2';
    const bookLabel = book === 'ws1' ? 'WS1' : 'WS2';
    return `
      <div class="covered-card"
           role="button"
           tabindex="0"
           aria-label="Go to flashcard: ${esc(w.word)}"
           onclick="goToCard('${esc(w.id)}')"
           onkeydown="if(event.key==='Enter')goToCard('${esc(w.id)}')">
        <span class="covered-card-book">${bookLabel}</span>
        <div class="covered-card-word">${esc(w.word)}</div>
        <div class="covered-card-def">${esc(w.definition)}</div>
        <div class="covered-card-goto">Open flashcard &rarr;</div>
      </div>`;
  }).join('');
}

// ── GO TO CARD FROM LIST ──
function goToCard(wordId) {
  // Find book and raw data index
  let targetBook = null;
  let rawIdx     = -1;
  for (const book of ['ws1', 'ws2']) {
    const idx = VOCAB_DATA[book].findIndex(w => w.id === wordId);
    if (idx !== -1) { targetBook = book; rawIdx = idx; break; }
  }
  if (!targetBook || rawIdx === -1) return;

  // Find position in ORDER (accounts for shuffled order)
  const orderIdx = ORDER[targetBook].indexOf(rawIdx);
  if (orderIdx === -1) return;

  // Switch to flashcard view, update icons
  STATE.view = 'flashcard';
  EL.listView.classList.add('hidden');
  EL.flashcardView.classList.remove('hidden');
  EL.iconCard.classList.add('hidden');
  EL.iconGrid.classList.remove('hidden');

  // Update book if necessary (tabs only, no extra renderCard)
  if (STATE.book !== targetBook) {
    BOOK_INDEX[STATE.book] = STATE.index;
    STATE.book = targetBook;
    syncTabs();
  }

  // Set index and render once
  STATE.index              = orderIdx;
  BOOK_INDEX[targetBook]   = orderIdx;
  renderCard();
  showToast(`Jumped to "${currentWord().word}"`);
}

// ── THEME TOGGLE ──
function toggleTheme() {
  const html   = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  EL.iconMoon.classList.toggle('hidden', isDark);
  EL.iconSun.classList.toggle('hidden', !isDark);
  persist();
  showToast(isDark ? 'Light mode' : 'Dark mode');
}

// ── TOAST ──
let _toastTimer = null;
function showToast(msg) {
  EL.toast.textContent = msg;
  EL.toast.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => EL.toast.classList.remove('show'), 2200);
}

// ── KEYBOARD SHORTCUTS ──
document.addEventListener('keydown', (e) => {
  // If cloud auth modal is active, handle Esc and ignore shortcuts
  if (EL.authModal && !EL.authModal.classList.contains('hidden')) {
    if (e.key === 'Escape') closeAuthModal();
    return;
  }

  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
  switch (e.key) {
    case 'ArrowLeft':
      if (STATE.view === 'flashcard') navigate(-1);
      break;
    case 'ArrowRight':
      if (STATE.view === 'flashcard') navigate(1);
      break;
    case ' ':
    case 'Enter':
      if (STATE.view === 'flashcard') { e.preventDefault(); flipCard(); }
      break;
    case 'c':
    case 'C':
      if (STATE.view === 'flashcard') markCovered();
      break;
    case '1':
      switchBook('ws1');
      break;
    case '2':
      switchBook('ws2');
      break;
    case 't':
    case 'T':
      toggleTheme();
      break;
    case 'v':
    case 'V':
      toggleView();
      break;
  }
});

// ── AUTH & SUPABASE CLOUD SYNC ──
let _sbClient = null;
let _syncDebounce = null;

const AUTH_STATE = {
  user: null,
  syncStatus: 'synced', // 'synced' | 'syncing' | 'error'
};

function getSupabaseConfig() {
  if (window.SUPABASE_CONFIG?.url && window.SUPABASE_CONFIG?.anonKey) {
    return {
      url: window.SUPABASE_CONFIG.url.trim(),
      anonKey: window.SUPABASE_CONFIG.anonKey.trim(),
    };
  }
  const cfg = window.SUPABASE_CONFIG || {};
  const url = (cfg.url || localStorage.getItem('wordsmart_sb_url') || '').trim();
  const anonKey = (cfg.anonKey || localStorage.getItem('wordsmart_sb_key') || '').trim();
  return { url, anonKey };
}

function getSupabase() {
  if (_sbClient) return { client: _sbClient, error: null };

  if (typeof window.supabase === 'undefined') {
    return {
      client: null,
      error: 'The Supabase library could not be loaded from CDN. Please check your internet connection or disable adblockers for this page.'
    };
  }

  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    return {
      client: null,
      error: 'Supabase URL or Anon Key is missing. Please check your credentials in supabase-config.js.'
    };
  }

  try {
    _sbClient = window.supabase.createClient(url, anonKey);
    return { client: _sbClient, error: null };
  } catch (e) {
    console.error('Failed to initialize Supabase client:', e);
    return { client: null, error: 'Failed to initialize Supabase: ' + e.message };
  }
}

async function initAuth() {
  // Clean URL hash if returning from OAuth redirect
  if (window.location.hash && window.location.hash.includes('access_token')) {
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch (_) {}
  }

  const { client } = getSupabase();
  if (!client) {
    updateAuthUI(null);
    return;
  }

  try {
    const { data: { session } } = await client.auth.getSession();
    if (session?.user) {
      AUTH_STATE.user = session.user;
      updateAuthUI(session.user);
      await syncFromCloud(session.user.id);
    } else {
      AUTH_STATE.user = null;
      updateAuthUI(null);
    }

    client.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user || null;
      AUTH_STATE.user = user;
      updateAuthUI(user);
      if (user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
        await syncFromCloud(user.id);
      }
    });
  } catch (err) {
    console.warn('Supabase auth init error:', err);
    updateAuthUI(null);
  }
}

function setSyncStatus(status, message) {
  AUTH_STATE.syncStatus = status;
  if (EL.syncDot) {
    EL.syncDot.className = `sync-dot ${status}`;
  }
  if (EL.cloudSyncStatus) {
    const dotClass = 'sync-indicator-dot ' + (status === 'syncing' ? 'syncing' : status === 'error' ? 'error' : 'synced');
    const text = message || (status === 'syncing' ? 'Syncing...' : status === 'error' ? 'Sync error (offline / verify table)' : 'Synced with Google across devices');
    EL.cloudSyncStatus.innerHTML = `<span class="${dotClass}"></span> ${esc(text)}`;
  }
}

function scheduleCloudSync(immediate = false) {
  const { client } = getSupabase();
  if (!client || !AUTH_STATE.user) return;

  setSyncStatus('syncing');
  clearTimeout(_syncDebounce);

  const doSync = async () => {
    try {
      const payload = {
        user_id: AUTH_STATE.user.id,
        covered_ws1: COVERED.ws1,
        covered_ws2: COVERED.ws2,
        current_book: STATE.book,
        index_ws1: BOOK_INDEX.ws1,
        index_ws2: BOOK_INDEX.ws2,
        theme: document.documentElement.getAttribute('data-theme') || 'dark',
        updated_at: new Date().toISOString()
      };

      const { error } = await client.from('user_progress').upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;
      setSyncStatus('synced');
    } catch (err) {
      console.warn('Cloud sync error:', err);
      setSyncStatus('error', err.message || 'Sync failed');
    }
  };

  if (immediate) {
    doSync();
  } else {
    _syncDebounce = setTimeout(doSync, 700);
  }
}

async function syncFromCloud(userId) {
  const { client } = getSupabase();
  if (!client || !userId) return;

  setSyncStatus('syncing');
  try {
    const { data, error } = await client
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      // Merge covered words with remote
      COVERED.ws1 = { ...COVERED.ws1, ...(data.covered_ws1 || {}) };
      COVERED.ws2 = { ...COVERED.ws2, ...(data.covered_ws2 || {}) };

      // Restore position & book
      if (data.current_book && (data.current_book === 'ws1' || data.current_book === 'ws2')) {
        STATE.book = data.current_book;
      }
      if (data.index_ws1 != null) {
        BOOK_INDEX.ws1 = clamp(Number(data.index_ws1) || 0, 0, WS1_LEN() - 1);
      }
      if (data.index_ws2 != null) {
        BOOK_INDEX.ws2 = clamp(Number(data.index_ws2) || 0, 0, WS2_LEN() - 1);
      }
      STATE.index = clamp(BOOK_INDEX[STATE.book], 0, VOCAB_DATA[STATE.book].length - 1);

      if (data.theme) {
        document.documentElement.setAttribute('data-theme', data.theme);
        syncThemeIcon();
      }

      // Persist merged state to local storage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          covered: COVERED,
          bookIndex: { ws1: BOOK_INDEX.ws1, ws2: BOOK_INDEX.ws2 },
          book: STATE.book,
          theme: document.documentElement.getAttribute('data-theme'),
        }));
      } catch (_) {}

      syncTabs();
      renderCard();
      if (STATE.view === 'list') renderListView();
      updateProgress();
      setSyncStatus('synced', 'Synced from Google account just now');
      showToast('Progress synced with Google');
    } else {
      // First time user with this account -> push initial progress to cloud
      scheduleCloudSync(true);
    }
  } catch (err) {
    console.warn('Error fetching cloud progress:', err);
    setSyncStatus('error', 'Cloud sync failed: check table in Supabase');
  }
}

function updateAuthUI(user) {
  if (user) {
    const meta = user.user_metadata || {};
    const name = meta.full_name || meta.name || user.email?.split('@')[0] || 'Google User';
    const avatar = meta.avatar_url || meta.picture || null;

    if (EL.userNameDisplay) EL.userNameDisplay.textContent = name;
    if (EL.userEmailDisplay) EL.userEmailDisplay.textContent = user.email || '';
    if (avatar && EL.userAvatarImg) {
      EL.userAvatarImg.src = avatar;
      EL.userAvatarImg.classList.remove('hidden');
      if (EL.defaultAvatarSvg) EL.defaultAvatarSvg.classList.add('hidden');
    } else {
      if (EL.userAvatarImg) EL.userAvatarImg.classList.add('hidden');
      if (EL.defaultAvatarSvg) EL.defaultAvatarSvg.classList.remove('hidden');
    }

    EL.authBtnLabel.textContent = 'Account';
    EL.syncDot.className = 'sync-dot synced';
    EL.authUserView.classList.remove('hidden');
    EL.authFormView.classList.add('hidden');
  } else {
    EL.authBtnLabel.textContent = 'Sign In';
    EL.syncDot.className = 'sync-dot';
    EL.authUserView.classList.add('hidden');
    EL.authFormView.classList.remove('hidden');
    if (EL.userAvatarImg) EL.userAvatarImg.classList.add('hidden');
    if (EL.defaultAvatarSvg) EL.defaultAvatarSvg.classList.remove('hidden');
  }
}

function openAuthModal() {
  clearAuthAlert();
  EL.authModal.classList.remove('hidden');
}

function closeAuthModal() {
  EL.authModal.classList.add('hidden');
  clearAuthAlert();
}

function showAuthAlert(msg, isError = true) {
  EL.authAlert.className = `auth-alert ${isError ? 'error' : 'success'}`;
  EL.authAlert.textContent = msg;
  EL.authAlert.classList.remove('hidden');
}

function clearAuthAlert() {
  EL.authAlert.classList.add('hidden');
  EL.authAlert.textContent = '';
}

async function signInWithGoogle() {
  clearAuthAlert();

  if (window.location.protocol === 'file:') {
    showAuthAlert('Google OAuth cannot run from a local file:// URL. Please open the project using a local web server (e.g. VS Code Live Server or "npx serve") or deploy to GitHub Pages / Vercel.');
    return;
  }

  const { client, error } = getSupabase();
  if (!client) {
    showAuthAlert(error || 'Supabase is not configured yet. Please check supabase-config.js.');
    return;
  }

  if (EL.googleSigninBtn) EL.googleSigninBtn.disabled = true;

  try {
    const { error: oauthError } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        }
      }
    });
    if (oauthError) throw oauthError;
  } catch (err) {
    showAuthAlert(err.message || 'Google sign-in error.');
    if (EL.googleSigninBtn) EL.googleSigninBtn.disabled = false;
  }
}

async function signOutUser() {
  const { client } = getSupabase();
  if (client) {
    await client.auth.signOut();
  }
  AUTH_STATE.user = null;
  updateAuthUI(null);
  closeAuthModal();
  showToast('Signed out');
}

async function manualSync() {
  if (!AUTH_STATE.user) return;
  const btn = $('manual-sync-btn');
  if (btn) btn.disabled = true;
  await syncFromCloud(AUTH_STATE.user.id);
  await scheduleCloudSync(true);
  if (btn) btn.disabled = false;
  showToast('Cloud sync complete!');
}

// ── SYNC THEME ICON ON LOAD ──
function syncThemeIcon() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  EL.iconMoon.classList.toggle('hidden', !isDark);
  EL.iconSun.classList.toggle('hidden', isDark);
}

// ── INIT ──
function init() {
  // Build sequential order for both books
  initOrder('ws1');
  initOrder('ws2');

  // Restore persisted state
  hydrate();

  // Clamp indices in case data changed since last save
  BOOK_INDEX.ws1 = clamp(BOOK_INDEX.ws1, 0, VOCAB_DATA.ws1.length - 1);
  BOOK_INDEX.ws2 = clamp(BOOK_INDEX.ws2, 0, VOCAB_DATA.ws2.length - 1);
  STATE.index    = clamp(BOOK_INDEX[STATE.book], 0, VOCAB_DATA[STATE.book].length - 1);

  syncTabs();
  syncThemeIcon();
  renderCard();
  initAuth();
}

init();
