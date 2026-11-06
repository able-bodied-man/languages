# 한글 Flash — Korean alphabet flashcards

A self-contained flashcard webapp for Korean single characters. Click a card and it
speaks: every card has its own MP3, so it works offline once the folder is on your
machine — no API keys, no network, no build step to view.

## Decks

| Deck | Cards | What |
|---|---|---|
| **음절 syllables** | **399** | every modern Hangul CV block = 19 initial consonants × 21 vowels (가, 개, 갸 … 히). No final consonants (받침). |
| **자모 jamo** | **40** | the alphabet itself: 19 consonants + 21 vowels, spoken as their letter names (기역, 니은 …) |

Pronunciation is the syllable itself; romanization is Revised Romanization (`가 → ga`,
`아 → a`, `쌰 → ssya`). All 399 syllables have a distinct romanization.

## Use it

Open `index.html` in a browser. For local audio to behave everywhere, serve the folder:

```bash
python3 -m http.server 8765   # then open http://127.0.0.1:8765/
```

**Controls**

- **Tap the card** — plays the pronunciation and marks it seen
- **Swipe right = good (알아요) · swipe left = bad (몰라요)** — grades the card, then flies it out and deals the next one
- **⇄ Shuffle / 가나다 Original** — shuffle the deck, or put it back in Korean order
  (syllables → 가나다, jamo → ㄱㄲㄴㄷ… then ㅏㅐㅑ…). The choice sticks across reloads.
- `space` — replay · `←` `→` — previous / next · `h` / `l` — grade bad / good
- `r` — shuffle · `o` — original order · `g` — grid of all cards (tiles keep their ✓/✗) · `s` — show/hide romanization
- Starts **shuffled, romanization hidden**. Seen count and good/bad grades are saved in
  `localStorage` per browser (footer shows the running ✓/✗ tally).

## Files

```
index.html      markup
style.css       dark card UI, mobile-first
app.js          deck logic, audio playback, keyboard, progress
data.js         generated: 399 syllables + 40 jamo with romanizations
audio/          439 MP3s — sNNN.mp3 (syllable) and jNN.mp3 (jamo)
font/           hangul-flash.woff2 — 61 KB subset font, so Hangul renders even on a
                machine with no Korean system font
build_deck.py   regenerates data.js + audio/
```

Audio: **edge-tts**, voice `ko-KR-SunHiNeural`, ~11 KB per card, ~5.2 MB total.

## Regenerate the audio / data

```bash
python3 -m pip install --target ./pylibs edge-tts   # or pip install edge-tts
PYTHONPATH=./pylibs python3 build_deck.py           # --voice ko-KR-InJoonNeural for the male voice
```

`build_deck.py` is idempotent — existing MP3s are skipped unless `--force`;
`--no-audio` rewrites `data.js` only.
