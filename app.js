/* =========================================================
   WordSmart — Application Logic
   Clean state management with localStorage persistence.
   ========================================================= */

// ── STATE ──
const STATE = {
  book:    'ws1',       // active book: 'ws1' | 'ws2'
  index:   0,           // position within the current order array
  view:    'flashcard', // 'flashcard' | 'list'
  flipped: false,
};

// Per-book position memory (persisted separately from STATE)
const BOOK_INDEX = { ws1: 0, ws2: 0 };

// Covered words: { ws1: { wordId: true, ... }, ws2: { ... } }
const COVERED = { ws1: {}, ws2: {} };

// Display order (indices into VOCAB_DATA[book])
const ORDER = { ws1: [], ws2: [] };

const STORAGE_KEY = 'wordsmart_v2';

// ── PERSISTENCE ──
function persist() {
  try {
    BOOK_INDEX[STATE.book] = STATE.index;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      covered:   COVERED,
      bookIndex: { ws1: BOOK_INDEX.ws1, ws2: BOOK_INDEX.ws2 },
      book:      STATE.book,
      theme:     document.documentElement.getAttribute('data-theme'),
    }));
  } catch (_) {}
}

function hydrate() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (s.covered?.ws1) COVERED.ws1 = s.covered.ws1;
    if (s.covered?.ws2) COVERED.ws2 = s.covered.ws2;
    if (s.bookIndex?.ws1 != null) BOOK_INDEX.ws1 = s.bookIndex.ws1;
    if (s.bookIndex?.ws2 != null) BOOK_INDEX.ws2 = s.bookIndex.ws2;
    if (s.book) STATE.book = s.book;
    if (s.theme) document.documentElement.setAttribute('data-theme', s.theme);
  } catch (_) {}
}

// ── HELPERS ──
function data()        { return VOCAB_DATA[STATE.book]; }
function currentWord() { return data()[ORDER[STATE.book][STATE.index]]; }

function initOrder(book) {
  ORDER[book] = Array.from({ length: VOCAB_DATA[book].length }, (_, i) => i);
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ── DOM REFS ──
const $ = (id) => document.getElementById(id);
const EL = {
  cardBody:     $('card-body'),
  cardWord:     $('card-word'),
  cardBadge:    $('card-badge'),
  backDef:      $('back-definition'),
  backBangla:   $('back-bangla'),
  backPhrases:  $('back-phrases'),
  cardIndex:    $('card-index'),
  cardTotal:    $('card-total'),
  progressFill: $('progress-fill'),
  progressPct:  $('progress-pct'),
  progressCount:$('progress-count'),
  coveredBtn:   $('covered-btn'),
  coveredBtnTxt:$('covered-btn-text'),
  coveredList:  $('covered-list'),
  coveredEmpty: $('covered-list-empty'),
  listStats:    $('list-stats'),
  flashcardView:$('flashcard-view'),
  listView:     $('list-view'),
  tabWs1:       $('tab-ws1'),
  tabWs2:       $('tab-ws2'),
  prevBtn:      $('prev-btn'),
  nextBtn:      $('next-btn'),
  toast:        $('toast'),
  iconGrid:     $('icon-grid'),
  iconCard:     $('icon-card'),
  iconMoon:     $('icon-moon'),
  iconSun:      $('icon-sun'),
};

// ── RENDER CARD ──
function renderCard() {
  const word = currentWord();
  if (!word) return;

  // Unflip before showing new word
  if (STATE.flipped) {
    STATE.flipped = false;
    EL.cardBody.classList.remove('flipped');
  }

  // Front
  EL.cardBadge.textContent = STATE.book === 'ws1' ? 'Word Smart 1' : 'Word Smart 2';
  EL.cardWord.textContent  = word.word;

  // Word enter animation
  EL.cardWord.classList.remove('word-enter');
  void EL.cardWord.offsetWidth; // force reflow
  EL.cardWord.classList.add('word-enter');

  // Back
  EL.backDef.textContent    = word.definition;
  EL.backBangla.textContent = word.bangla;
  EL.backPhrases.innerHTML  = word.phrases
    .map(p => `<li>${esc(p)}</li>`)
    .join('');

  // Counter
  const total = data().length;
  EL.cardIndex.textContent = STATE.index + 1;
  EL.cardTotal.textContent = total;

  // Navigation buttons
  EL.prevBtn.disabled = STATE.index === 0;
  EL.nextBtn.disabled = STATE.index === total - 1;

  // Covered button state
  const isCovered = !!COVERED[STATE.book][word.id];
  EL.coveredBtn.classList.toggle('is-covered', isCovered);
  EL.coveredBtnTxt.textContent = isCovered ? 'Covered' : 'Mark as Covered';

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

// ── PROGRESS ──
function updateProgress() {
  const total   = data().length;
  const covered = Object.keys(COVERED[STATE.book]).length;
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

// ── NAVIGATE ──
function navigate(dir) {
  const len    = data().length;
  const newIdx = clamp(STATE.index + dir, 0, len - 1);
  if (newIdx === STATE.index) return;
  STATE.index              = newIdx;
  BOOK_INDEX[STATE.book]   = newIdx;
  renderCard();
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

// ── SWITCH BOOK ──
function switchBook(book) {
  if (STATE.book === book) return;
  BOOK_INDEX[STATE.book] = STATE.index;
  STATE.book  = book;
  STATE.index = clamp(BOOK_INDEX[book], 0, VOCAB_DATA[book].length - 1);

  EL.tabWs1.classList.toggle('active', book === 'ws1');
  EL.tabWs2.classList.toggle('active', book === 'ws2');
  EL.tabWs1.setAttribute('aria-selected', String(book === 'ws1'));
  EL.tabWs2.setAttribute('aria-selected', String(book === 'ws2'));

  if (STATE.view === 'list') {
    renderListView();
    updateProgress();
  } else {
    renderCard(); // renderCard calls updateProgress internally
  }
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
  const bookName = STATE.book === 'ws1' ? '1' : '2';
  if (!confirm(`Reset all covered words for Word Smart ${bookName}? This cannot be undone.`)) return;
  COVERED[STATE.book]    = {};
  STATE.index            = 0;
  BOOK_INDEX[STATE.book] = 0;
  initOrder(STATE.book);
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
    // Swap icons
    EL.iconGrid.classList.add('hidden');
    EL.iconCard.classList.remove('hidden');
    renderListView();
  } else {
    STATE.view = 'flashcard';
    EL.listView.classList.add('hidden');
    EL.flashcardView.classList.remove('hidden');
    // Swap icons
    EL.iconCard.classList.add('hidden');
    EL.iconGrid.classList.remove('hidden');
  }
}

// ── RENDER LIST VIEW ──
function renderListView() {
  const coveredIds = COVERED[STATE.book];
  const all        = VOCAB_DATA[STATE.book];
  const entries    = all.filter(w => coveredIds[w.id]);
  const count      = entries.length;

  EL.listStats.textContent = `${count} word${count !== 1 ? 's' : ''}`;
  EL.coveredEmpty.classList.toggle('hidden', count > 0);

  if (count === 0) {
    EL.coveredList.innerHTML = '';
    return;
  }

  const bookLabel = STATE.book === 'ws1' ? 'WS1' : 'WS2';
  EL.coveredList.innerHTML = entries.map(w => `
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
    </div>
  `).join('');
}

// ── GO TO CARD FROM LIST ──
function goToCard(wordId) {
  // Determine which book contains this word
  let targetBook = null;
  let rawIdx     = -1;

  for (const book of ['ws1', 'ws2']) {
    const idx = VOCAB_DATA[book].findIndex(w => w.id === wordId);
    if (idx !== -1) { targetBook = book; rawIdx = idx; break; }
  }
  if (!targetBook || rawIdx === -1) return;

  // Find position within current ORDER array
  const orderIdx = ORDER[targetBook].indexOf(rawIdx);
  if (orderIdx === -1) return;

  // Switch view first
  STATE.view = 'flashcard';
  EL.listView.classList.add('hidden');
  EL.flashcardView.classList.remove('hidden');
  EL.iconCard.classList.add('hidden');
  EL.iconGrid.classList.remove('hidden');

  // Switch book if needed (update tabs only, don't re-render yet)
  if (STATE.book !== targetBook) {
    BOOK_INDEX[STATE.book] = STATE.index;
    STATE.book = targetBook;
    EL.tabWs1.classList.toggle('active', targetBook === 'ws1');
    EL.tabWs2.classList.toggle('active', targetBook === 'ws2');
    EL.tabWs1.setAttribute('aria-selected', String(targetBook === 'ws1'));
    EL.tabWs2.setAttribute('aria-selected', String(targetBook === 'ws2'));
  }

  // Set index and render
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
  // Swap icons
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
  // Don't hijack input fields
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

// ── SYNC INITIAL THEME ICONS ──
function syncThemeIcon() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  EL.iconMoon.classList.toggle('hidden', !isDark);
  EL.iconSun.classList.toggle('hidden', isDark);
}

// ── INIT ──
function init() {
  // Build sequential order arrays for both books
  initOrder('ws1');
  initOrder('ws2');

  // Load persisted state (overrides defaults above)
  hydrate();

  // Clamp restored indices in case data size changed
  STATE.index    = clamp(BOOK_INDEX[STATE.book], 0, VOCAB_DATA[STATE.book].length - 1);
  BOOK_INDEX.ws1 = clamp(BOOK_INDEX.ws1, 0, VOCAB_DATA.ws1.length - 1);
  BOOK_INDEX.ws2 = clamp(BOOK_INDEX.ws2, 0, VOCAB_DATA.ws2.length - 1);

  // Sync tab UI
  EL.tabWs1.classList.toggle('active', STATE.book === 'ws1');
  EL.tabWs2.classList.toggle('active', STATE.book === 'ws2');
  EL.tabWs1.setAttribute('aria-selected', String(STATE.book === 'ws1'));
  EL.tabWs2.setAttribute('aria-selected', String(STATE.book === 'ws2'));

  // Sync theme icon
  syncThemeIcon();

  // Render first card
  renderCard();
}

init();
