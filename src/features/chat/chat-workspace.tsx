"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowUp,
  Check,
  Copy,
  ImageIcon,
  Loader2,
  Map as MapIcon,
  Mic,
  Pencil,
  Plus,
  RefreshCw,
  Share2,
  Square,
  Volume2,
  X,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { BrandMark, BrandWordmark } from "@/components/brand/brand-mark";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { ImageGenProgress } from "@/features/chat/image-gen-progress";
import { MarkdownMessage, TypingIndicator } from "@/features/chat/markdown-message";
import { AppMenuButton, useAppSidebar } from "@/components/layout/app-shell";
import { ImageLightbox } from "@/components/media/image-lightbox";
import { DownloadButton, useQuickDownload } from "@/components/media/download-button";
import { isDownloadable } from "@/lib/downloads/policy";
import { pageOrigin } from "@/lib/downloads/client";
import { fetchVoiceStatus } from "@/features/voice/transcribe";
import { toSpeakable } from "@/lib/voice/speech-text";
import { stripMediaBlocks } from "@/lib/media/chat-block";
import { MediaSearchProgress } from "@/features/media-search/media-results";
import { musicSearchAllowed } from "@/lib/music-access";
import { UserMenu } from "@/features/profile/profile-workspace";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useToast } from "@/components/ui/toast";
import {
  streamChatMessage,
  useModels,
  type MessageRecord,
} from "@/features/chat/use-chat-api";
import { getPlugin } from "@/features/tools/plugins-catalog";
import { useI18n } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { briefAspect } from "@/lib/image-brief";
import {
  detectImageKind,
  isPlainQuestion,
  saveGeneratedImageToLibrary,
  wantsImageGeneration,
} from "@/lib/image-prompt";
import { loadMapSession } from "@/lib/maps/session";
import { isMapAction } from "@/lib/maps/map-action";
import { replyLocaleFor } from "@/lib/i18n/reply-language";
import { ChatMapPanel, ChatMapSelectionBar } from "@/features/chat/chat-map-panel";
import { useChatMap, type MapTurn } from "@/features/chat/use-chat-map";
import { useVoiceQuestion } from "@/features/chat/use-voice-question";
import { VoiceMode } from "@/features/voice/components/voice-mode";
import { getVoiceSettings } from "@/features/voice/voice-settings";
import { useVoiceConversation } from "@/features/voice/use-voice-conversation";
import type { AskHandlers } from "@/features/voice/voice-engine";

type Bubble = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  previewUrls?: string[];
  /** Generated image (data URL or https) — rendered outside markdown. */
  imageUrl?: string;
  /** True while /api/images is in flight for this bubble. */
  generatingImage?: boolean;
  /** Progress hit 100% — show complete state before swapping to image. */
  imageComplete?: boolean;
  imageAspect?: "portrait" | "square" | "landscape";
  /** The server is searching legal media sources for this reply. */
  searchingMedia?: boolean;
};

/** File title for a generated image: the request that produced it. */
function imageTitle(messages: Bubble[], index: number): string | undefined {
  const prev = messages[index - 1];
  return prev?.role === "user" ? prev.content.trim() || undefined : undefined;
}

/** «ChatGem - first words of the answer» for the spoken-answer MP3. */
function speechTitle(content: string): string {
  const words = content
    .replace(/[#*_`>[\]()!|~-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join(" ");
  return words || "ChatGem";
}

type LocalAttachment = {
  name: string;
  mimeType: string;
  size: number;
  dataUrl?: string;
  previewUrl?: string;
  /** Extra JPEG frames extracted from video for vision ID. */
  frameDataUrls?: string[];
};

async function fileToAttachment(file: File): Promise<LocalAttachment> {
  const base: LocalAttachment = {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  };

  if (file.type.startsWith("image/")) {
    try {
      const dataUrl = await compressImageToDataUrl(file);
      return { ...base, dataUrl, previewUrl: dataUrl };
    } catch {
      const dataUrl = await readFileAsDataUrl(file);
      return { ...base, dataUrl, previewUrl: dataUrl };
    }
  }

  if (file.type.startsWith("video/")) {
    const previewUrl = URL.createObjectURL(file);
    try {
      const frames = await extractVideoFrames(file, 3);
      return {
        ...base,
        previewUrl,
        dataUrl: frames[0],
        frameDataUrls: frames,
        mimeType: file.type || "video/mp4",
      };
    } catch {
      return { ...base, previewUrl };
    }
  }

  return base;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

/** Grab mid-film frames so vision can identify movies from phone gallery videos. */
function extractVideoFrames(file: File, count = 3): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };

    const fail = (err: unknown) => {
      cleanup();
      reject(err instanceof Error ? err : new Error("video frame failed"));
    };

    video.onerror = () => fail(new Error("video load"));

    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) && video.duration > 0
        ? video.duration
        : 1;
      const spots =
        count <= 1
          ? [0.35]
          : Array.from({ length: count }, (_, i) => (i + 1) / (count + 1));
      const frames: string[] = [];
      let index = 0;

      const capture = () => {
        const max = 1280;
        let w = video.videoWidth || 640;
        let h = video.videoHeight || 360;
        const scale = Math.min(1, max / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          fail(new Error("canvas"));
          return;
        }
        ctx.drawImage(video, 0, 0, w, h);
        frames.push(canvas.toDataURL("image/jpeg", 0.82));
        index += 1;
        if (index >= spots.length) {
          cleanup();
          resolve(frames);
          return;
        }
        seekNext();
      };

      const seekNext = () => {
        const t = Math.min(duration * (spots[index] ?? 0.5), Math.max(0, duration - 0.05));
        const onSeek = () => {
          video.removeEventListener("seeked", onSeek);
          // small delay helps some mobile browsers finish decode
          window.setTimeout(capture, 40);
        };
        video.addEventListener("seeked", onSeek);
        try {
          video.currentTime = t;
        } catch {
          fail(new Error("seek"));
        }
      };

      seekNext();
    };
  });
}

function compressImageToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1536;
      let { width, height } = img;
      const scale = Math.min(1, max / Math.max(width, height));
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load"));
    };
    img.src = url;
  });
}

function dedupeBubbles(list: Bubble[]) {
  const seen = new Set<string>();
  const out: Bubble[] = [];
  for (const item of list) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export function ChatWorkspace({ chatId }: { chatId?: string }) {
  const { locale, t } = useI18n();
  const { open: sidebarOpen } = useAppSidebar();
  const toast = useToast();
  const searchParams = useSearchParams();
  const pluginFromUrl = searchParams.get("plugin") || undefined;
  const [pluginId, setPluginId] = useState<string | undefined>(pluginFromUrl);
  const plugin = pluginId ? getPlugin(pluginId) : null;
  const { models } = useModels();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [title, setTitle] = useState("ChatGem");
  const [modelId, setModelId] = useState<string>("");
  const [activeChatId, setActiveChatId] = useState<string | undefined>(chatId);
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const quickDownload = useQuickDownload();
  const [ttsAvailable, setTtsAvailable] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const streamChatIdRef = useRef<string | undefined>(chatId);
  const pluginIdRef = useRef<string | undefined>(pluginFromUrl);
  const agentInstructionsRef = useRef<string | undefined>(undefined);
  const [agentMode, setAgentMode] = useState(false);
  /** When on, any prompt becomes an image (ChatGPT-style). */
  const [imageMode, setImageMode] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [limitReset, setLimitReset] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      Promise.all([
        fetch("/api/usage", { credentials: "include" }).then((res) => res.json()),
        fetch("/api/auth/me", { credentials: "include" }).then((res) => res.json()),
      ])
        .then(([usage, me]: [
          { free?: { limited?: boolean; remaining?: number | null; resetAt?: string | null } },
          { user?: { role?: string | null; planId?: string | null } },
        ]) => {
          if (cancelled) return;
          const allowed = musicSearchAllowed({ role: me.user?.role, planId: me.user?.planId });
          if (allowed) {
            setLimitReached(false);
            return;
          }
          if (usage.free?.limited && usage.free.remaining === 0) {
            setLimitReached(true);
            setLimitReset(usage.free.resetAt ?? null);
          }
        })
        .catch(() => undefined);
    };
    load();
    const onShow = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);

  const voice = useVoiceQuestion(locale);
  const [voiceOpen, setVoiceOpen] = useState(() => searchParams.get("voice") === "1");
  const applyMapSummary = useCallback((turn: MapTurn, markdown: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === turn.bubbleId || m.id === turn.serverId ? { ...m, content: markdown } : m,
      ),
    );
  }, []);
  const chatMap = useChatMap(applyMapSummary);

  function toggleChatMic() {
    if (voice.state === "listening") {
      voice.stop();
      return;
    }
    if (voice.state !== "idle") return;
    void voice.start(
      (text) => void sendPrompt(text),
      (code, detail) => {
        if (code === "no_speech") toast.info(t("voice.noSpeech"));
        else if (code === "denied") toast.error(t("voice.micDenied"));
        else if (code === "no_mic") toast.error(t("voice.noMic"));
        else if (code === "insecure") toast.error(t("voice.needHttps"));
        else if (code === "unsupported") toast.error(t("voice.useChrome"));
        else toast.error(detail || t("voice.sttFail"));
      },
    );
  }

  useEffect(() => {
    let id = pluginFromUrl;
    if (!id && typeof window !== "undefined") {
      try {
        const raw = sessionStorage.getItem("nj_active_plugin");
        if (raw) {
          const parsed = JSON.parse(raw) as { id?: string };
          if (parsed?.id) id = parsed.id;
        }
      } catch {
        // ignore
      }
    }
    setPluginId(id);
    pluginIdRef.current = id;
    const p = id ? getPlugin(id) : null;
    if (p) {
      setTitle(p.name);
      setInput("");
      setAgentMode(false);
      agentInstructionsRef.current = undefined;
      return;
    }

    try {
      const agentPrompt = sessionStorage.getItem("nj_agent_prompt");
      if (agentPrompt?.trim()) {
        agentInstructionsRef.current = agentPrompt.trim();
        setAgentMode(true);
        setTitle(t("agents.title"));
        setInput("");
        return;
      }
    } catch {
      // ignore
    }

    try {
      const draft = sessionStorage.getItem("nj_draft_prompt");
      if (draft?.trim()) {
        sessionStorage.removeItem("nj_draft_prompt");
        setInput(draft);
        setAgentMode(false);
        agentInstructionsRef.current = undefined;
      }
    } catch {
      // ignore
    }
  }, [pluginFromUrl, t]);

  useEffect(() => {
    setActiveChatId(chatId);
    streamChatIdRef.current = chatId;
    if (!chatId) {
      setMessages([]);
      setTitle("ChatGem");
      return;
    }
    let cancelled = false;
    void fetch(`/api/chats/${chatId}`, { credentials: "include" })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (cancelled) return;
        // Stale URL after deploy / disk wipe — start clean, keep answering next message.
        if (!r.ok || !data.chat) {
          setActiveChatId(undefined);
          streamChatIdRef.current = undefined;
          setMessages([]);
          setTitle("ChatGem");
          if (typeof window !== "undefined") {
            window.history.replaceState(null, "", "/app/chat");
          }
          return;
        }
        if (sendingRef.current && streamChatIdRef.current === chatId) return;
        setTitle(data.chat.title);
        if (data.chat.modelId) setModelId(data.chat.modelId);
        setMessages(
          dedupeBubbles(
            (data.messages as MessageRecord[]).map((m) => {
              const raw =
                typeof m.content === "string"
                  ? m.content
                  : m.content == null
                    ? ""
                    : JSON.stringify(m.content);
              const imgMatch = raw.match(/!\[[^\]]*]\(((?:https?:\/\/|\/)[^)\s]+)\)/);
              const imageUrl = imgMatch?.[1];
              const content = imageUrl
                ? raw.replace(/!\[[^\]]*]\(((?:https?:\/\/|\/)[^)\s]+)\)\s*/g, "").trim()
                : raw;
              return {
                id: m.id,
                role: (m.role === "USER" ? "user" : "assistant") as
                  | "user"
                  | "assistant",
                content,
                imageUrl,
              };
            }),
          ),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  useEffect(() => {
    let alive = true;
    void fetchVoiceStatus().then((status) => {
      if (alive) setTtsAvailable(Boolean(status?.tts.available));
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    // ChatGPT-like: start as one line (~24–40px), grow with content
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 24), 200)}px`;
  }, [input]);

  const selectedModelId = modelId;
  const modelForRequest = modelId || undefined;

  function stopGeneration() {
    abortRef.current?.abort();
    abortRef.current = null;
    sendingRef.current = false;
    setBusy(false);
  }

  async function sendPrompt(
    prompt: string,
    opts?: {
      regenerate?: boolean;
      forceImage?: boolean;
      editUserId?: string;
      /** Voice Mode turn: the answer is also streamed to the voice engine. */
      voice?: AskHandlers & { language: string };
    },
  ) {
    const text = prompt.trim();
    if (limitReached) return;
    const voiceTurn = opts?.voice;
    // A spoken question never consumes the typed draft or attached files.
    const pendingAttachments = voiceTurn ? [] : attachments;
    if ((!text && !pendingAttachments.length) || sendingRef.current) return;

    sendingRef.current = true;
    setBusy(true);
    if (!voiceTurn) {
      setInput("");
      setAttachments([]);
    }

    const makeImage =
      !pendingAttachments.length &&
      !isPlainQuestion(text) &&
      (opts?.forceImage ||
        wantsImageGeneration(text) ||
        (imageMode && !voiceTurn));

    const displayText =
      text ||
      (pendingAttachments.some((a) => a.mimeType.startsWith("image/"))
        ? t("chat.mediaImageAsk")
        : pendingAttachments.some((a) => a.mimeType.startsWith("video/"))
          ? t("chat.mediaVideoAsk")
          : t("chat.mediaFileAsk"));
    const previewUrls = pendingAttachments
      .map((a) => a.previewUrl || a.dataUrl)
      .filter(Boolean) as string[];

    if (opts?.editUserId) {
      setMessages((prev) => {
        const next = prev.map((m) =>
          m.id === opts.editUserId ? { ...m, content: displayText } : m,
        );
        for (let i = next.length - 1; i >= 0; i -= 1) {
          if (next[i]?.role === "assistant") {
            next.splice(i, 1);
            break;
          }
        }
        return next;
      });
    } else if (opts?.regenerate) {
      setMessages((prev) => {
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i -= 1) {
          if (next[i]?.role === "assistant") {
            next.splice(i, 1);
            break;
          }
        }
        return next;
      });
    } else {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "user",
          content: displayText,
          previewUrls: previewUrls.length ? previewUrls : undefined,
        },
      ]);
    }

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", pending: true },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;
    let liveChatId = activeChatId ?? chatId;

    // Image generation — mode on, or clear create intent, or regenerate of an image.
    if (makeImage) {
      const imageKind = detectImageKind(text);
      const expectedAspect = briefAspect(text);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                pending: true,
                generatingImage: true,
                imageAspect:
                  expectedAspect === "1:1" ? "square" : expectedAspect === "2:3" ? "portrait" : "landscape",
                content: "",
              }
            : m,
        ),
      );
      try {
        const timeout = AbortSignal.timeout(95_000);
        const linked = AbortSignal.any([controller.signal, timeout]);
        const res = await fetch("/api/images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: text,
            kind: imageKind,
            skipEnhance: false,
            quality: "hd",
            variants: 1,
          }),
          signal: linked,
        });
        const data = (await res.json()) as {
          url?: string;
          kind?: string;
          prompt?: string;
          subject?: string;
          title?: string;
          captionKey?: string;
          message?: string;
          warning?: string;
          provider?: string;
          error?: { code?: string; message?: string; resetAt?: string };
        };
        if (data.error?.code === "USAGE_EXCEEDED") {
          setLimitReached(true);
          if (typeof data.error.resetAt === "string") setLimitReset(data.error.resetAt);
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          return;
        }
        if (!res.ok || typeof data.url !== "string") {
          const raw =
            data.error?.message ??
            data.message ??
            "Тасвир сохта нашуд. Бори дигар кӯшиш кунед.";
          const friendly = data.error?.code === "NETWORK" || /fetch failed|network error/i.test(raw)
            ? "Пайваст бо хизматрасонии тасвирсозӣ қатъ шуд (интернет ноустувор аст). Пайвасти интернетро санҷед ва «Аз нав»-ро пахш кунед."
            : data.error?.code === "TIMEOUT" || /timed out/i.test(raw)
            ? "Тасвирсозӣ аз ҳад зиёд тӯл кашид. Лутфан «Аз нав»-ро пахш кунед."
            : /rate.?limit|429/i.test(raw)
            ? "Хизматрасонии тасвирсозӣ ҳоло банд аст (лимити дархостҳо). 20–30 сония сабр кунед ва «Аз нав»-ро пахш кунед."
            : /Prompt translation failed/i.test(raw)
            ? "Тасвир сохта нашуд: дархости шуморо ба забони англисӣ тарҷума карда натавонистем (калидҳои AI ҷавоб надоданд), бинобар ин тасвири нодуруст насохтем. Баъдтар «Аз нав»-ро пахш кунед."
            : /POLLINATIONS_API_KEY|No image provider/i.test(raw)
            ? "Тасвир сохта нашуд: OpenAI маблағ надорад ва барои Pollinations калид лозим аст. Калиди ройгонро дар enter.pollinations.ai/keys гиред ва дар .env ҳамчун POLLINATIONS_API_KEY гузоред."
            : /unknown parameter|style|pollinations|quota|billing|api.?key/i.test(raw)
              ? "Тасвирсозӣ муваққатан ноком шуд. Калиди OpenAI / Billing-ро санҷед, ё «Аз нав»."
              : raw.slice(0, 220);
          voiceTurn?.onError(friendly);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    pending: false,
                    generatingImage: false,
                    content: friendly,
                  }
                : m,
            ),
          );
        } else {
          const subject = (data.title || data.subject || "").trim();
          const caption = subject
            ? `${t("chat.imageReady")} — ${subject}`
            : data.kind === "logo"
              ? t("chat.logoReady")
              : data.kind === "photo"
                ? t("chat.photoReady")
                : t("chat.imageReady");
          const note = data.warning?.trim()
            ? `${caption}\n\n_${data.warning}_`
            : caption;
          voiceTurn?.onText(caption);
          saveGeneratedImageToLibrary(data.url, text || data.prompt || "");
          // Flash 100% before revealing the image
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    pending: true,
                    generatingImage: true,
                    imageComplete: true,
                    content: "",
                  }
                : m,
            ),
          );
          await new Promise((r) => window.setTimeout(r, 380));
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    pending: false,
                    generatingImage: false,
                    imageComplete: false,
                    imageUrl: data.url,
                    content: note,
                  }
                : m,
            ),
          );
          // Persist into chat history (caption; image stays in client/library)
          void (async () => {
            try {
              let id = liveChatId;
              if (!id) {
                const created = await fetch("/api/chats", {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ title: text.slice(0, 60) || "Image" }),
                });
                const payload = (await created.json()) as { chat?: { id?: string } };
                id = payload.chat?.id;
                if (id) {
                  liveChatId = id;
                  setActiveChatId(id);
                  streamChatIdRef.current = id;
                  if (typeof window !== "undefined") {
                    const next = `/app/chat/${id}`;
                    if (window.location.pathname !== next) {
                      window.history.replaceState(null, "", next);
                    }
                    window.dispatchEvent(new Event("nj:chats-changed"));
                  }
                }
              }
              if (!id) return;
              const embed =
                typeof data.url === "string" && (data.url.startsWith("http") || data.url.startsWith("/"))
                  ? `\n\n![generated](${data.url})`
                  : "";
              await fetch(`/api/chats/${id}/assistant`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userContent: text,
                  content: `${note}${embed}`,
                  modelId: data.provider || "image",
                }),
              });
              window.dispatchEvent(new Event("nj:chats-changed"));
            } catch {
              // non-fatal
            }
          })();
        }
      } catch (error) {
        const name = (error as Error)?.name;
        if (!controller.signal.aborted) voiceTurn?.onError(name);
        if (name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    pending: false,
                    generatingImage: false,
                    content: "Хатои тасвирсозӣ. Бори дигар кӯшиш кунед.",
                  }
                : m,
            ),
          );
        } else if (!controller.signal.aborted) {
          // Our 75s timeout — not user cancel
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    pending: false,
                    generatingImage: false,
                    content:
                      "Вақт тамом шуд (92% — сервер ҷавоб надод). Бори дигар кӯшиш кунед.",
                  }
                : m,
            ),
          );
        }
      } finally {
        sendingRef.current = false;
        setBusy(false);
        abortRef.current = null;
      }
      return;
    }

    let answerText = "";
    try {
      await streamChatMessage({
        chatId: liveChatId,
        content: text || displayText,
        voice: voiceTurn ? { language: voiceTurn.language } : undefined,
        mapContext: loadMapSession(),
        tzOffsetMinutes: new Date().getTimezoneOffset(),
        modelId: modelForRequest,
        locale,
        pluginId: pluginIdRef.current,
        agentInstructions: agentInstructionsRef.current,
        forceImage: Boolean(opts?.forceImage),
        regenerate: Boolean(opts?.regenerate) && !opts?.editUserId,
        editMessageId: opts?.editUserId,
        attachments: pendingAttachments.length
          ? pendingAttachments.flatMap((a) => {
              const out: Array<{
                name: string;
                mimeType: string;
                size: number;
                dataUrl?: string;
              }> = [
                {
                  name: a.name,
                  mimeType: a.mimeType,
                  size: Math.max(1, a.size),
                  dataUrl: a.dataUrl,
                },
              ];
              // Extra video frames → vision images for movie ID
              const extras = (a.frameDataUrls ?? []).slice(1);
              for (let i = 0; i < extras.length; i += 1) {
                const url = extras[i]!;
                out.push({
                  name: `${a.name.replace(/\.[^.]+$/, "")}-frame${i + 2}.jpg`,
                  mimeType: "image/jpeg",
                  size: Math.max(1, Math.round((url.length * 3) / 4)),
                  dataUrl: url,
                });
              }
              return out;
            })
          : undefined,
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === "meta" && typeof event.chatId === "string") {
            liveChatId = event.chatId;
            streamChatIdRef.current = event.chatId;
            setActiveChatId(event.chatId);
            // Update URL without remounting this component (avoids duplicate bubbles).
            if (typeof window !== "undefined") {
              const next = `/app/chat/${event.chatId}`;
              if (window.location.pathname !== next) {
                window.history.replaceState(null, "", next);
              }
              window.dispatchEvent(new Event("nj:chats-changed"));
            }
            if (typeof event.modelId === "string" && event.modelId) {
              setModelId(event.modelId);
            }
          }

          if (event.type === "status" && event.message === "searching_media") {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, searchingMedia: true } : m)),
            );
          }

          if (event.type === "token" && typeof event.content === "string") {
            answerText += event.content;
            voiceTurn?.onText(answerText);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + event.content, pending: true, searchingMedia: false }
                  : m,
              ),
            );
          }

          if (event.type === "image" && typeof event.url === "string") {
            saveGeneratedImageToLibrary(event.url, text || displayText);
            const caption =
              event.kind === "logo"
                ? t("chat.logoReady")
                : event.kind === "photo"
                  ? t("chat.photoReady")
                  : t("chat.imageReady");
            answerText = caption;
            voiceTurn?.onText(answerText);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      imageUrl: event.url as string,
                      pending: true,
                      content: caption,
                    }
                  : m,
              ),
            );
          }

          if (event.type === "replace" && typeof event.content === "string") {
            answerText = event.content;
            voiceTurn?.onText(answerText);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: event.content as string, pending: true, searchingMedia: false }
                  : m,
              ),
            );
          }

          if (
            event.type === "action" &&
            event.action === "open_map" &&
            isMapAction(event.mapAction)
          ) {
            const action = event.mapAction;
            chatMap.run(action.href, action.report, {
              bubbleId: assistantId,
              serverId: typeof event.messageId === "string" ? event.messageId : undefined,
              chatId: liveChatId,
              locale: replyLocaleFor(text || displayText, locale),
              href: action.href,
            });
          }

          if (event.type === "error") {
            if (event.code === "USAGE_EXCEEDED") {
              setLimitReached(true);
              if (typeof event.resetAt === "string") setLimitReset(event.resetAt);
              setMessages((prev) => prev.filter((m) => m.id !== assistantId));
              return;
            }
            const message =
              typeof event.message === "string"
                ? event.message
                : t("chat.requestFailed");
            // Stopped by the user: keep whatever was already written.
            const aborted = event.code === "ABORTED";
            if (!aborted) voiceTurn?.onError(message);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: aborted && m.content.trim() ? m.content : message,
                      pending: false,
                    }
                  : m,
              ),
            );
          }

          if (event.type === "done") {
            setMessages((prev) => {
              const keptImage = [...prev]
                .reverse()
                .find((m) => m.role === "assistant" && m.imageUrl)?.imageUrl;
              return prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      pending: false,
                      imageUrl: m.imageUrl || keptImage,
                      content:
                        m.content.trim() ||
                        "Ҷавоб наомад. Regenerate-ро пахш кунед.",
                    }
                  : m,
              );
            });
            setAttachments([]);
            if (liveChatId) {
              void fetch(`/api/chats/${liveChatId}`, { credentials: "include" })
                .then((r) => r.json())
                .then((data) => {
                  if (data.chat?.title) setTitle(data.chat.title);
                  // Sync text from server but keep in-memory generated imageUrl.
                  if (Array.isArray(data.messages) && data.messages.length) {
                    setMessages((prev) => {
                      const lastImageUrl = [...prev]
                        .reverse()
                        .find((m) => m.role === "assistant" && m.imageUrl)
                        ?.imageUrl;
                      const mapped: Bubble[] = (
                        data.messages as MessageRecord[]
                      ).map((m) => {
                        const raw = chatMap.contentFor(m.id, m.content);
                        const imgMatch = raw.match(/!\[[^\]]*]\(((?:https?:\/\/|\/)[^)\s]+)\)/);
                        return {
                          id: m.id,
                          role: m.role === "USER" ? "user" : "assistant",
                          content: imgMatch
                            ? raw.replace(/!\[[^\]]*]\(((?:https?:\/\/|\/)[^)\s]+)\)\s*/g, "").trim()
                            : raw,
                          imageUrl: imgMatch?.[1],
                        };
                      });
                      if (lastImageUrl) {
                        for (let i = mapped.length - 1; i >= 0; i -= 1) {
                          if (mapped[i]?.role === "assistant" && !mapped[i]!.imageUrl) {
                            mapped[i]!.imageUrl = lastImageUrl;
                            break;
                          }
                        }
                      }
                      return dedupeBubbles(mapped);
                    });
                  }
                })
                .catch(() => {});
            }
          }
        },
      });
    } finally {
      abortRef.current = null;
      sendingRef.current = false;
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await sendPrompt(input);
  }

  /** Voice Mode question → the same chat pipeline (history, maps, images). */
  async function askByVoice(text: string, language: string, handlers: AskHandlers) {
    // Wait (≤ 30 s) for a typed answer that is still streaming.
    for (let i = 0; i < 250 && sendingRef.current; i += 1) {
      await new Promise((r) => window.setTimeout(r, 120));
    }
    if (sendingRef.current) throw new Error("busy");
    const speaker = getVoiceSettings().speaker;
    await sendPrompt(text, { voice: { ...handlers, language, ...(speaker ? { speaker } : {}) } });
  }

  const voiceMode = useVoiceConversation({
    ask: askByVoice,
    stopAnswer: stopGeneration,
    locale: () => locale,
  });

  function openVoiceMode() {
    setVoiceOpen(true);
    // Inside the tap: unlocks mic + audio playback on iOS / Safari.
    voiceMode.engine.start();
  }

  function closeVoiceMode() {
    voiceMode.engine.end();
    setVoiceOpen(false);
    const url = new URL(window.location.href);
    if (url.searchParams.has("voice")) {
      url.searchParams.delete("voice");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const empty = messages.length === 0;
  const showTitle = title && title !== "ChatGem" && title !== lastUser?.content;

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--bg)] text-[var(--fg)] lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col max-lg:contents">
      <header className="relative z-10 order-1 flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--bg)]/80 px-2.5 pb-2 pe-2.5 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md sm:gap-2.5 lg:order-none lg:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
          {/* Enter when closed / Exit when open — always one clear control */}
          <AppMenuButton className="shrink-0" />
          {showTitle ? (
            <p className="min-w-0 truncate text-[14px] font-medium tracking-tight text-[var(--fg-muted)]">
              {title}
            </p>
          ) : (
            <div
              className={cn(
                "flex min-w-0 items-center gap-2",
                sidebarOpen && "max-lg:hidden",
              )}
            >
              {!sidebarOpen ? <BrandMark size="xs" /> : null}
              <BrandWordmark className="min-w-0 truncate text-[15px]" />
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {chatMap.mounted && !chatMap.open ? (
            <button
              type="button"
              onClick={chatMap.reopen}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--accent-muted)] px-3 text-[12.5px] font-semibold text-[var(--fg)] transition hover:opacity-90"
            >
              <MapIcon className="h-4 w-4 text-[var(--accent)]" />
              {t("chat.map.open")}
            </button>
          ) : null}
          <LanguageSwitcher compact />
          <span className="hidden sm:contents">
            <ThemeToggle />
          </span>
          <UserMenu compact />
        </div>
      </header>

      <div className="order-3 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-2 pb-3 sm:px-4 lg:order-none lg:px-6">
        {empty ? (
          <div className="flex min-h-full flex-col items-center justify-center gap-4 pb-6 sm:gap-6 sm:pb-10">
            {plugin ? (
              <div className="flex w-full max-w-md flex-col items-center gap-3 px-2 text-center">
                <div
                  className="grid h-14 w-14 place-items-center rounded-2xl text-lg font-bold text-white"
                  style={{ background: plugin.color }}
                >
                  {plugin.letter}
                </div>
                <p className="text-lg font-semibold text-[var(--fg)]">{plugin.name}</p>
                <p className="text-sm text-[var(--fg-muted)]">{plugin.description}</p>
                <p className="text-xs text-[var(--fg-subtle)]">
                  {t("plugins.skillReady")}
                </p>
              </div>
            ) : agentMode ? (
              <div className="flex w-full max-w-md flex-col items-center gap-3 px-2 text-center">
                <p className="text-lg font-semibold text-[var(--fg)]">{t("agents.title")}</p>
                <p className="text-sm text-[var(--fg-muted)]">{t("agents.openChat")}</p>
                <p className="text-xs text-[var(--fg-subtle)]">{t("plugins.skillReady")}</p>
              </div>
            ) : (
              <div className="nj-chat-hero flex w-full max-w-2xl flex-col items-center px-2 text-center">
                <BrandMark size="xl" tile animate="intro" className="h-14 w-14 sm:h-16 sm:w-16" />
                <h1 className="mt-4 text-[1.5rem] text-[var(--fg)] sm:mt-5 sm:text-[1.75rem]">
                  <BrandWordmark />
                </h1>
                <p className="mt-2 max-w-md px-1 text-[15px] leading-relaxed text-[var(--fg-muted)]">
                  {t("chat.welcome")}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="nj-chat-col mx-auto flex w-full flex-col gap-5 py-4 pb-8 sm:gap-7 sm:py-6 sm:pb-10">
            {messages.map((message, index) => {
              const isLastAssistant =
                message.role === "assistant" && index === messages.length - 1;
              const isEditing = editingId === message.id;
              return (
                <div
                  key={message.id}
                  className={cn(
                    "group text-[15px] leading-7",
                    message.role === "user"
                      ? "nj-bubble-user ms-auto max-w-[min(92%,36rem)] break-words px-3.5 py-2.5 text-[var(--fg)] sm:max-w-[min(92%,42rem)] sm:px-4 sm:py-3"
                      : "w-full max-w-none text-[var(--fg)]",
                  )}
                >
                  {message.role === "assistant" ? (
                    <>
                      {message.generatingImage && !message.imageUrl ? (
                        <ImageGenProgress
                          aspect={message.imageAspect ?? "portrait"}
                          active
                          complete={Boolean(message.imageComplete)}
                        />
                      ) : message.pending && !message.imageUrl && !message.content.trim() ? (
                        message.searchingMedia ? <MediaSearchProgress /> : <TypingIndicator />
                      ) : (
                        <div className="space-y-3">
                          {message.imageUrl ? (
                            <div className="space-y-2">
                              <button
                                type="button"
                                className="block w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-left transition hover:ring-2 hover:ring-[var(--accent)]/40"
                                onClick={() => setLightboxSrc(message.imageUrl!)}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={message.imageUrl}
                                  alt=""
                                  className="max-h-[min(70vh,560px)] w-full object-contain"
                                />
                              </button>
                              <div className="flex flex-wrap items-center gap-2">
                                {isDownloadable(message.imageUrl, pageOrigin()) ? (
                                  <DownloadButton
                                    source={{ url: message.imageUrl }}
                                    meta={{ title: imageTitle(messages, index) }}
                                    label={t("chat.downloadImage")}
                                  />
                                ) : null}
                                <Link
                                  href="/app/knowledge"
                                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[var(--fg-subtle)] hover:bg-[var(--surface-3)] hover:text-[var(--fg)] sm:min-h-9"
                                >
                                  <ImageIcon className="h-3.5 w-3.5" />
                                  {t("chat.saveImage")}
                                </Link>
                              </div>
                            </div>
                          ) : null}
                          {message.content.trim() ? (
                            <div className={cn(message.pending && "opacity-90")}>
                              <MarkdownMessage
                                content={message.content}
                                onMapLink={(href) => chatMap.run(href)}
                                onPrompt={(q) => void sendPrompt(q)}
                              />
                              {message.pending ? (
                                <span className="ms-1 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-[var(--accent)] align-middle" />
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      )}
                      {!message.pending && (message.content.trim() || message.imageUrl) ? (
                        <div className="mt-2 flex flex-wrap items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 sm:has-[[role=progressbar]]:opacity-100 sm:has-[[role=alert]]:opacity-100">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--fg-subtle)] hover:bg-[var(--surface-3)] hover:text-[var(--fg)]"
                            onClick={() => {
                              void navigator.clipboard.writeText(stripMediaBlocks(message.content));
                              toast.success(t("chat.copied"));
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                            {t("chat.copy")}
                          </button>
                          {message.content.trim() ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--fg-subtle)] hover:bg-[var(--surface-3)] hover:text-[var(--fg)]"
                              onClick={() => {
                                void (async () => {
                                  try {
                                    const res = await fetch("/api/voice", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        action: "tts",
                                        text: stripMediaBlocks(message.content).slice(0, 4000),
                                        locale,
                                        ...(getVoiceSettings().speaker ? { speaker: getVoiceSettings().speaker } : {}),
                                      }),
                                    });
                                    const data = (await res.json()) as {
                                      audioBase64?: string;
                                      mimeType?: string;
                                      error?: { message?: string };
                                    };
                                    if (!res.ok || !data.audioBase64) {
                                      toast.error(
                                        data.error?.message || t("voice.ttsFail"),
                                      );
                                      return;
                                    }
                                    const audio = new Audio(
                                      `data:${data.mimeType ?? "audio/mpeg"};base64,${data.audioBase64}`,
                                    );
                                    await audio.play();
                                  } catch {
                                    toast.error(t("voice.ttsFail"));
                                  }
                                })();
                              }}
                            >
                              <Volume2 className="h-3.5 w-3.5" />
                              {t("chat.speak")}
                            </button>
                          ) : null}
                          {ttsAvailable && toSpeakable(stripMediaBlocks(message.content)) ? (
                            <DownloadButton
                              source={{
                                request: {
                                  url: "/api/voice/speech",
                                  init: {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      text: stripMediaBlocks(message.content).slice(0, 4000),
                                      language: locale,
                                      ...(getVoiceSettings().speaker ? { speaker: getVoiceSettings().speaker } : {}),
                                      downloadName: `ChatGem - ${speechTitle(message.content)}`,
                                    }),
                                  },
                                },
                              }}
                              cacheKey={`tts:${message.id}`}
                              meta={{ artist: "ChatGem", title: speechTitle(message.content), mimeType: "audio/mpeg" }}
                              label={t("download.audio")}
                              variant="ghost"
                            />
                          ) : null}
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--fg-subtle)] hover:bg-[var(--surface-3)] hover:text-[var(--fg)]"
                            onClick={() => {
                              const url =
                                typeof window !== "undefined"
                                  ? window.location.href
                                  : "";
                              const payload = stripMediaBlocks(message.content).trim() || url;
                              void (async () => {
                                try {
                                  if (navigator.share) {
                                    await navigator.share({
                                      title: "ChatGem",
                                      text: payload.slice(0, 1000),
                                      url,
                                    });
                                  } else {
                                    await navigator.clipboard.writeText(
                                      `${payload}\n\n${url}`,
                                    );
                                    toast.success(t("chat.shareCopied"));
                                  }
                                } catch {
                                  try {
                                    await navigator.clipboard.writeText(payload);
                                    toast.success(t("chat.shareCopied"));
                                  } catch {
                                    toast.error(t("chat.requestFailed"));
                                  }
                                }
                              })();
                            }}
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            {t("chat.share")}
                          </button>
                          {isLastAssistant && lastUser && !busy ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--fg-subtle)] hover:bg-[var(--surface-3)] hover:text-[var(--fg)]"
                              onClick={() =>
                                void sendPrompt(lastUser.content, {
                                  regenerate: true,
                                  forceImage: Boolean(message.imageUrl),
                                })
                              }
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              {t("chat.regenerate")}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="space-y-2">
                      {message.previewUrls?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {message.previewUrls.map((url) => {
                            const isVideo = url.startsWith("blob:") || url.startsWith("data:video");
                            return (
                              <div key={url} className="relative">
                                {isVideo ? (
                                  <video
                                    src={url}
                                    className="max-h-40 max-w-[220px] rounded-xl object-cover"
                                    muted
                                    playsInline
                                    controls
                                  />
                                ) : (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={url}
                                    alt=""
                                    className="max-h-40 max-w-[220px] cursor-zoom-in rounded-xl object-cover"
                                    onClick={() => setLightboxSrc(url)}
                                  />
                                )}
                                {isDownloadable(url, pageOrigin()) ? (
                                  <DownloadButton
                                    source={{ url }}
                                    meta={{ mimeType: isVideo ? "video/mp4" : undefined }}
                                    compact
                                    className="absolute end-1.5 top-1.5 shadow-md"
                                  />
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                      {isEditing ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            rows={3}
                            className="min-h-[72px] rounded-xl border-[var(--border)] bg-[var(--bg)] text-[15px]"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] px-2.5 py-1.5 text-xs font-semibold text-[var(--accent-fg)]"
                              disabled={busy || !editDraft.trim()}
                              onClick={() => {
                                const next = editDraft.trim();
                                if (!next) return;
                                const id = message.id;
                                setEditingId(null);
                                void sendPrompt(next, {
                                  regenerate: true,
                                  editUserId: id,
                                });
                              }}
                            >
                              <Check className="h-3.5 w-3.5" />
                              {t("chat.saveEdit")}
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-[var(--fg-subtle)] hover:bg-[var(--surface-2)]"
                              onClick={() => setEditingId(null)}
                            >
                              <X className="h-3.5 w-3.5" />
                              {t("chat.cancelEdit")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="whitespace-pre-wrap">{message.content}</p>
                          {!busy ? (
                            <div className="mt-1 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--fg-subtle)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
                                onClick={() => {
                                  setEditingId(message.id);
                                  setEditDraft(message.content);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                {t("chat.edit")}
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--fg-subtle)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
                                onClick={() => {
                                  void navigator.clipboard.writeText(message.content);
                                  toast.success(t("chat.copied"));
                                }}
                              >
                                <Copy className="h-3.5 w-3.5" />
                                {t("chat.copy")}
                              </button>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="relative z-20 order-4 shrink-0 border-t border-[var(--border)] bg-[var(--bg)] px-2 pt-1.5 pb-[max(0.5rem,calc(env(safe-area-inset-bottom)+0.35rem))] sm:px-3 lg:order-none lg:px-6"
      >
        <ChatMapSelectionBar
          map={chatMap}
          disabled={busy}
          onAsk={(prompt) => {
            chatMap.setExpanded(false);
            void sendPrompt(prompt);
          }}
        />
        {attachments.length ? (
          <div className="nj-chat-col mx-auto mb-2 flex flex-wrap gap-2">
            {attachments.map((file) => (
              <div
                key={`${file.name}-${file.size}`}
                className="relative overflow-hidden rounded-xl bg-[var(--surface-3)]"
              >
                {file.previewUrl && file.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={file.previewUrl}
                    alt={file.name}
                    className="h-16 w-16 object-cover"
                  />
                ) : file.previewUrl && file.mimeType.startsWith("video/") ? (
                  <video
                    src={file.previewUrl}
                    className="h-16 w-16 object-cover"
                    muted
                  />
                ) : (
                  <span className="block max-w-[140px] truncate px-2 py-3 text-[11px] text-[var(--fg-muted)]">
                    {file.name}
                  </span>
                )}
                <button
                  type="button"
                  className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--bg)]/80 text-[10px] text-[var(--fg)]"
                  aria-label="Remove"
                  onClick={() =>
                    setAttachments((prev) =>
                      prev.filter(
                        (a) => !(a.name === file.name && a.size === file.size),
                      ),
                    )
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {limitReached ? (
          <div className="nj-chat-col mx-auto mb-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
            <p className="text-[15px] font-semibold text-[var(--fg)]">{t("limit.title")}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--fg-muted)]">
              {t("limit.body")}{" "}
              {limitReset
                ? new Date(limitReset).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : ""}
              . {t("limit.or")}
            </p>
            <Link
              href="/app/billing"
              className="mt-3 inline-flex rounded-full bg-[var(--fg)] px-4 py-2 text-[13px] font-semibold text-[var(--bg)]"
            >
              {t("billing.proGet")}
            </Link>
          </div>
        ) : null}

        {imageMode ? (
          <div className="nj-chat-col mx-auto mb-2 space-y-2">
            <div className="flex items-center justify-between gap-2 rounded-xl bg-[var(--surface-3)] px-3 py-2 text-xs text-[var(--fg-muted)]">
              <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
                <ImageIcon className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                <span className="truncate">{t("chat.imageModeOn")}</span>
              </span>
              <button
                type="button"
                className="shrink-0 font-medium text-[var(--accent)] hover:underline"
                onClick={() => setImageMode(false)}
              >
                ✕
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 px-0.5">
              {(
                [
                  ["chat.chipCar", "chat.chipPromptCar"],
                  ["chat.chipLogo", "chat.chipPromptLogo"],
                  ["chat.chipSunset", "chat.chipPromptSunset"],
                  ["chat.chipCat", "chat.chipPromptCat"],
                  ["chat.chipHouse", "chat.chipPromptHouse"],
                ] as const
              ).map(([labelKey, promptKey]) => (
                <button
                  key={labelKey}
                  type="button"
                  disabled={busy}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12px] text-[var(--fg-muted)] transition hover:border-[var(--accent)] hover:text-[var(--fg)] disabled:opacity-40"
                  onClick={() => {
                    setImageMode(true);
                    void sendPrompt(t(promptKey), { forceImage: true });
                  }}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="nj-composer nj-chat-col mx-auto flex w-full items-center gap-1 px-1.5 py-1 sm:gap-1.5 sm:px-2 sm:py-1.5">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            multiple
            accept="image/*,video/*,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mov"
            onChange={(e) => {
              const files = e.target.files;
              if (!files?.length) return;
              void (async () => {
                const next = await Promise.all(
                  Array.from(files).slice(0, 5).map(fileToAttachment),
                );
                setAttachments(next);
                if (fileRef.current) fileRef.current.value = "";
              })();
            }}
          />
          <button
            type="button"
            className="nj-icon-btn shrink-0 !h-9 !w-9"
            aria-label="Attach"
            onClick={() => fileRef.current?.click()}
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
          <Textarea
            ref={inputRef}
            value={typeof input === "string" ? input : ""}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              limitReached
                ? t("limit.placeholder")
                : voice.state === "listening"
                ? t("voice.listeningCountdown")
                : voice.state === "transcribing"
                  ? t("voice.transcribing")
                  : imageMode
                    ? t("chat.imageModeHint")
                    : t("chat.placeholder")
            }
            rows={1}
            disabled={busy || limitReached}
            className="max-h-[200px] min-h-[24px] min-w-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-1 py-2 text-[15px] leading-snug text-[var(--fg)] shadow-none outline-none placeholder:text-[var(--fg-subtle)] hover:border-0 focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-[15px]"
            aria-label="Message"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!busy && !limitReached) void sendPrompt(input);
              }
            }}
          />
          {limitReached ? null : !input.trim() && !attachments.length && !busy ? (
            <>
              <button
                type="button"
                onClick={toggleChatMic}
                disabled={voice.state === "transcribing"}
                className={cn(
                  "nj-icon-btn relative shrink-0 !h-9 !w-9",
                  voice.state === "listening" &&
                    "!bg-red-500 !text-white hover:!bg-red-600",
                )}
                aria-label={voice.state === "listening" ? t("voice.stop") : t("voice.start")}
              >
                {voice.state === "listening" ? (
                  <>
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-full bg-red-500/40 transition-transform duration-150"
                      style={{ transform: `scale(${1 + voice.level * 0.6})` }}
                    />
                    <Square className="relative h-3.5 w-3.5 fill-current" />
                  </>
                ) : voice.state === "transcribing" ? (
                  <Loader2 className="h-[18px] w-[18px] animate-spin" />
                ) : (
                  <Mic className="h-[18px] w-[18px]" strokeWidth={1.75} />
                )}
              </button>
              <button
                type="button"
                onClick={openVoiceMode}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-fg)] transition hover:bg-[var(--accent-2)]"
                aria-label={t("voiceMode.open")}
                title={t("voiceMode.open")}
              >
                <span className="flex h-3 items-end gap-0.5">
                  <span className="h-1.5 w-0.5 rounded-full bg-current" />
                  <span className="h-3 w-0.5 rounded-full bg-current" />
                  <span className="h-2 w-0.5 rounded-full bg-current" />
                  <span className="h-2.5 w-0.5 rounded-full bg-current" />
                </span>
              </button>
            </>
          ) : busy ? (
            <button
              type="button"
              onClick={stopGeneration}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--pill)] text-[var(--pill-fg)] transition hover:opacity-90"
              aria-label="Stop"
            >
              <Square className="h-3 w-3 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() && !attachments.length}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--pill)] text-[var(--pill-fg)] transition hover:opacity-90 disabled:opacity-35"
              aria-label="Send"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
            </button>
          )}
        </div>

        <div className="nj-chat-col mx-auto mt-1.5 px-2 pb-0.5">
          <select
            value={selectedModelId}
            onChange={(e) => setModelId(e.target.value)}
            className="mx-auto block min-h-8 max-w-[14rem] truncate rounded-full bg-transparent px-3 text-center text-[11px] font-medium text-[var(--fg-subtle)] outline-none transition hover:bg-[var(--surface-2)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            aria-label="Model"
          >
            <option value="">Auto</option>
            {models.map((model) => (
              <option key={model.id} value={model.id} disabled={!model.configured}>
                {model.name}
                {!model.configured ? " (off)" : ""}
              </option>
            ))}
          </select>
        </div>
      </form>
      </div>

      <ChatMapPanel map={chatMap} />

      {voiceOpen ? <VoiceMode conversation={voiceMode} onClose={closeVoiceMode} /> : null}

      <ImageLightbox
        open={Boolean(lightboxSrc)}
        src={lightboxSrc}
        onClose={() => setLightboxSrc(null)}
        downloadLabel={t("gallery.download")}
        onDownload={
          lightboxSrc && isDownloadable(lightboxSrc, pageOrigin())
            ? () => {
                void quickDownload(lightboxSrc);
              }
            : undefined
        }
      />
    </div>
  );
}
