/** Normalized media search results shared by the server (providers) and the chat UI. */

export type MediaSearchKind = "music" | "movie" | "any";

export type MediaItemKind = "music" | "movie";

export type MediaProviderId = "itunes" | "commons" | "wikipedia" | "jamendo" | "tmdb";

export type MediaSource = {
  provider: MediaProviderId;
  /** Display name, e.g. «Apple Music», «Wikimedia Commons». */
  name: string;
  /** Page of the item at the provider (store page, Wikipedia article…). */
  url?: string;
  /** License label when the provider publishes one (CC BY-SA 4.0, Public domain). */
  license?: string;
};

export type MediaPlayback = {
  url: string;
  kind: "audio" | "video";
  /** Short promotional clip (e.g. 30 s store preview), not the full work. */
  preview: boolean;
  /** Where the stream comes from when it differs from the item's source. */
  sourceName?: string;
};

/** Present only when the provider's terms allow downloading this exact file. */
export type MediaDownload = {
  url: string;
  mimeType: string;
  size?: number;
  sourceName?: string;
  license?: string;
};

/** Legal place to watch/listen outside the app (store, streaming guide, archive). */
export type MediaLink = {
  label: string;
  url: string;
  role: "listen" | "watch" | "info";
};

export type MediaItem = {
  id: string;
  kind: MediaItemKind;
  title: string;
  artist?: string;
  album?: string;
  year?: number;
  description?: string;
  durationSec?: number;
  cover?: string;
  explicit?: boolean;
  source: MediaSource;
  play?: MediaPlayback;
  download?: MediaDownload;
  links?: MediaLink[];
  /** Relevance 0–1 (higher is better); set by the ranker. */
  score: number;
};

export type MediaSearchResult = {
  query: string;
  /** Spelling-corrected query the results are for. */
  corrected?: string;
  kind: MediaSearchKind;
  items: MediaItem[];
  /** Similar titles to try when nothing (or little) matched. */
  suggestions: string[];
  /** Providers that answered (for attribution). */
  providers: MediaProviderId[];
};
