/* Korean alphabet flashcards — vanilla JS, no build step.
   Card: tap = play pronunciation, swipe right = good, swipe left = bad. */
(() => {
  const D = window.DECK;
  if (!D) { document.body.innerHTML = '<p style="padding:24px">data.js missing — run build_deck.py</p>'; return; }

  const $ = (id) => document.getElementById(id);
  const el = {
    card: $('card'), glyph: $('glyph'), rom: $('rom'), hint: $('cardHint'),
    verdictGood: $('verdictGood'), verdictBad: $('verdictBad'),
    progressFill: $('progressFill'), progressText: $('progressText'),
    grid: $('grid'), study: $('study'), footInfo: $('footInfo'), scoreInfo: $('scoreInfo'),
    viewBtn: $('viewBtn'), romBtn: $('romBtn'), shuffleBtn: $('shuffleBtn'),
    orderBtn: $('orderBtn'), resetBtn: $('resetBtn'),
  };
  /* A cached page can be older than app.js (GitHub Pages caches HTML for 10 min),
     so a control may be missing: never let that throw and kill the boot. */
  const mark = (btn, on) => { if (btn) btn.classList.toggle('on', on); };

  const LS = 'hangul-flash-v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } };
  const saved = load();

  const state = {
    deck: saved.deck === 'jamo' ? 'jamo' : 'syllables',
    order: [],
    pos: 0,
    // defaults: romanization hidden, order shuffled
    showRom: saved.showRom === true,
    orderMode: saved.orderMode === 'original' ? 'original' : 'shuffle',
    view: 'card',
    seen: new Set(Array.isArray(saved.seen) ? saved.seen : []),
    ratings: (saved.ratings && typeof saved.ratings === 'object') ? saved.ratings : {},
  };

  const persist = () => {
    try {
      localStorage.setItem(LS, JSON.stringify({
        deck: state.deck, showRom: state.showRom, orderMode: state.orderMode,
        seen: [...state.seen], ratings: state.ratings,
      }));
    } catch (err) {
      if (window.console) console.warn('hangul-flash: progress not saved — storage blocked?', err);
    }
  };

  const cardsFor = (deck) => deck === 'jamo' ? D.jamo : D.syllables;
  const deckIsJamo = () => state.deck === 'jamo';
  const idOf = (card) => state.deck + ':' + card.k;

  /* ---------- audio ---------- */
  const player = new Audio();
  player.preload = 'auto';

  function speakFallback(text) {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    u.rate = 0.85;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  function play(card) {
    if (!card) return;
    markSeen(card);
    flashPlaying(card);
    const src = 'audio/' + card.k + '.mp3';
    if (!player.src.endsWith('/' + src)) player.src = src;
    else player.currentTime = 0;
    const p = player.play();
    if (p && p.catch) {
      p.catch((err) => {
        if (err && err.name === 'AbortError') return;   // a newer card interrupted this one
        speakFallback(deckIsJamo() ? card.name : card.ch);
      });
    }
  }

  let flashTimer = null;
  function flashPlaying(card) {
    el.card.classList.add('speaking');
    document.querySelectorAll('.tile.playing').forEach(t => t.classList.remove('playing'));
    if (state.view === 'grid') {
      const t = el.grid.querySelector('[data-key="' + card.k + '"]');
      if (t) t.classList.add('playing');
    }
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      el.card.classList.remove('speaking');
      document.querySelectorAll('.tile.playing').forEach(t => t.classList.remove('playing'));
    }, 900);
  }

  /* ---------- order ---------- */
  /* 'original' = teaching order. Syllables run group by group (ㄱ, ㄲ, ㄴ …) and
     inside a group the ten plain vowels come first (ㅏ ㅑ ㅓ ㅕ ㅗ ㅛ ㅜ ㅠ ㅡ ㅣ),
     then the derived ones (ㅐ ㅒ ㅔ ㅖ ㅘ ㅙ ㅚ ㅝ ㅞ ㅟ ㅢ) — 가 갸 거 겨 고 교 구 규 그 기 개 걔 게 계 …
     Jamo keep the alphabet's own order: ㄱㄲㄴㄷ… then ㅏㅐㅑ… */
  const vowelRank = {};
  const DEFAULT_VOWEL_ORDER = [
    'ㅏ', 'ㅑ', 'ㅓ', 'ㅕ', 'ㅗ', 'ㅛ', 'ㅜ', 'ㅠ', 'ㅡ', 'ㅣ',
    'ㅐ', 'ㅒ', 'ㅔ', 'ㅖ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅢ',
  ];
  ((D.meta && D.meta.vowelOrder) || DEFAULT_VOWEL_ORDER).forEach((v, i) => { vowelRank[v] = i; });
  const vRank = (c) => (vowelRank[c.vow] != null ? vowelRank[c.vow] : 99);

  const orderedCache = {};
  function orderedCards() {
    let list = orderedCache[state.deck];
    if (!list) {
      list = cardsFor(state.deck).slice();
      if (!deckIsJamo()) list.sort((a, b) => (a.group - b.group) || (vRank(a) - vRank(b)));
      orderedCache[state.deck] = list;
    }
    return list.slice();
  }

  function buildOrder() {
    state.order = orderedCards();
    state.pos = 0;
  }

  function shuffleOrder() {
    for (let i = state.order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.order[i], state.order[j]] = [state.order[j], state.order[i]];
    }
    state.pos = 0;
    // a shuffle that happens to come out sorted would look like "it never shuffled"
    const sorted = orderedCards();
    if (state.order.length > 1 && state.order.every((c, i) => c === sorted[i])) {
      state.order.push(state.order.shift());
    }
  }

  function setOrder(mode) {
    state.orderMode = mode === 'original' ? 'original' : 'shuffle';
    buildOrder();
    if (state.orderMode === 'shuffle') shuffleOrder();
    mark(el.shuffleBtn, state.orderMode === 'shuffle');
    mark(el.orderBtn, state.orderMode === 'original');
    persist();
    render();
  }

  function step(delta) {
    if (!state.order.length) return;
    state.pos = (state.pos + delta + state.order.length) % state.order.length;
    render();
  }

  /* ---------- progress / score ---------- */
  function markSeen(card) {
    const id = idOf(card);
    if (!state.seen.has(id)) { state.seen.add(id); persist(); updateProgress(); updateScore(); }
    const tile = el.grid.querySelector('[data-key="' + card.k + '"]');
    if (tile) tile.classList.add('seen');
  }

  function updateProgress() {
    const all = cardsFor(state.deck);
    const n = all.filter(c => state.seen.has(idOf(c))).length;
    el.progressFill.style.width = (all.length ? (n / all.length) * 100 : 0).toFixed(1) + '%';
    el.progressText.textContent = n + ' / ' + all.length + ' seen';
  }

  function updateScore() {
    const all = cardsFor(state.deck);
    let good = 0, bad = 0;
    for (const c of all) {
      const r = state.ratings[idOf(c)];
      if (r === 'good') good++;
      else if (r === 'bad') bad++;
    }
    el.scoreInfo.textContent = '✓ ' + good + '  ✗ ' + bad;
  }

  /* ---------- rendering ---------- */
  const currentCard = () => state.order[state.pos];

  function render() {
    const card = currentCard();
    if (!card) return;
    el.glyph.textContent = card.ch;
    el.rom.textContent = deckIsJamo()
      ? card.name + '  ·  ' + card.rom
      : card.rom + (card.ini && card.vow ? '  ·  ' + card.ini + ' + ' + card.vow : '');
    el.rom.classList.toggle('show', state.showRom);
    el.card.classList.toggle('no-rom', !state.showRom);
    el.footInfo.textContent = deckIsJamo()
      ? '자모 ' + D.meta.jamoCount + ' · 자음 19 + 모음 21'
      : '음절 ' + D.meta.syllableCount + ' · 19 initials × 21 vowels';
    updateScore();
    if (state.view === 'grid') renderGrid();
  }

  function renderGrid() {
    el.grid.innerHTML = state.order.map(c => {
      const seen = state.seen.has(idOf(c));
      const r = state.ratings[idOf(c)];
      const cls = 'tile' + (seen ? ' seen' : '') + (r === 'good' ? ' good' : r === 'bad' ? ' bad' : '');
      return '<button class="' + cls + '" data-key="' + c.k + '">' + c.ch +
        '<small>' + c.rom + '</small></button>';
    }).join('');
  }

  function setView(v) {
    state.view = v;
    const grid = v === 'grid';
    el.study.classList.toggle('hidden', grid);
    el.grid.classList.toggle('hidden', !grid);
    el.viewBtn.textContent = grid ? '▣ Card' : '▦ Grid';
    if (grid) renderGrid();
  }

  /* ---------- swipe gestures ---------- */
  const THRESHOLD = 88;      // px of horizontal travel that grades the card
  let drag = null;
  let suppressClick = false;

  function applyDrag(dx) {
    const rot = Math.max(-16, Math.min(16, dx / 24));
    el.card.style.transform = 'translateX(' + dx + 'px) rotate(' + rot + 'deg)';
    el.card.style.opacity = String(1 - Math.min(1, Math.abs(dx) / 700) * 0.35);
    el.verdictGood.style.opacity = dx > 0 ? String(Math.min(1, dx / THRESHOLD)) : '0';
    el.verdictBad.style.opacity = dx < 0 ? String(Math.min(1, -dx / THRESHOLD)) : '0';
  }

  function resetDrag() {
    el.card.style.transform = '';
    el.card.style.opacity = '';
    el.card.style.transition = '';
    el.verdictGood.style.opacity = '0';
    el.verdictBad.style.opacity = '0';
    el.card.classList.remove('good', 'bad');
  }

  function rate(card, verdict) {
    if (!card) return;
    state.ratings[idOf(card)] = verdict;
    state.seen.add(idOf(card));
    persist();
    updateProgress();
    updateScore();
    const tile = el.grid.querySelector('[data-key="' + card.k + '"]');
    if (tile) tile.classList.add(verdict);

    const dir = verdict === 'good' ? 1 : -1;
    el.card.classList.add(verdict);
    el.card.style.transition = 'transform .24s cubic-bezier(.3,0,.6,1), opacity .24s';
    el.card.style.transform = 'translateX(' + dir * 140 + '%) rotate(' + dir * 14 + 'deg)';
    el.card.style.opacity = '0';
    setTimeout(() => {
      el.card.classList.remove('good', 'bad');
      el.card.style.transition = 'none';
      el.card.style.transform = '';
      el.card.style.opacity = '';
      step(1);
      resetDrag();
      void el.card.offsetWidth;      // commit the reset before transitions resume
      el.card.style.transition = '';
    }, 250);
  }

  el.card.addEventListener('pointerdown', (e) => {
    if (state.view !== 'card') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, moved: false };
    suppressClick = false;
    el.card.style.transition = 'none';
    try { el.card.setPointerCapture(e.pointerId); } catch {}
  });

  el.card.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) drag.moved = true;
    if (!drag.moved) return;
    drag.dx = dx;
    applyDrag(dx);
  });

  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const { dx, moved } = drag;
    drag = null;
    if (moved) {
      suppressClick = true;
      el.card.style.transition = '';
      if (Math.abs(dx) > THRESHOLD) rate(currentCard(), dx > 0 ? 'good' : 'bad');
      else resetDrag();
    } else {
      el.card.style.transition = '';
      resetDrag();
    }
  }

  el.card.addEventListener('pointerup', endDrag);
  el.card.addEventListener('pointercancel', endDrag);

  el.card.addEventListener('click', () => {
    if (suppressClick) { suppressClick = false; return; }
    play(currentCard());
  });

  /* ---------- UI wiring ---------- */
  document.querySelectorAll('.deck-switch button').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.deck === state.deck) return;
      state.deck = btn.dataset.deck;
      document.querySelectorAll('.deck-switch button').forEach(b => b.classList.toggle('on', b === btn));
      updateProgress();
      setOrder(state.orderMode);   // keep whatever order the user picked
    });
  });

  if (el.shuffleBtn) el.shuffleBtn.addEventListener('click', () => setOrder('shuffle'));
  if (el.orderBtn) el.orderBtn.addEventListener('click', () => setOrder('original'));
  el.viewBtn.addEventListener('click', () => setView(state.view === 'grid' ? 'card' : 'grid'));
  el.romBtn.addEventListener('click', () => {
    state.showRom = !state.showRom;
    el.romBtn.classList.toggle('on', state.showRom);
    persist();
    render();
  });

  el.resetBtn.addEventListener('click', () => {
    const ok = window.confirm(
      'Clear all progress?\n\nThis forgets every card you have seen and every good/bad rating, for both decks. It cannot be undone.'
    );
    if (!ok) return;
    state.seen.clear();
    state.ratings = {};
    try { localStorage.removeItem(LS); } catch {}
    persist();                                     // write the cleared state back
    el.grid.querySelectorAll('.tile').forEach(t => t.classList.remove('seen', 'good', 'bad'));
    el.card.classList.remove('good', 'bad');
    updateProgress();
    updateScore();
    render();
  });

  el.grid.addEventListener('click', (e) => {
    const t = e.target.closest('.tile');
    if (!t) return;
    const card = state.order.find(c => c.k === t.dataset.key);
    if (card) play(card);
  });

  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && t.matches && t.matches('input,textarea,select')) return;
    switch (e.key) {
      case ' ': case 'Enter': e.preventDefault(); play(currentCard()); break;
      case 'ArrowRight': e.preventDefault(); step(1); break;
      case 'ArrowLeft': e.preventDefault(); step(-1); break;
      case 'l': case 'L': rate(currentCard(), 'good'); break;
      case 'h': case 'H': rate(currentCard(), 'bad'); break;
      case 'r': case 'R': setOrder('shuffle'); break;
      case 'o': case 'O': setOrder('original'); break;
      case 'g': case 'G': setView(state.view === 'grid' ? 'card' : 'grid'); break;
      case 's': case 'S': el.romBtn.click(); break;
    }
  });

  /* ---------- boot ---------- */
  document.querySelectorAll('.deck-switch button').forEach(b => b.classList.toggle('on', b.dataset.deck === state.deck));
  mark(el.romBtn, state.showRom);
  setOrder(state.orderMode);        // default: shuffled
  updateProgress();
  resetDrag();
  const warm = new Audio();
  warm.preload = 'auto';
  warm.src = 'audio/' + state.order[0].k + '.mp3';

  /* Restoring the page from the back/forward cache does not re-run this script,
     so the old card would stay on screen. Re-deal it to match a real reload. */
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    setOrder(state.orderMode);
    updateProgress();
  });
})();
