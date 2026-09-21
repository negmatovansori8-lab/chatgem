"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Volume2 } from "lucide-react";
import { AppBackButton } from "@/components/layout/app-back-button";
import { useI18n } from "@/components/i18n/locale-provider";
import { streamChatMessage } from "@/features/chat/use-chat-api";
import { cn } from "@/lib/utils";

type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function speechLang(locale: string) {
  const base = locale.split("-")[0]?.toLowerCase() ?? "tg";
  const map: Record<string, string> = {
    tg: "tg-TJ",
    ru: "ru-RU",
    uz: "uz-UZ",
    en: "en-US",
    fa: "fa-IR",
    ar: "ar-SA",
  };
  return map[base] ?? `${base}-${base.toUpperCase()}`;
}

export function VoiceWorkspace() {
  const { locale, t } = useI18n();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const recRef = useRef<SpeechRec | null>(null);

  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  async function speak(text: string) {
    if (!text.trim()) return;
    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "tts", text: text.slice(0, 4000) }),
      });
      const data = await res.json();
      if (res.ok && typeof data.audioBase64 === "string") {
        const audio = new Audio(
          `data:${data.mimeType ?? "audio/mpeg"};base64,${data.audioBase64}`,
        );
        await audio.play();
        return;
      }
    } catch {
      // fall through to browser TTS
    }
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    window.speechSynthesis.speak(utter);
  }

  function startListening() {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setNotice(t("voice.unsupported"));
      return;
    }
    setNotice(null);
    setTranscript("");
    setAnswer("");
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = speechLang(locale);
    rec.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const text = last?.[0]?.transcript ?? "";
      setTranscript(text);
    };
    rec.onerror = (event) => {
      setNotice(event.error);
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  function stopListening() {
    try {
      recRef.current?.stop();
    } catch {
      // ignore
    }
    setListening(false);
  }

  async function askAi() {
    if (!transcript.trim() || busy) return;
    setBusy(true);
    setAnswer("");
    setNotice(t("voice.thinking"));
    let text = "";
    await streamChatMessage({
      content: transcript,
      locale,
      onEvent: (event) => {
        if (event.type === "token" && typeof event.content === "string") {
          text += event.content;
          setAnswer(text);
          setNotice(null);
        }
        if (event.type === "error" && typeof event.message === "string") {
          setNotice(event.message);
        }
      },
    });
    setBusy(false);
    if (text.trim()) void speak(text);
  }

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-lg flex-col bg-black text-white">
      <header className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <AppBackButton className="max-w-[7rem]" />
        <h1 className="flex-1 text-center text-[17px] font-semibold">{t("voice.title")}</h1>
        <div className="w-10" />
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6 pb-10">
        <p className="text-center text-sm text-white/45">{t("voice.subtitle")}</p>

        <button
          type="button"
          onClick={() => (listening ? stopListening() : startListening())}
          className={cn(
            "grid size-28 place-items-center rounded-full transition",
            listening
              ? "bg-red-500/20 text-red-300 ring-4 ring-red-500/30"
              : "bg-[#1a1a1a] text-white hover:bg-[#222]",
          )}
          aria-label={listening ? t("voice.stop") : t("voice.start")}
        >
          {listening ? <Square className="h-10 w-10" /> : <Mic className="h-10 w-10" />}
        </button>

        <p className="min-h-[1.25rem] text-center text-sm text-white/50">
          {listening ? t("voice.listening") : busy ? t("voice.thinking") : " "}
        </p>

        {transcript ? (
          <div className="w-full rounded-2xl bg-[#1a1a1a] px-4 py-3">
            <p className="mb-1 text-[11px] text-white/35">{t("voice.youSaid")}</p>
            <p className="text-[15px]">{transcript}</p>
          </div>
        ) : null}

        {answer ? (
          <div className="w-full rounded-2xl bg-[#1a1a1a] px-4 py-3">
            <p className="mb-1 text-[11px] text-white/35">ChatGem</p>
            <p className="text-[15px] text-white/80">{answer}</p>
          </div>
        ) : null}

        {notice ? <p className="text-center text-xs text-white/40">{notice}</p> : null}

        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => void askAi()}
            disabled={!transcript.trim() || busy}
            className="rounded-full bg-[#3b82f6] px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
          >
            {t("voice.ask")}
          </button>
          <button
            type="button"
            onClick={() => answer && void speak(answer)}
            disabled={!answer}
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm disabled:opacity-40"
          >
            <Volume2 className="h-4 w-4" />
            {t("voice.speak")}
          </button>
        </div>
      </div>
    </div>
  );
}
