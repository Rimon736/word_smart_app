/* ================================================================
   WordSmart App — Application Logic
   State management with localStorage persistence
   ================================================================ */

// ---- STATE ----
const STATE = {
  book: 'ws1',         // 'ws1' | 'ws2'
  index: 0,            // current card index
  view: 'flashcard',   // 'flashcard' | 'list'
  flipped: false,
  covered: {           // { [wordId]: true }
    ws1: {},
    ws2: {}
  },
  order: {             // shuffled indices per book
    ws1: [],
    ws2: []
  }
};

// ---- PERSISTENCE ----
const STORAGE_KEY = 'wordsmart_v1';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.covered) STATE.covered = saved.covered;
    if (saved.index)   STATE.index   = { ws1: 0, ws2: 0, ...saved.index };
    if (saved.book)    STATE.book    = saved.book;
    if (saved.theme)   document.documentElement.setAttribute('data-theme', saved.theme);
  } catch(e) { console.warn('State load error', e); }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      covered: STATE.covered,
      index:   { ws1: STATE.index, ws2: STATE.index },   // simplified; see below
      book:    STATE.book,
      theme:   document.documentElement.getAttribute('data-theme')
    }));
  } catch(e) {}
}

// Per-book index tracking
const BOOK_INDEX = { ws1: 0, ws2: 0 };

function saveFullState() {
  try {
    BOOK_INDEX[STATE.book] = STATE.index;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      covered:    STATE.covered,
      bookIndex:  BOOK_INDEX,
      book:       STATE.book,
      theme:      document.documentElement.getAttribute('data-theme')
    }));
  } catch(e) {}
}

function loadFullState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.covered)   STATE.covered   = saved.covered;
    if (saved.book)      STATE.book      = saved.book;
    if (saved.bookIndex) {
      BOOK_INDEX.ws1 = saved.bookIndex.ws1 || 0;
      BOOK_INDEX.ws2 = saved.bookIndex.ws2 || 0;
    }
    if (saved.theme) document.documentElement.setAttribute('data-theme', saved.theme);
  } catch(e) { console.warn('State load error', e); }
}

// ---- HELPERS ----
function currentData() { return VOCAB_DATA[STATE.book]; }
function currentWord()  { return currentData()[STATE.order[STATE.book][STATE.index]]; }

function initOrder(book) {
  STATE.order[book] = Array.from({ length: VOCAB_DATA[book].length }, (_, i) => i);
}

// ---- DOM REFS ----
const $ = id => document.getElementById(id);

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
  progressGlow: $('progress-glow'),
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
  toast:        $('toast'),
  prevBtn:      $('prev-btn'),
  nextBtn:      $('next-btn'),
};

// ---- RENDER CARD ----
function renderCard() {
  const word = currentWord();
  if (!word) return;

  // Update front
  EL.cardWord.textContent = word.word;
  EL.cardBadge.textContent = STATE.book === 'ws1' ? 'Word Smart 1' : 'Word Smart 2';

  // Update back
  EL.backDef.textContent    = word.definition;
  EL.backBangla.textContent = word.bangla;
  EL.backPhrases.innerHTML  = word.phrases.map(p => `<li>${escHtml(p)}</li>`).join('');

  // Counter
  EL.cardIndex.textContent = STATE.index + 1;
  EL.cardTotal.textContent = currentData().length;

  // Covered state
  const isCovered = !!STATE.covered[STATE.book][word.id];
  EL.coveredBtn.classList.toggle('is-covered', isCovered);
  EL.coveredBtnTxt.textContent = isCovered ? '✓ Covered' : 'Mark as Covered';

  // Nav buttons
  EL.prevBtn.disabled = STATE.index === 0;
  EL.nextBtn.disabled = STATE.index === currentData().length - 1;

  // Ensure not flipped on new card
  if (STATE.flipped) {
    STATE.flipped = false;
    EL.cardBody.classList.remove('flipped');
  }

  // Pulse animation
  EL.cardWord.classList.remove('card-word-anim');
  void EL.cardWord.offsetWidth;
  EL.cardWord.classList.add('card-word-anim');

  updateProgress();
  saveFullState();
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---- PROGRESS ----
function updateProgress() {
  const total   = currentData().length;
  const covered = Object.keys(STATE.covered[STATE.book]).length;
  const pct     = total ? Math.round((covered / total) * 100) : 0;
  EL.progressFill.style.width = pct + '%';
  EL.progressGlow.style.width = pct + '%';
  EL.progressPct.textContent  = pct + '%';
  EL.progressCount.textContent = `${covered} / ${total} words covered`;
}

// ---- FLIP ----
function flipCard() {
  STATE.flipped = !STATE.flipped;
  EL.cardBody.classList.toggle('flipped', STATE.flipped);
}

// ---- NAVIGATE ----
function navigate(dir) {
  const newIdx = STATE.index + dir;
  const len = currentData().length;
  if (newIdx < 0 || newIdx >= len) return;
  STATE.index = newIdx;
  BOOK_INDEX[STATE.book] = newIdx;
  renderCard();
}

// ---- MARK COVERED ----
function markCovered() {
  const word = currentWord();
  if (!word) return;
  const wasCovered = !!STATE.covered[STATE.book][word.id];
  if (wasCovered) {
    delete STATE.covered[STATE.book][word.id];
    showToast(`"${word.word}" removed from covered list`);
  } else {
    STATE.covered[STATE.book][word.id] = true;
    showToast(`"${word.word}" marked as covered! ✓`);
  }
  renderCard();
  // If list view is open, refresh it
  if (STATE.view === 'list') renderListView();
}

// ---- SWITCH BOOK ----
function switchBook(book) {
  if (STATE.book === book) return;
  BOOK_INDEX[STATE.book] = STATE.index;
  STATE.book = book;
  STATE.index = BOOK_INDEX[book] || 0;

  EL.tabWs1.classList.toggle('active', book === 'ws1');
  EL.tabWs2.classList.toggle('active', book === 'ws2');
  EL.tabWs1.setAttribute('aria-selected', book === 'ws1');
  EL.tabWs2.setAttribute('aria-selected', book === 'ws2');

  if (STATE.view === 'list') {
    renderListView();
  } else {
    renderCard();
  }
  updateProgress();
}

// ---- SHUFFLE ----
function shuffleCards() {
  const order = STATE.order[STATE.book];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  STATE.index = 0;
  BOOK_INDEX[STATE.book] = 0;
  showToast('Cards shuffled! 🔀');
  renderCard();
}

// ---- RESET PROGRESS ----
function resetProgress() {
  if (!confirm(`Reset all progress for Word Smart ${STATE.book === 'ws1' ? '1' : '2'}? This cannot be undone.`)) return;
  STATE.covered[STATE.book] = {};
  STATE.index = 0;
  BOOK_INDEX[STATE.book] = 0;
  initOrder(STATE.book);
  showToast('Progress reset!');
  renderCard();
  if (STATE.view === 'list') renderListView();
}

// ---- TOGGLE VIEW (Flashcard ↔ List) ----
function toggleView() {
  if (STATE.view === 'flashcard') {
    STATE.view = 'list';
    EL.flashcardView.classList.add('hidden');
    EL.listView.classList.remove('hidden');
    renderListView();
  } else {
    STATE.view = 'flashcard';
    EL.listView.classList.add('hidden');
    EL.flashcardView.classList.remove('hidden');
  }
}

// ---- RENDER LIST VIEW ----
function renderListView() {
  const coveredIds = STATE.covered[STATE.book];
  const allData    = VOCAB_DATA[STATE.book];
  const entries    = allData.filter(w => coveredIds[w.id]);

  EL.listStats.textContent = `${entries.length} word${entries.length !== 1 ? 's' : ''} mastered`;
  EL.coveredEmpty.classList.toggle('hidden', entries.length > 0);

  if (entries.length === 0) {
    EL.coveredList.innerHTML = '';
    return;
  }

  const bookLabel = STATE.book === 'ws1' ? 'WS1' : 'WS2';
  EL.coveredList.innerHTML = entries.map(w => `
    <div class="covered-card" onclick="goToCard('${w.id}')" role="button" tabindex="0"
         aria-label="Go to flashcard for ${escHtml(w.word)}"
         onkeydown="if(event.key==='Enter')goToCard('${w.id}')">
      <span class="covered-card-badge badge-${STATE.book}">${bookLabel}</span>
      <div class="covered-card-word">${escHtml(w.word)}</div>
      <div class="covered-card-def">${escHtml(w.definition)}</div>
      <div class="covered-card-goto">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        Open Flashcard
      </div>
    </div>
  `).join('');
}

// ---- GO TO CARD FROM LIST ----
function goToCard(wordId) {
  // Find which book this word belongs to
  let targetBook = null;
  let targetIdx  = -1;
  for (const [book, data] of Object.entries(VOCAB_DATA)) {
    const rawIdx = data.findIndex(w => w.id === wordId);
    if (rawIdx !== -1) {
      targetBook = book;
      // Find position in current order
      targetIdx  = STATE.order[book].indexOf(rawIdx);
      break;
    }
  }
  if (!targetBook || targetIdx === -1) return;

  // Switch to correct book if needed
  if (STATE.book !== targetBook) switchBook(targetBook);

  // Switch to flashcard view
  STATE.view = 'flashcard';
  EL.listView.classList.add('hidden');
  EL.flashcardView.classList.remove('hidden');

  // Navigate to card
  STATE.index = targetIdx;
  BOOK_INDEX[targetBook] = targetIdx;
  renderCard();

  showToast(`Jumped to "${currentWord().word}" ✦`);
}

// ---- THEME TOGGLE ----
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  saveFullState();
  showToast(isDark ? 'Light mode activated ☀️' : 'Dark mode activated 🌙');
}

// ---- TOAST ----
let toastTimer = null;
function showToast(msg) {
  EL.toast.textContent = msg;
  EL.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => EL.toast.classList.remove('show'), 2500);
}

// ---- KEYBOARD SHORTCUTS ----
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (STATE.view !== 'flashcard') return;
  switch(e.key) {
    case 'ArrowLeft':  navigate(-1); break;
    case 'ArrowRight': navigate(1);  break;
    case ' ':
    case 'Enter':      e.preventDefault(); flipCard(); break;
    case 'c': case 'C': markCovered(); break;
    case '1': switchBook('ws1'); break;
    case '2': switchBook('ws2'); break;
    case 't': case 'T': toggleTheme(); break;
    case 'v': case 'V': toggleView(); break;
  }
});

// ---- INIT ----
function init() {
  // Initialize order arrays (sequential, not shuffled)
  initOrder('ws1');
  initOrder('ws2');

  // Load persisted state
  loadFullState();

  // Restore current book index
  STATE.index = BOOK_INDEX[STATE.book] || 0;

  // Sync tabs
  EL.tabWs1.classList.toggle('active', STATE.book === 'ws1');
  EL.tabWs2.classList.toggle('active', STATE.book === 'ws2');
  EL.tabWs1.setAttribute('aria-selected', STATE.book === 'ws1');
  EL.tabWs2.setAttribute('aria-selected', STATE.book === 'ws2');

  // Render first card
  renderCard();
}

// Kick off
init();
