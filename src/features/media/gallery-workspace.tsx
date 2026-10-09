"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Check,
  Copy,
  Download,
  Eraser,
  Heart,
  ImageIcon,
  ImagePlus,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  Square,
  Star,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import { AppBackButton } from "@/components/layout/app-back-button";
import { ImageLightbox } from "@/components/media/image-lightbox";
import { ImageGenProgress } from "@/features/chat/image-gen-progress";
import { useI18n } from "@/components/i18n/locale-provider";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useQuickDownload } from "@/components/media/download-button";
import {
  buildLogoPrompt,
  detectImageKind,
  IMAGE_LIBRARY_EVENT,
  isPlainQuestion,
  LOGO_STYLE_OPTIONS,
  PHOTO_CATEGORIES,
  photoPromptWithCategory,
  type LibraryImage,
  type LibraryImageAspect,
  type LibraryImageKind,
  type LibraryImageQuality,
  type LibraryImageStyle,
  type LogoStyleOption,
  loadImageLibrary,
  removeImageFromLibrary,
  toggleFavoriteImage,
  upsertLibraryImage,
} from "@/lib/image-prompt";
import {
  mapModeToKind,
  withModeFormat,
  type CreativeMode,
} from "@/lib/creative-brief";

type StudioTab =
  | "create"
  | "logo"
  | "photo"
  | "poster"
  | "product"
  | "edit"
  | "history"
  | "favorites";

const CREATIVE_MODES: {
  id: StudioTab;
  label: string;
  mode: import("@/lib/creative-brief").CreativeMode;
}[] = [
  { id: "create", label: "Create", mode: "general" },
  { id: "logo", label: "Logo", mode: "logo" },
  { id: "photo", label: "Photo", mode: "photo" },
  { id: "poster", label: "Poster", mode: "poster" },
  { id: "product", label: "Product", mode: "product" },
  { id: "edit", label: "Edit", mode: "edit" },
  { id: "history", label: "History", mode: "general" },
  { id: "favorites", label: "Favorites", mode: "general" },
];

const ASPECTS: { id: LibraryImageAspect; label: string }[] = [
  { id: "1:1", label: "1:1" },
  { id: "4:3", label: "4:3" },
  { id: "3:4", label: "3:4" },
  { id: "16:9", label: "16:9" },
  { id: "9:16", label: "9:16" },
  { id: "3:2", label: "3:2" },
  { id: "2:3", label: "2:3" },
];

const STYLES: { id: LibraryImageStyle; labelKey: string }[] = [
  { id: "auto", labelKey: "gallery.styleAuto" },
  { id: "photo", labelKey: "gallery.stylePhoto" },
  { id: "cinematic", labelKey: "gallery.styleCinematic" },
  { id: "illustration", labelKey: "gallery.styleIllustration" },
  { id: "3d", labelKey: "gallery.style3d" },
  { id: "product", labelKey: "gallery.styleProduct" },
  { id: "concept", labelKey: "gallery.styleConcept" },
  { id: "poster", labelKey: "gallery.stylePoster" },
  { id: "anime", labelKey: "gallery.styleAnime" },
  { id: "fantasy", labelKey: "gallery.styleFantasy" },
  { id: "scifi", labelKey: "gallery.styleScifi" },
];

const CYRILLIC_RE = /[\u0400-\u04FF]/;

const TABS = CREATIVE_MODES.map((m) => ({
  id: m.id,
  label: m.label,
}));

function aspectToProgress(aspect: LibraryImageAspect) {
  if (aspect === "9:16" || aspect === "2:3" || aspect === "3:4") return "portrait" as const;
  if (aspect === "1:1") return "square" as const;
  return "landscape" as const;
}

export function GalleryWorkspace() {
  const { t } = useI18n();
  const toast = useToast();
  const quickDownload = useQuickDownload();

  const [tab, setTab] = useState<StudioTab>("create");
  const [library, setLibrary] = useState<LibraryImage[]>([]);
  const [result, setResult] = useState<LibraryImage | null>(null);
  const [results, setResults] = useState<LibraryImage[]>([]);

  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [aspect, setAspect] = useState<LibraryImageAspect>("1:1");
  const [style, setStyle] = useState<LibraryImageStyle>("auto");
  const [quality, setQuality] = useState<LibraryImageQuality>("standard");
  const [variants, setVariants] = useState(1);

  const [logoName, setLogoName] = useState("");
  const [logoBusiness, setLogoBusiness] = useState("");
  const [logoStyle, setLogoStyle] = useState<LogoStyleOption>("Modern");
  const [logoTagline, setLogoTagline] = useState("");

  const [photoSubject, setPhotoSubject] = useState("");
  const [photoCategory, setPhotoCategory] = useState(PHOTO_CATEGORIES[0]?.id ?? "portrait");

  const [historyQuery, setHistoryQuery] = useState("");
  const [historyKind, setHistoryKind] = useState<LibraryImageKind | "all">("all");

  const [busy, setBusy] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const busyLock = useRef(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const refreshLibrary = useCallback(() => {
    setLibrary(loadImageLibrary());
  }, []);

  useEffect(() => {
    refreshLibrary();
    const onLib = () => refreshLibrary();
    window.addEventListener(IMAGE_LIBRARY_EVENT, onLib);
    window.addEventListener("storage", onLib);
    return () => {
      window.removeEventListener(IMAGE_LIBRARY_EVENT, onLib);
      window.removeEventListener("storage", onLib);
    };
  }, [refreshLibrary]);

  const [editPrompt, setEditPrompt] = useState("");
  const [editBg, setEditBg] = useState("soft studio gray seamless");
  const [sourceImage, setSourceImage] = useState<string | null>(null);

  const activeKind: LibraryImageKind =
    tab === "logo"
      ? "logo"
      : tab === "photo" || tab === "product"
        ? "photo"
        : "general";

  const activeCreativeMode: CreativeMode =
    CREATIVE_MODES.find((m) => m.id === tab)?.mode ?? "general";

  const filteredHistory = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    return library.filter((item) => {
      if (historyKind !== "all" && item.kind !== historyKind) return false;
      if (!q) return true;
      return (
        item.prompt.toLowerCase().includes(q) ||
        item.kind.includes(q) ||
        (item.provider?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [library, historyQuery, historyKind]);

  const favorites = useMemo(
    () => library.filter((x) => x.favorite),
    [library],
  );

  function cancel() {
    abortRef.current?.abort();
    abortRef.current = null;
    busyLock.current = false;
    setBusy(false);
    setError(null);
  }

  function libraryItemFromApi(
    data: Record<string, unknown>,
    meta: {
      userPrompt: string;
      kind: LibraryImageKind;
      negative?: string;
    },
  ): LibraryImage {
    return {
      id: crypto.randomUUID(),
      url: String(data.url),
      prompt: meta.userPrompt || (typeof data.prompt === "string" ? data.prompt : ""),
      negativePrompt: meta.negative,
      kind: (typeof data.kind === "string" ? data.kind : meta.kind) as LibraryImageKind,
      aspect: (typeof data.aspect === "string" ? data.aspect : aspect) as LibraryImageAspect,
      style: (typeof data.style === "string" ? data.style : style) as LibraryImageStyle,
      quality,
      provider: typeof data.provider === "string" ? data.provider : undefined,
      createdAt: Date.now(),
      favorite: false,
    };
  }

  async function generate(
    text: string,
    opts?: {
      kind?: LibraryImageKind;
      variation?: boolean;
      useResultSettings?: boolean;
      skipEnhance?: boolean;
    },
  ) {
    const q = text.trim();
    if (!q || busyLock.current) return;
    busyLock.current = true;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setBusy(true);
    setError(null);
    setWarning(null);

    const useAspect =
      opts?.useResultSettings && result?.aspect ? result.aspect : aspect;
    const useStyle =
      opts?.useResultSettings && result?.style ? result.style : style;
    const useQuality =
      opts?.useResultSettings && result?.quality ? result.quality : quality;
    const kind = opts?.kind ?? activeKind;

    try {
      const timeout = AbortSignal.timeout(95_000);
      const linked = AbortSignal.any([ac.signal, timeout]);

      // The server prompt engine writes the brief; the studio only says which format the tab is for.
      const finalPrompt = opts?.skipEnhance ? q : withModeFormat(q, activeCreativeMode);
      const useStyleResolved =
        opts?.useResultSettings && result?.style
          ? result.style
          : tab === "product"
            ? "product"
            : useStyle;

      const res = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: finalPrompt,
          kind: opts?.kind ?? mapModeToKind(activeCreativeMode),
          aspect: useAspect,
          style: useStyleResolved || "auto",
          quality: useQuality === "standard" && tab === "logo" ? "hd" : useQuality,
          negativePrompt: negativePrompt.trim() || undefined,
          variants: Math.min(4, Math.max(1, variants)),
          variation: Boolean(opts?.variation),
          skipEnhance: Boolean(opts?.skipEnhance),
        }),
        signal: linked,
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (ac.signal.aborted) return;

      if (!res.ok) {
        const errObj = data?.error as { code?: string; message?: string } | undefined;
        const err =
          errObj?.code === "USAGE_EXCEEDED"
            ? t("limit.title")
            : errObj?.code === "NETWORK"
              ? t("gallery.errorNetwork")
              : (errObj?.message ?? t("gallery.errorGenerate"));
        setError(err);
        toast.error(err);
        return;
      }
      if (typeof data.url !== "string") {
        setError(t("gallery.errorGenerate"));
        toast.error(t("gallery.errorGenerate"));
        return;
      }

      const imageList = (() => {
        if (Array.isArray(data.images) && data.images.length) {
          return data.images as Array<{ url?: string }>;
        }
        return typeof data.url === "string" ? [{ url: data.url }] : [];
      })();

      if (!imageList.length) {
        setError(t("gallery.errorGenerate"));
        toast.error(t("gallery.errorGenerate"));
        return;
      }

      const created: LibraryImage[] = [];
      for (const img of imageList) {
        if (typeof img.url !== "string") continue;
        const item = libraryItemFromApi(
          { ...data, url: img.url },
          { userPrompt: q, kind, negative: negativePrompt.trim() || undefined },
        );
        created.push(item);
        upsertLibraryImage(item);
      }

      refreshLibrary();
      if (created.length) {
        setResult(created[0]);
        setResults(created);
        setPrompt(q);
      }
      if (typeof data.warning === "string" && data.warning) {
        setWarning(data.warning);
      }
      toast.success(t("gallery.done"));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        if (!ac.signal.aborted) {
          setError(t("gallery.errorTimeout"));
          toast.error(t("gallery.errorTimeout"));
        }
        return;
      }
      setError(t("gallery.errorGenerate"));
      toast.error(t("gallery.errorGenerate"));
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      busyLock.current = false;
      setBusy(false);
    }
  }

  async function enhancePrompt(source: string) {
    const q = source.trim();
    if (!q || enhancing) return;
    setEnhancing(true);
    try {
      const res = await fetch("/api/images/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: q, mode: activeCreativeMode }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        enhancedPrompt?: string;
        error?: { message?: string };
      };
      if (!res.ok || typeof data.enhancedPrompt !== "string") {
        toast.error(data.error?.message ?? t("gallery.enhanceFailed"));
        return;
      }
      if (tab === "photo") setPhotoSubject(data.enhancedPrompt);
      else if (tab === "edit") setEditPrompt(data.enhancedPrompt);
      else setPrompt(data.enhancedPrompt);
      toast.success(t("gallery.enhanced"));
    } catch {
      toast.error(t("gallery.enhanceFailed"));
    } finally {
      setEnhancing(false);
    }
  }

  async function transform(
    mode:
      | "variation"
      | "edit"
      | "upscale"
      | "remove-bg"
      | "replace-bg"
      | "enhance-quality",
    imageUrl?: string,
  ) {
    const src = imageUrl || result?.url || sourceImage;
    if (!src || busyLock.current) return;
    busyLock.current = true;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/images/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          imageUrl: src,
          prompt: editPrompt.trim() || prompt.trim() || undefined,
          background: editBg.trim() || undefined,
          aspect,
        }),
        signal: AbortSignal.any([ac.signal, AbortSignal.timeout(95_000)]),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok || typeof data.url !== "string") {
        const err =
          (data.error as { message?: string } | undefined)?.message ??
          t("gallery.errorGenerate");
        setError(err);
        toast.error(err);
        return;
      }
      const item = libraryItemFromApi(data, {
        userPrompt:
          typeof data.prompt === "string"
            ? data.prompt
            : editPrompt || prompt || mode,
        kind: activeKind,
      });
      upsertLibraryImage(item);
      refreshLibrary();
      setResult(item);
      setResults([item]);
      setSourceImage(item.url);
      toast.success(t("gallery.done"));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(t("gallery.errorGenerate"));
      toast.error(t("gallery.errorGenerate"));
    } finally {
      busyLock.current = false;
      setBusy(false);
    }
  }

  function onSourceFile(file: File | null) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      if (url) {
        setSourceImage(url);
        setTab("edit");
      }
    };
    reader.readAsDataURL(file);
  }

  function onCreateSubmit(e: FormEvent) {
    e.preventDefault();
    const q = prompt.trim();
    if (!q) return;
    if (isPlainQuestion(q)) {
      toast.info(t("gallery.describeNotAsk"));
      return;
    }
    void generate(q, { kind: detectImageKind(q) });
  }

  function onLogoSubmit(e: FormEvent) {
    e.preventDefault();
    if (!logoName.trim()) {
      toast.error(t("gallery.logoNameRequired"));
      return;
    }
    const built = buildLogoPrompt({
      name: logoName,
      business: logoBusiness,
      style: logoStyle,
      tagline: logoTagline,
    });
    setAspect("1:1");
    setStyle("illustration");
    setQuality("hd");
    setVariants(1);
    setNegativePrompt("");
    // Tajik/Russian names need the prompt engine: Flux cannot read Cyrillic and a quoted name becomes garbled lettering.
    if (CYRILLIC_RE.test(`${logoName} ${logoBusiness} ${logoTagline}`)) {
      const natural = [`логотип ${logoName.trim()}`, logoBusiness.trim(), logoTagline.trim(), `${logoStyle} style`]
        .filter(Boolean)
        .join(", ");
      setPrompt(natural);
      void generate(natural, { kind: "logo" });
      return;
    }
    setPrompt(built);
    // Already a world-class English brief — skip second enhance pass
    void generate(built, { kind: "logo", skipEnhance: true });
  }

  function onPhotoSubmit(e: FormEvent) {
    e.preventDefault();
    const built = photoPromptWithCategory(photoSubject, photoCategory);
    setPrompt(built);
    void generate(built, { kind: "photo", skipEnhance: !CYRILLIC_RE.test(photoSubject) });
  }

  function downloadItem(item: LibraryImage) {
    void quickDownload(item.url, { title: item.prompt });
  }

  async function shareItem(item: LibraryImage) {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "ChatGem",
          text: item.prompt.slice(0, 120),
          url: item.url.startsWith("http") ? item.url : undefined,
        });
        return;
      }
      await navigator.clipboard.writeText(item.url);
      toast.success(t("gallery.copied"));
    } catch {
      toast.error(t("gallery.errorGenerate"));
    }
  }

  async function copyPrompt(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
      toast.success(t("gallery.copied"));
    } catch {
      toast.error(t("gallery.errorGenerate"));
    }
  }

  function deleteItem(id: string) {
    removeImageFromLibrary(id);
    refreshLibrary();
    if (result?.id === id) setResult(null);
    toast.success(t("gallery.deleted"));
  }

  function toggleFavorite(id: string) {
    toggleFavoriteImage(id);
    refreshLibrary();
    setResult((prev) =>
      prev?.id === id ? { ...prev, favorite: !prev.favorite } : prev,
    );
  }

  function selectFromLibrary(item: LibraryImage) {
    setResult(item);
    setPrompt(item.prompt);
    setAspect(item.aspect);
    setStyle(item.style);
    if (item.quality) setQuality(item.quality);
    if (item.negativePrompt) setNegativePrompt(item.negativePrompt);
    if (item.kind === "logo") setTab("logo");
    else if (item.kind === "photo") setTab("photo");
    else setTab("create");
  }

  function renderSettingsPanel(compact?: boolean) {
    return (
      <div className={cn("space-y-3", compact ? "" : "rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4")}>
        <div>
          <p className="nj-label mb-2">{t("gallery.aspect")}</p>
          <div className="flex flex-wrap gap-1.5">
            {ASPECTS.map((a) => (
              <button
                key={a.id}
                type="button"
                disabled={busy}
                onClick={() => setAspect(a.id)}
                className={cn(
                  "rounded-[var(--radius-md)] px-3 py-1.5 text-[13px] font-medium transition",
                  aspect === a.id
                    ? "bg-[var(--fg)] text-[var(--bg)]"
                    : "bg-[var(--surface-2)] text-[var(--fg-muted)] hover:text-[var(--fg)]",
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="nj-label mb-2">{t("gallery.style")}</p>
          <div className="flex flex-wrap gap-1.5">
            {STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={busy}
                onClick={() => setStyle(s.id)}
                className={cn(
                  "rounded-[var(--radius-md)] px-3 py-1.5 text-[13px] font-medium transition",
                  style === s.id
                    ? "bg-[var(--accent-muted)] text-[var(--accent-2)]"
                    : "bg-[var(--surface-2)] text-[var(--fg-muted)] hover:text-[var(--fg)]",
                )}
              >
                {t(s.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderResultActions(item: LibraryImage) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--fg)] hover:bg-[var(--surface-3)]"
          onClick={() => setLightboxOpen(true)}
        >
          <ImageIcon className="h-3.5 w-3.5" />
          {t("gallery.fullscreen")}
        </button>
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium"
          onClick={() => downloadItem(item)}
        >
          <Download className="h-3.5 w-3.5" />
          {t("gallery.download")}
        </button>
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium"
          onClick={() => void shareItem(item)}
        >
          <Share2 className="h-3.5 w-3.5" />
          {t("gallery.share")}
        </button>
        <button
          type="button"
          className={cn(
            "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
            item.favorite
              ? "bg-[var(--accent-muted)] text-[var(--accent-2)]"
              : "bg-[var(--surface-2)] text-[var(--fg)]",
          )}
          onClick={() => toggleFavorite(item.id)}
        >
          <Heart className={cn("h-3.5 w-3.5", item.favorite && "fill-current")} />
          {t("gallery.favorite")}
        </button>
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium"
          onClick={() => void copyPrompt(item.prompt)}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {t("gallery.copyPrompt")}
        </button>
        <button
          type="button"
          disabled={busy}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          onClick={() => void generate(item.prompt, { kind: item.kind, useResultSettings: true })}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t("gallery.regenerate")}
        </button>
        <button
          type="button"
          disabled={busy}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          onClick={() =>
            void generate(item.prompt, {
              kind: item.kind,
              variation: true,
              useResultSettings: true,
            })
          }
        >
          <Sparkles className="h-3.5 w-3.5" />
          {t("gallery.variation")}
        </button>
        <button
          type="button"
          disabled={busy}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          onClick={() => void transform("upscale", item.url)}
        >
          <ImagePlus className="h-3.5 w-3.5" />
          Upscale
        </button>
        <button
          type="button"
          disabled={busy}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          onClick={() => void transform("remove-bg", item.url)}
        >
          <Eraser className="h-3.5 w-3.5" />
          Remove BG
        </button>
        <button
          type="button"
          disabled={busy}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          onClick={() => {
            setSourceImage(item.url);
            setTab("edit");
          }}
        >
          <Wand2 className="h-3.5 w-3.5" />
          Edit
        </button>
        <button
          type="button"
          disabled={enhancing || busy}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          onClick={() => void enhancePrompt(item.prompt)}
        >
          <Wand2 className="h-3.5 w-3.5" />
          {t("gallery.enhance")}
        </button>
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-[var(--danger)] hover:bg-[var(--danger-muted)]"
          onClick={() => deleteItem(item.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t("gallery.delete")}
        </button>
      </div>
    );
  }

  function renderResultCard() {
    if (!result || busy) return null;
    return (
      <div className="mb-6 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
        <button
          type="button"
          className="block w-full bg-[var(--surface-2)]"
          onClick={() => setLightboxOpen(true)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={result.url}
            alt={result.prompt}
            className="mx-auto max-h-[min(52vh,560px)] w-full object-contain"
          />
        </button>
        {results.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto border-b border-[var(--border)] px-3 py-2">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setResult(r)}
                className={cn(
                  "h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-md)] border-2",
                  result.id === r.id
                    ? "border-[var(--accent-2)]"
                    : "border-transparent opacity-80",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
        <div className="space-y-2 px-3 py-3 sm:px-4">
          <p className="text-[13.5px] leading-snug text-[var(--fg-muted)] line-clamp-4">
            {result.prompt}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--fg-subtle)]">
            <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 capitalize">
              {result.kind}
            </span>
            <span>{result.aspect}</span>
            <span>· {result.style}</span>
            {result.provider ? <span>· {result.provider}</span> : null}
          </div>
          {renderResultActions(result)}
        </div>
      </div>
    );
  }

  function renderGrid(items: LibraryImage[], emptyKey: string) {
    if (!items.length) {
      return (
        <div className="flex flex-col items-center py-16 text-center">
          <Star className="mb-3 h-8 w-8 text-[var(--fg-subtle)]" strokeWidth={1.5} />
          <p className="text-[15px] text-[var(--fg-muted)]">{t(emptyKey)}</p>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="group relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]"
          >
            <button type="button" className="block w-full" onClick={() => selectFromLibrary(item)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.prompt}
                className="aspect-square w-full object-cover"
                loading="lazy"
              />
            </button>
            {item.favorite ? (
              <Heart className="absolute start-2 top-2 h-4 w-4 fill-[var(--accent-2)] text-[var(--accent-2)]" />
            ) : null}
            <span className="absolute bottom-1.5 start-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[10px] capitalize text-white">
              {item.kind}
            </span>
            <div className="absolute end-1 top-1 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white"
                aria-label={t("gallery.favorite")}
                onClick={() => toggleFavorite(item.id)}
              >
                <Heart className={cn("h-3.5 w-3.5", item.favorite && "fill-current")} />
              </button>
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white"
                aria-label={t("gallery.delete")}
                onClick={() => deleteItem(item.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-[var(--bg)] text-[var(--fg)]">
      <header className="shrink-0 border-b border-[var(--border)] px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-5">
        <div className="flex items-center gap-2">
          <AppBackButton />
          <div className="min-w-0 flex-1">
            <h1 className="font-display truncate text-[15px] font-semibold tracking-tight">
              {t("gallery.studioTitle")}
            </h1>
            <p className="truncate text-[12px] text-[var(--fg-subtle)]">
              {t("gallery.studioSubtitle")}
            </p>
          </div>
        </div>
        <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((tabItem) => (
            <button
              key={tabItem.id}
              type="button"
              onClick={() => setTab(tabItem.id)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition",
                tab === tabItem.id
                  ? "bg-[var(--accent-muted)] text-[var(--accent-2)]"
                  : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
              )}
            >
              {tabItem.label}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 sm:px-6">
        <div className="nj-chat-col mx-auto w-full pt-4 sm:pt-5">
          {busy ? (
            <div className="mb-6">
              <ImageGenProgress aspect={aspectToProgress(aspect)} active />
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={cancel}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--fg-muted)] hover:bg-[var(--surface-3)]"
                >
                  <Square className="h-3 w-3 fill-current" />
                  {t("gallery.cancel")}
                </button>
              </div>
            </div>
          ) : null}

          {(tab === "create" ||
            tab === "logo" ||
            tab === "photo" ||
            tab === "poster" ||
            tab === "product" ||
            tab === "edit") &&
            renderResultCard()}

          {error ? (
            <div
              className="mb-4 rounded-[var(--radius-lg)] border border-[var(--danger)]/30 bg-[var(--danger-muted)] px-4 py-3 text-sm"
              role="alert"
            >
              <p>{error}</p>
              <button
                type="button"
                className="mt-2 text-xs font-semibold text-[var(--accent-2)] underline-offset-2 hover:underline"
                onClick={() => void generate(prompt || result?.prompt || "")}
              >
                {t("gallery.retry")}
              </button>
            </div>
          ) : null}

          {warning ? (
            <p className="mb-4 text-center text-[12px] text-[var(--fg-subtle)]">{warning}</p>
          ) : null}

          {tab === "create" ? (
            <div className="space-y-4 pb-24">
              {!result && !busy ? (
                <div className="flex flex-col items-center px-2 py-8 text-center">
                  <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)] shadow-[var(--shadow-sm)]">
                    <ImageIcon className="h-6 w-6" strokeWidth={1.75} />
                  </div>
                  <h2 className="font-display text-xl font-semibold">{t("gallery.emptyTitle")}</h2>
                  <p className="mt-2 max-w-sm text-[15px] text-[var(--fg-muted)]">
                    {t("gallery.emptyBody")}
                  </p>
                </div>
              ) : null}
              {renderSettingsPanel()}
            </div>
          ) : null}

          {tab === "logo" ? (
            <form onSubmit={onLogoSubmit} className="space-y-4 pb-24">
              {!result && !busy ? (
                <p className="text-center text-sm text-[var(--fg-muted)]">
                  {t("gallery.logoHint")}
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="nj-label mb-1.5 block">{t("gallery.logoName")}</span>
                  <input
                    value={logoName}
                    onChange={(e) => setLogoName(e.target.value)}
                    className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-[15px] outline-none"
                    placeholder={t("gallery.logoNamePlaceholder")}
                    required
                  />
                </label>
                <label className="block">
                  <span className="nj-label mb-1.5 block">{t("gallery.logoBusiness")}</span>
                  <input
                    value={logoBusiness}
                    onChange={(e) => setLogoBusiness(e.target.value)}
                    className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-[15px] outline-none"
                    placeholder={t("gallery.logoBusinessPlaceholder")}
                  />
                </label>
              </div>
              <div>
                <p className="nj-label mb-2">{t("gallery.logoStyle")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {LOGO_STYLE_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setLogoStyle(s)}
                      className={cn(
                        "rounded-[var(--radius-md)] px-3 py-1.5 text-[12px] font-medium",
                        logoStyle === s
                          ? "bg-[var(--accent-muted)] text-[var(--accent-2)]"
                          : "bg-[var(--surface-2)] text-[var(--fg-muted)]",
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                disabled={busy || !logoName.trim()}
                className="w-full rounded-[var(--radius-lg)] bg-[var(--pill)] py-3 text-[15px] font-semibold text-[var(--pill-fg)] disabled:opacity-40"
              >
                {t("gallery.generateLogo")}
              </button>
            </form>
          ) : null}

          {tab === "photo" ? (
            <form onSubmit={onPhotoSubmit} className="space-y-4 pb-24">
              <div>
                <p className="nj-label mb-2">{t("gallery.photoCategory")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {PHOTO_CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setPhotoCategory(c.id)}
                      className={cn(
                        "rounded-[var(--radius-md)] px-3 py-1.5 text-[12px] font-medium capitalize",
                        photoCategory === c.id
                          ? "bg-[var(--accent-muted)] text-[var(--accent-2)]"
                          : "bg-[var(--surface-2)] text-[var(--fg-muted)]",
                      )}
                    >
                      {t(`gallery.photoCat.${c.id}`)}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="nj-label mb-1.5 block">{t("gallery.photoSubject")}</span>
                <textarea
                  value={photoSubject}
                  onChange={(e) => setPhotoSubject(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-[15px] outline-none"
                  placeholder={t("gallery.photoSubjectPlaceholder")}
                />
              </label>
              <button
                type="submit"
                disabled={busy || !photoSubject.trim()}
                className="w-full rounded-[var(--radius-lg)] bg-[var(--pill)] py-3 text-[15px] font-semibold text-[var(--pill-fg)] disabled:opacity-40"
              >
                {t("gallery.generatePhoto")}
              </button>
            </form>
          ) : null}

          {tab === "poster" || tab === "product" ? (
            <div className="space-y-4 pb-24">
              <p className="text-center text-sm text-[var(--fg-muted)]">
                {tab === "poster"
                  ? "Campaign posters & banners — describe the message and mood."
                  : "Product shots — describe the item, material, and set."}
              </p>
              {renderSettingsPanel()}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void generate(prompt, {
                    kind: tab === "product" ? "photo" : "general",
                  });
                }}
                className="space-y-3"
              >
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-[15px] outline-none"
                  placeholder={
                    tab === "poster"
                      ? "e.g. ChatGem launch poster, neon globe, bold title space"
                      : "e.g. matte black wireless earbuds on marble, softbox"
                  }
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={enhancing || !prompt.trim()}
                    onClick={() => void enhancePrompt(prompt)}
                    className="rounded-[var(--radius-lg)] border border-[var(--border)] px-4 py-3 text-sm font-medium disabled:opacity-40"
                  >
                    Enhance
                  </button>
                  <button
                    type="submit"
                    disabled={busy || !prompt.trim()}
                    className="flex-1 rounded-[var(--radius-lg)] bg-[var(--pill)] py-3 text-[15px] font-semibold text-[var(--pill-fg)] disabled:opacity-40"
                  >
                    Generate
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {tab === "edit" ? (
            <div className="space-y-4 pb-24">
              <p className="text-center text-sm text-[var(--fg-muted)]">
                Image-to-image: upload or use a result, then edit / remove BG /
                replace BG / upscale.
              </p>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius-xl)] border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center transition hover:border-[var(--accent-2)]/40">
                <Upload className="h-6 w-6 text-[var(--fg-muted)]" />
                <span className="text-sm font-medium">Upload source image</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onSourceFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {(sourceImage || result?.url) && (
                <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sourceImage || result?.url || ""}
                    alt=""
                    className="mx-auto max-h-56 w-full object-contain bg-[var(--surface-2)]"
                  />
                </div>
              )}
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-[15px] outline-none"
                placeholder="Describe the edit… e.g. make background sunset city, keep subject"
              />
              <input
                value={editBg}
                onChange={(e) => setEditBg(e.target.value)}
                className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-[14px] outline-none"
                placeholder="Replace BG with…"
              />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(
                  [
                    ["edit", "Edit"],
                    ["variation", "Variation"],
                    ["remove-bg", "Remove BG"],
                    ["replace-bg", "Replace BG"],
                    ["upscale", "Upscale"],
                    ["enhance-quality", "Enhance"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    disabled={busy || !(sourceImage || result?.url)}
                    onClick={() => void transform(mode)}
                    className="rounded-[var(--radius-lg)] bg-[var(--surface-2)] py-3 text-sm font-semibold disabled:opacity-40"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {tab === "history" ? (
            <div className="space-y-4 pb-8">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-subtle)]" />
                  <input
                    value={historyQuery}
                    onChange={(e) => setHistoryQuery(e.target.value)}
                    placeholder={t("gallery.historySearch")}
                    className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] py-2.5 ps-9 pe-3 text-[14px] outline-none"
                  />
                </div>
                <div className="flex gap-1">
                  {(["all", "general", "logo", "photo"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setHistoryKind(k)}
                      className={cn(
                        "rounded-[var(--radius-md)] px-2.5 py-2 text-[12px] font-medium capitalize",
                        historyKind === k
                          ? "bg-[var(--accent-muted)] text-[var(--accent-2)]"
                          : "bg-[var(--surface-2)] text-[var(--fg-muted)]",
                      )}
                    >
                      {k === "all" ? t("gallery.filterAll") : k}
                    </button>
                  ))}
                </div>
              </div>
              <p className="nj-meta">{t("gallery.count").replace("{n}", String(filteredHistory.length))}</p>
              {renderGrid(filteredHistory, "gallery.historyEmpty")}
            </div>
          ) : null}

          {tab === "favorites" ? (
            <div className="space-y-3 pb-8">
              <p className="nj-meta">{t("gallery.count").replace("{n}", String(favorites.length))}</p>
              {renderGrid(favorites, "gallery.favoritesEmpty")}
            </div>
          ) : null}
        </div>
      </div>

      {tab === "create" ? (
        <form
          onSubmit={onCreateSubmit}
          className="shrink-0 border-t border-[var(--border)] bg-[var(--bg)] px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6"
        >
          <div className="nj-chat-col mx-auto w-full">
            <div className="nj-composer flex items-end gap-1 px-1.5 py-1.5">
              <button
                type="button"
                disabled={enhancing || !prompt.trim() || busy}
                onClick={() => void enhancePrompt(prompt)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--surface-2)] disabled:opacity-35"
                aria-label={t("gallery.enhance")}
              >
                <Wand2 className="h-[18px] w-[18px]" />
              </button>
              <textarea
                ref={promptRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t("gallery.prompt")}
                rows={1}
                disabled={busy}
                className="max-h-28 min-h-[44px] min-w-0 flex-1 resize-none bg-transparent px-2 py-2.5 text-base text-[var(--fg)] outline-none placeholder:text-[var(--fg-subtle)] disabled:opacity-60 md:text-[15px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!busy) void generate(prompt, { kind: "general" });
                  }
                }}
              />
              {busy ? (
                <button
                  type="button"
                  onClick={cancel}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--pill)] text-[var(--pill-fg)]"
                  aria-label={t("gallery.cancel")}
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!prompt.trim()}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--pill)] text-[var(--pill-fg)] disabled:opacity-35"
                  aria-label={t("gallery.generate")}
                >
                  <ArrowUp className="h-5 w-5" strokeWidth={2.25} />
                </button>
              )}
            </div>
            <p className="mt-1.5 text-center text-[10px] text-[var(--fg-subtle)]">
              {aspect} · {style} · {quality}
              {variants > 1 ? ` · ×${variants}` : ""}
            </p>
          </div>
        </form>
      ) : null}

      <ImageLightbox
        open={lightboxOpen}
        src={result?.url ?? null}
        alt={result?.prompt}
        onClose={() => setLightboxOpen(false)}
        downloadLabel={t("gallery.download")}
        regenerateLabel={t("gallery.regenerate")}
        onDownload={() => result && downloadItem(result)}
        onRegenerate={() => {
          if (!result) return;
          setLightboxOpen(false);
          void generate(result.prompt, { kind: result.kind, useResultSettings: true });
        }}
      />
    </div>
  );
}
