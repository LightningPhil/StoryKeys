# Speech output options for StoryKeys

## Problem recap
The current Read Aloud and Say word features use the browser SpeechSynthesis API. On many systems the first part of an utterance fades in quietly, then reaches full volume. That fade-in is long enough to make single words hard to hear.

## Why this happens with browser TTS
- SpeechSynthesis is implemented by the browser and the OS voice engine. Many engines apply an automatic fade-in to prevent clicks when playback starts.
- The first utterance often triggers voice loading and audio device warm-up, which can also reduce initial volume.
- The Web Speech API does not expose the raw audio stream, so you cannot apply compression or gain after synthesis.

## Options for clearer speech

### 1) Stay in-browser, improve SpeechSynthesis behavior (short-term fix)
Goal: push the fade-in to a harmless point and make single-word playback more reliable.
- Warm up once per session after a user gesture:
  - Call `speechSynthesis.getVoices()` and select the voice early.
  - Speak a short dummy utterance at very low volume, then cancel it. The fade-in is consumed by the dummy instead of the real word.
- Add a tiny pre-roll utterance (for example, a short pause or a soft beep) before each word, so the word lands after the fade.
- Optionally repeat the word (word, short pause, word) for single-word prompts.
- Keep the engine alive by avoiding long idle gaps (a periodic silent utterance). This can reduce re-warmups.

Pros:
- Minimal code changes.
- No extra assets or build steps.

Cons:
- Still depends on browser and OS quirks.
- Volume consistency is not guaranteed across devices.

### 2) Pre-generated audio assets (medium-term, high clarity)
Goal: avoid live synthesis entirely for spelling lists.
- Generate audio files offline for each spelling word using a consistent voice and loudness normalization.
- Store them as `data/audio/words/<word>.mp3` (or per-list packs) and play with Web Audio or `<audio>`.
- Word sets are curated and finite, so asset size is manageable.

Pros:
- Stable volume and clarity for short words.
- No fade-in artifacts.
- Works offline.

Cons:
- Requires a build step to generate audio.
- Asset size increases (estimate: thousands of words -> tens of MB).
- Less flexible if you want dynamic voice changes.

### 3) Native TTS in a desktop wrapper (long-term, best control)
Goal: use OS-level TTS with full control from a packaged app.
- If StoryKeys becomes an Electron or Tauri app, you can call Windows SAPI (or macOS NSSpeechSynthesizer) directly.
- You can also generate audio on the fly and normalize it before playback.

Pros:
- High quality, consistent output.
- Better control over voice, rate, and volume.

Cons:
- Requires a native wrapper and additional plumbing.
- Not available in a pure browser app.

### 4) Local TTS service (advanced)
Goal: keep the UI in the browser but run a local TTS process.
- A small local server generates audio on demand and returns files.
- This can use high quality voices and normalization.

Pros:
- Consistent output without shipping huge assets.

Cons:
- More complex installation and permissions.
- Harder to distribute to non-technical users.

## Recommendation for StoryKeys
Given this is desktop-only but currently browser-based:
1) Short term: implement a warm-up utterance and a pre-roll (dummy utterance or soft beep) so single words are audible. This is the lowest risk change and keeps the current UX.
2) Medium term: pre-generate audio for spelling words. This will give the clearest, most consistent results for the recall mode, and is practical because the word lists are curated.
3) Long term: if you move to a packaged desktop app, switch to native TTS for real control.

## Notes specific to Say word
- Disable the button while speech is playing, and only unlock input after speech ends.
- If you keep SpeechSynthesis, consider repeating the word once for clarity.
- If you use pre-generated audio, normalize loudness so every word is equally clear.
