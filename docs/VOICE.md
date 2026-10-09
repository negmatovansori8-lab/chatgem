# Voice Mode

A hands-free voice conversation inside the chat. The user speaks in any language,
the assistant answers **in the same language** — by voice and as text in the same
chat history (Tajik → Tajik, Russian → Russian, English → English, …).

Open it with the waveform button next to the chat input, or go to `/app/voice`
(redirects to `/app/chat?voice=1`).

## Setup

All keys live in `.env` on the server. The browser never sees them — it only talks
to this app's own `/api/voice/*` routes, which call the providers.

| Variable | Needed for |
| --- | --- |
| `OPENAI_API_KEY` | Speech recognition **and** natural AI voice (recommended) |
| `GROQ_API_KEY` | Fast, free-tier speech recognition (Whisper) |

- **OpenAI key only** — everything works (recognition + natural voice).
- **Groq key only** — recognition works; answers are read with the device's built-in voices.
- **No key** — Voice Mode shows "speech recognition isn't configured" and nothing breaks.

Optional tuning (see `.env.example`):

```env
VOICE_STT_PROVIDER=auto        # auto (OpenAI → Groq) | openai | groq
VOICE_TTS_PROVIDER=auto        # auto | openai | browser (device voices, no TTS cost)
OPENAI_STT_MODELS=gpt-4o-mini-transcribe,gpt-4o-transcribe,whisper-1
GROQ_STT_MODELS=whisper-large-v3-turbo,whisper-large-v3
OPENAI_TTS_MODELS=gpt-4o-mini-tts,tts-1
OPENAI_TTS_VOICE=              # force one voice, e.g. alloy / nova / coral
```

Check the configuration at `GET /api/voice/status` (shows only which providers are
available — never the keys).

Microphones only work on **HTTPS** (or `http://localhost` during development).

## How it works

```
mic ─► voice detection (browser) ─► POST /api/voice/transcribe ─► STT provider
                                          │ text + detected language
                                          ▼
                     chat pipeline (/api/chat, same history, maps, images)
                                          │ streaming answer text (shown in chat)
                                          ▼
     sentence chunks ─► POST /api/voice/speech ─► TTS provider ─► audio stream ─► speaker
```

1. **Listening.** The browser measures loudness (Web Audio), learns the room's
   noise level and starts a recording when speech begins. About one second of
   silence ends it. Steady hums (fans, engines) are ignored.
2. **Speech → text.** The recording is proxied to OpenAI / Groq. The spoken language
   is detected from the text itself (Tajik letters and words, Russian, English,
   other scripts), because providers often mislabel Tajik as Russian or Persian.
   Silence, noise and typical Whisper hallucinations are dropped instead of
   being sent to the AI.
3. **AI.** The transcript goes through the normal chat request with a voice flag.
   The server tells the model to reply in the detected language, briefly, in plain
   spoken sentences (no markdown or links).
4. **Text → speech.** As the answer streams, it is split into sentences. The first
   short sentence starts playing almost immediately, and the next ones are fetched
   while the current one plays. Code blocks, tables and URLs are shown in the chat
   but never read aloud. If server TTS is not available, the device's voices are
   used (Tajik falls back to a Russian voice).
5. **Continuous conversation.** After the answer, the app listens again (auto
   listening). Talking while the assistant speaks interrupts it: the voice and the
   generation stop, and the new question is recorded.

The microphone is released when the conversation ends, after 60 seconds without
speech, or when the tab is hidden.

## Settings

Available in Voice Mode (gear icon) and in **Settings → Voice**. They are stored on
the device.

- Spoken replies on/off
- Auto listening on/off
- Interrupt by voice on/off
- Speed 0.75× / 1× / 1.25× / 1.5×
- Volume (on iPhone and iPad, use the hardware buttons — iOS ignores page volume)
- Language: Auto-detect or a fixed language

## Browser support

- **Desktop:** Chrome, Edge, Safari 14.1+, Firefox.
- **Mobile:** Chrome on Android, Safari on iPhone and iPad (iOS 14.5+). Audio is unlocked
  by the tap that opens Voice Mode, as iOS requires.

Errors are shown in the UI and never crash the page. They cover: microphone blocked or
missing or busy, insecure page, unsupported browser, network or timeout, speech
recognition, AI and voice playback failures, rate limits, and server errors.

## Code map

| Path | Role |
| --- | --- |
| `src/services/voice/` | STT / TTS provider adapters, provider selection from env |
| `src/app/api/voice/transcribe` | Audio → text + language (rate-limited) |
| `src/app/api/voice/speech` | Text → streamed audio (rate-limited) |
| `src/app/api/voice/status` | Which providers are configured |
| `src/app/api/voice/route.ts` | Legacy endpoint (dictation, "read aloud") |
| `src/lib/voice/languages.ts` | Language list, detection, noise filter |
| `src/lib/voice/speech-text.ts` | Markdown → speakable text, sentence chunker |
| `src/features/voice/voice-engine.ts` | Conversation state machine |
| `src/features/voice/speech-detector.ts` | Voice activity detection |
| `src/features/voice/microphone.ts` | Mic, analyser, per-utterance recorder |
| `src/features/voice/speech-player.ts` | Sentence playback queue, pause/resume, fallback voices |
| `src/features/voice/components/` | Voice Mode UI, orb/waveform, settings panel |

Real-time streaming recognition (words appearing while you speak) needs a realtime
provider API. The provider layer (`SpeechToTextProvider`) is built so one can be
added without touching the UI.
