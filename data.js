/**
 * WordSmart Data Bridge
 * Transforms sourceData.js (vocabList) into the app's VOCAB_DATA format.
 * Split: first 827 words → Word Smart 1, remaining → Word Smart 2
 *
 * Expected word shape from sourceData.js:
 *   { id, word, meaning, bangla_meanings[], sentences[], synonyms[] }
 *
 * Required app shape:
 *   { id, word, definition, bangla, phrases[] }
 */
(function buildVocabData() {
  const SPLIT = 827; // WS1 gets words 0..826, WS2 gets 827..end

  function transform(entry, book) {
    return {
      id:         `${book}_${entry.id}`,
      word:       capitalize(entry.word),
      definition: entry.meaning,
      bangla:     (entry.bangla_meanings || []).join('; ') || '—',
      phrases:    (entry.sentences || []).slice(0, 3),
    };
  }

  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  window.VOCAB_DATA = {
    ws1: vocabList.slice(0, SPLIT).map(e => transform(e, 'ws1')),
    ws2: vocabList.slice(SPLIT).map(e => transform(e, 'ws2')),
  };
})();
