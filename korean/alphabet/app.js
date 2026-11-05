/* Korean alphabet flashcards — vanilla JS, no build step. */
(() => {
  const D = window.DECK;
  if (!D) { document.body.innerHTML = '<p style="padding:24px">data.js missing — run build_deck.py</p>'; return; }

  const $ = (id) => document.getElementById(id);
  const el = {
    card: $('card'), glyph: $('glyph'), rom: $('rom'), hint: $('cardHint'),
    counter: $('counter'), chips: $('chips'), progressFill: $('progressFill'),
    progressText: $('progressText'), grid: $('grid'), study: $('study'),
    footInfo: $('footInfo'), viewBtn: $('viewBtn'), romBtn: $('romBtn'), shuffleBtn: $('shuffleBtn'),
    prevBtn: $('prevBtn'), playBtn: $('playBtn'), nextBtn: $('nextBtn'),
  };

  const LS = 'hangul-flash-v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } };
  const saved = load();

  const state = {
    deck: saved.deck === 'jamo' ? 'jamo' : 'syllables',
    filter: 'all',
    order: [],
    pos: 0,
    showRom: saved.showRom !== false,
    view: 'card',
    seen: new Set(Array.isArray(saved.seen) ? saved.seen : []),
  };

  const persist = () => {
    try { localStorage.setItem(LS, JSON.stringify({ deck: state.deck, showRom: state.showRom, seen: [...state.seen] })); } catch {}
  };

  const cardsFor = (deck) => deck === 'jamo' ? D.jamo : D.syllables;
  const labelFor = (card) => deckIsJamo() ? card.name : card.rom;
  const deckIsJamo = () => state.deck === 'jamo';

  /* ---------- audio ---------- */
  const player = new Audio();
  player.preload = 'auto';
  let playingKey = null;

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
    playingKey = card.k;
    markSeen(card);
    flashPlaying(card);
    const src = 'audio/' + card.k + '.mp3';
    if (!player.src.endsWith('/' + src)) player.src = src;
    else player.currentTime = 0;
    const p = player.play();
    if (p && p.catch) {
      p.catch((err) => {
        // AbortError = a newer card interrupted this one; not a failure
        if (err && err.name === 'AbortError') return;
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

  /* ---------- ordering / filtering ---------- */
  function buildOrder() {
    let list = cardsFor(state.deck).slice();
    if (state.filter !== 'all') {
      if (deckIsJamo()) list = list.filter(c => (state.filter === 'consonant' ? c.kind === 'consonant' : c.kind === 'vowel'));
      else list = list.filter(c => c.group === state.filter);
    }
    state.order = list;
    state.pos = 0;
  }

  function shuffleOrder() {
    for (let i = state.order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.order[i], state.order[j]] = [state.order[j], state.order[i]];
    }
    state.pos = 0;
  }

  /* ---------- seen / progress ---------- */
  function markSeen(card) {
    const id = state.deck + ':' + card.k;
    if (!state.seen.has(id)) { state.seen.add(id); persist(); updateProgress(); }
    const tile = el.grid.querySelector('[data-key="' + card.k + '"]');
    if (tile) tile.classList.add('seen');
    el.glyph.classList.add('seen-once');
  }

  function updateProgress() {
    const all = cardsFor(state.deck);
    const n = all.filter(c => state.seen.has(state.deck + ':' + c.k)).length;
    const pct = all.length ? (n / all.length) * 100 : 0;
    el.progressFill.style.width = pct.toFixed(1) + '%';
    el.progressText.textContent = n + ' / ' + all.length + ' seen';
  }

  /* ---------- rendering ---------- */
  function currentCard() { return state.order[state.pos]; }

  function render() {
    const card = currentCard();
    if (!card) return;
    el.glyph.textContent = card.ch;
    el.rom.textContent = deckIsJamo()
      ? card.name + '  ·  ' + card.rom
      : card.rom + (card.ini && card.vow ? '  ·  ' + card.ini + ' + ' + card.vow : '');
    el.rom.classList.toggle('show', state.showRom);
    el.card.classList.toggle('no-rom', !state.showRom);
    el.counter.textContent = (state.pos + 1) + ' / ' + state.order.length;
    el.hint.textContent = state.showRom ? 'click to play' : 'click to play · romanization hidden';
    el.footInfo.textContent = deckIsJamo()
      ? '자모 ' + D.meta.jamoCount + ' · 자음 19 + 모음 21'
      : '음절 ' + D.meta.syllableCount + ' · 19 initials × 21 vowels';
    if (state.view === 'grid') renderGrid();
  }

  function renderChips() {
    const chips = [];
    chips.push('<button class="chip' + (state.filter === 'all' ? ' on' : '') + '" data-f="all">All ' + cardsFor(state.deck).length + '</button>');
    if (deckIsJamo()) {
      chips.push('<button class="chip' + (state.filter === 'consonant' ? ' on' : '') + '" data-f="consonant">자음 consonants</button>');
      chips.push('<button class="chip' + (state.filter === 'vowel' ? ' on' : '') + '" data-f="vowel">모음 vowels</button>');
    } else {
      D.groups.forEach((g, i) => {
        chips.push('<button class="chip' + (state.filter === i ? ' on' : '') + '" data-f="' + i + '">' + g.ini + '</button>');
      });
    }
    el.chips.innerHTML = chips.join('');
  }

  function renderGrid() {
    const html = state.order.map(c => {
      const seen = state.seen.has(state.deck + ':' + c.k);
      const sub = deckIsJamo() ? c.rom : c.rom;
      return '<button class="tile' + (seen ? ' seen' : '') + '" data-key="' + c.k + '">' + c.ch +
        '<small>' + sub + '</small></button>';
    }).join('');
    el.grid.innerHTML = html;
  }

  function setView(v) {
    state.view = v;
    const grid = v === 'grid';
    el.study.classList.toggle('hidden', grid);
    el.grid.classList.toggle('hidden', !grid);
    el.viewBtn.textContent = grid ? '▣ Card' : '▦ Grid';
    if (grid) renderGrid();
  }

  /* ---------- navigation ---------- */
  function step(delta) {
    if (!state.order.length) return;
    state.pos = (state.pos + delta + state.order.length) % state.order.length;
    render();
  }

  /* ---------- events ---------- */
  el.card.addEventListener('click', () => play(currentCard()));
  el.playBtn.addEventListener('click', () => play(currentCard()));
  el.nextBtn.addEventListener('click', () => step(1));
  el.prevBtn.addEventListener('click', () => step(-1));

  el.chips.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    const f = b.dataset.f;
    state.filter = f === 'all' ? 'all' : (f === 'consonant' || f === 'vowel') ? f : Number(f);
    renderChips();
    buildOrder();
    render();
  });

  document.querySelectorAll('.deck-switch button').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.deck === state.deck) return;
      state.deck = btn.dataset.deck;
      state.filter = 'all';
      document.querySelectorAll('.deck-switch button').forEach(b => b.classList.toggle('on', b === btn));
      persist();
      renderChips();
      buildOrder();
      updateProgress();
      render();
    });
  });

  el.shuffleBtn.addEventListener('click', () => { shuffleOrder(); render(); });
  el.viewBtn.addEventListener('click', () => setView(state.view === 'grid' ? 'card' : 'grid'));
  el.romBtn.addEventListener('click', () => {
    state.showRom = !state.showRom;
    el.romBtn.classList.toggle('on', state.showRom);
    persist();
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
      case 'r': case 'R': shuffleOrder(); render(); break;
      case 'g': case 'G': setView(state.view === 'grid' ? 'card' : 'grid'); break;
      case 's': case 'S': el.romBtn.click(); break;
    }
  });

  /* ---------- boot ---------- */
  document.querySelectorAll('.deck-switch button').forEach(b => b.classList.toggle('on', b.dataset.deck === state.deck));
  el.romBtn.classList.toggle('on', state.showRom);
  renderChips();
  buildOrder();
  updateProgress();
  render();
  // warm the first few audio files
  ['audio/' + state.order[0].k + '.mp3'].forEach(src => { const a = new Audio(); a.preload = 'auto'; a.src = src; });
})();
