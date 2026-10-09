import { afterEach, describe, expect, it, vi } from "vitest";
import { detectMediaIntent } from "../src/lib/media/intent";
import { latinSearchTerms, similarity } from "../src/lib/media/text";
import { dedupeAndSort, isStrongMatch, scoreItem } from "../src/lib/media/rank";
import type { MediaItem } from "../src/lib/media/types";
import {
  mediaReplyMarkdown,
  parseMediaBlock,
  splitMediaBlocks,
  stripMediaBlocks,
} from "../src/lib/media/chat-block";
import { buildMapAssist } from "../src/lib/maps/assist";
import { isAllowedDownloadHost } from "../src/lib/downloads/policy";
import { detectSocialDownload, socialDownloadMarkdown } from "../src/lib/media/social-download";

function song(p: Partial<MediaItem> & { title: string }): MediaItem {
  return {
    id: `t:${p.title}:${p.artist ?? ""}:${Math.random()}`,
    kind: "music",
    source: { provider: "itunes", name: "Apple Music" },
    score: 0,
    ...p,
  };
}

describe("media intent", () => {
  it("finds a song named in Tajik, Russian and English", () => {
    expect(detectMediaIntent("Shape of You-ро ёб")).toMatchObject({ query: "Shape of You", explicit: false, bare: false });
    expect(detectMediaIntent("суруди Shape of You-ро ёб")).toMatchObject({ kind: "music", query: "Shape of You", explicit: true });
    expect(detectMediaIntent("Мусиқии Jah Khalib Medina-ро ёб")).toMatchObject({
      kind: "music",
      query: "Jah Khalib Medina",
      explicit: true,
    });
    expect(detectMediaIntent("Jah Khalib")).toMatchObject({ kind: "any", query: "Jah Khalib", bare: true });
    expect(detectMediaIntent("Medina")).toMatchObject({ kind: "any", query: "Medina", bare: true });
    expect(detectMediaIntent("ба ман суруди бехром бони")).toMatchObject({
      kind: "music",
      query: "бехром бони",
      explicit: true,
    });
    expect(detectMediaIntent("BEHRAM BANI")).toMatchObject({ kind: "any", query: "BEHRAM BANI", bare: true });
    expect(detectMediaIntent("найди песню Shape of You")).toMatchObject({ kind: "music", query: "Shape of You", explicit: true });
    expect(detectMediaIntent("find the song Shape of You by Ed Sheeran")).toMatchObject({
      kind: "music",
      title: "Shape of You",
      artist: "Ed Sheeran",
    });
    expect(detectMediaIntent("скачай песню Believer")).toMatchObject({ query: "Believer", wantsDownload: true });
  });

  it("finds films", () => {
    expect(detectMediaIntent("Inception филмро ёб")).toMatchObject({ kind: "movie", query: "Inception", explicit: true });
    expect(detectMediaIntent("найди фильм Титаник")).toMatchObject({ kind: "movie", query: "Титаник" });
    expect(detectMediaIntent("watch Nosferatu")).toMatchObject({ kind: "movie", query: "Nosferatu", explicit: true });
  });

  it("asks for a title when none was given", () => {
    expect(detectMediaIntent("Номи ин сурудро ёб")).toMatchObject({ kind: "music", query: "", explicit: true });
    expect(detectMediaIntent("Ин филмро ёб")).toMatchObject({ kind: "movie", query: "", explicit: true });
  });

  it("treats a bare name as a quick lookup and keeps titles intact", () => {
    expect(detectMediaIntent("Ed Sheeran")).toMatchObject({ query: "Ed Sheeran", bare: true, explicit: false });
    expect(detectMediaIntent("суруди Call Me Maybe")).toMatchObject({ query: "Call Me Maybe" });
    expect(detectMediaIntent("Find “Rolling in the Deep”")).toMatchObject({ query: "Rolling in the Deep", explicit: true });
  });

  it("leaves ordinary chat to the AI", () => {
    for (const text of [
      "салом",
      "Раҳмат",
      "Ed Sheeran кист?",
      "Сюжет фильма Inception",
      "матни суруди Shape of You-ро навис",
      "ман имрӯз хаста шудам",
      "how do I learn python?",
      "2+2",
      "нарисуй кота",
      "https://example.com/song.mp3",
    ]) {
      expect(detectMediaIntent(text), text).toBeNull();
    }
  });

  it("does not steal media requests for the map", () => {
    expect(buildMapAssist({ text: "Shape of You-ро ёб", locale: "tg" })).toBeNull();
    expect(buildMapAssist({ text: "суруди Лолаҷон-ро ёб", locale: "tg" })).toBeNull();
  });
});

describe("similarity and ranking", () => {
  it("tolerates typos and word order", () => {
    expect(similarity("shap of yu", "Shape of You")).toBeGreaterThan(0.75);
    expect(similarity("sheeran ed", "Ed Sheeran")).toBeGreaterThan(0.9);
    expect(similarity("hello", "Shape of You")).toBeLessThan(0.4);
  });

  it("ranks the original above karaoke and removes duplicates", () => {
    const q = { query: "Shape of You" };
    const items = [
      song({ title: "Shape of You (Karaoke Version)", artist: "Karaoke Hits" }),
      song({ title: "Shape of You", artist: "Ed Sheeran", album: "÷ (Deluxe)" }),
      song({ title: "Shape of You", artist: "Ed Sheeran", album: "Shape of You - Single" }),
    ].map((item, i) => ({ ...item, score: scoreItem(item, q, i) }));
    const ranked = dedupeAndSort(items);
    expect(ranked).toHaveLength(2);
    expect(ranked[0]).toMatchObject({ title: "Shape of You", artist: "Ed Sheeran" });
    expect(isStrongMatch(ranked, q)).toBe(true);
  });

  it("reads «Artist - Song» either way", () => {
    const item = song({ title: "Believer", artist: "Imagine Dragons" });
    expect(scoreItem(item, { query: "Imagine Dragons - Believer", artist: "Imagine Dragons", title: "Believer" })).toBeGreaterThan(0.9);
    expect(scoreItem(item, { query: "Believer - Imagine Dragons", artist: "Believer", title: "Imagine Dragons" })).toBeGreaterThan(0.9);
  });

  it("needs several songs by the artist before a one-word name counts as a match", () => {
    const one = [song({ title: "Python", artist: "Someone" })].map((i) => ({ ...i, score: scoreItem(i, { query: "Python" }) }));
    expect(isStrongMatch(one, { query: "Python" })).toBe(false);
    const adele = ["Hello", "Skyfall", "Easy on Me"].map((t, i) => {
      const item = song({ title: t, artist: "Adele" });
      return { ...item, score: scoreItem(item, { query: "Adele" }, i) };
    });
    expect(isStrongMatch(adele, { query: "Adele" })).toBe(true);
  });

  it("turns a Tajik spelling of Behnam Bani into the Latin catalog form", () => {
    expect(latinSearchTerms("бехром бони")).toEqual(["behrom boni", "behram bani"]);
    expect(latinSearchTerms("Jah Khalib")).toEqual(["Jah Khalib"]);
    expect(latinSearchTerms("Лола")).toEqual(["lola"]);
  });

  it("accepts BEHRAM BANI when the catalog artist is Behnam Bani", () => {
    const tracks = ["Setareh Mishi", "Ghorse Ghamar", "Shabhaye Tehran"].map((title, i) => {
      const item = song({ title, artist: "Behnam Bani" });
      return { ...item, score: scoreItem(item, { query: "behram bani" }, i) };
    });
    expect(tracks[0]!.score).toBeGreaterThan(0.7);
    expect(isStrongMatch(tracks, { query: "BEHRAM BANI" })).toBe(true);
    expect(isStrongMatch(tracks, { query: "бехром бони" })).toBe(true);
  });

  it("merges one film from two providers without losing the free copy", () => {
    const a: MediaItem = { id: "tmdb:1", kind: "movie", title: "Nosferatu", year: 1922, cover: "https://p/x.jpg", source: { provider: "tmdb", name: "TMDB" }, score: 0.99 };
    const b: MediaItem = {
      id: "wikipedia:Q1",
      kind: "movie",
      title: "Nosferatu",
      year: 1922,
      source: { provider: "wikipedia", name: "Wikipedia" },
      play: { url: "https://upload.wikimedia.org/v.webm", kind: "video", preview: false },
      download: { url: "https://upload.wikimedia.org/v.webm", mimeType: "video/webm" },
      score: 0.98,
    };
    const merged = dedupeAndSort([a, b]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ cover: "https://p/x.jpg", download: { mimeType: "video/webm" } });
  });

  it("shows one Wikipedia link when two articles describe the same film", () => {
    const film = (id: string, url: string): MediaItem => ({
      id,
      kind: "movie",
      title: "Nosferatu",
      year: 2024,
      source: { provider: "wikipedia", name: "Wikipedia" },
      links: [{ label: "Wikipedia", url, role: "info" }],
      score: 0.9,
    });
    const merged = dedupeAndSort([film("wikipedia:Q1", "https://en.wikipedia.org/wiki/A"), film("wikipedia:Q2", "https://en.wikipedia.org/wiki/B")]);
    expect(merged).toHaveLength(1);
    expect(merged[0].links).toHaveLength(1);
  });
});

describe("chat media block", () => {
  const result = {
    query: "shap of yu",
    corrected: "shape of you",
    kind: "music" as const,
    items: [
      song({
        title: "Shape of You `x`",
        artist: "Ed Sheeran",
        play: { url: "https://audio-ssl.itunes.apple.com/a.m4a", kind: "audio", preview: true },
        score: 1,
      }),
    ],
    suggestions: [],
    providers: ["itunes" as const],
  };

  it("round-trips through the message and survives backticks in titles", () => {
    const md = mediaReplyMarkdown(result, "tg");
    expect(md).toContain("Натиҷаҳо барои «shape of you»");
    const segments = splitMediaBlocks(md);
    expect(segments.map((s) => s.type)).toEqual(["markdown", "media"]);
    const media = segments[1] as { type: "media"; result: typeof result };
    expect(media.result.items[0]).toMatchObject({ title: "Shape of You `x`", artist: "Ed Sheeran" });
    expect(media.result.items[0]!.download).toBeUndefined();
  });

  it("drops unsafe URLs from edited content", () => {
    const parsed = parseMediaBlock(
      JSON.stringify({
        query: "x",
        kind: "music",
        items: [
          {
            title: "Evil",
            kind: "music",
            source: { provider: "itunes", name: "x" },
            cover: "javascript:alert(1)",
            play: { url: "http://insecure/a.mp3", kind: "audio" },
            download: { url: "data:text/html,hi", mimeType: "audio/mpeg" },
            links: [{ label: "x", url: "javascript:alert(1)", role: "watch" }],
          },
        ],
      }),
    );
    expect(parsed?.items[0]).toMatchObject({ title: "Evil", cover: undefined, play: undefined, download: undefined, links: [] });
  });

  it("gives the AI and Copy a plain-text summary", () => {
    const text = stripMediaBlocks(mediaReplyMarkdown(result, "en"));
    expect(text).not.toContain("```");
    expect(text).toContain("Shape of You `x` — Ed Sheeran [Apple Music]");
  });
});

describe("social video download requests", () => {
  const reel = "https://www.instagram.com/reel/Dd3kkw-pR7w/?stkn=MTFpdjZkMXN3eG5qNA==";

  it("recognises «скачат кун» with an Instagram / TikTok / YouTube link", () => {
    expect(detectSocialDownload(`ин видеоро скачат кун ${reel}`)).toEqual({ platform: "instagram", url: reel });
    expect(detectSocialDownload("скачай https://vm.tiktok.com/ZM123/")?.platform).toBe("tiktok");
    expect(detectSocialDownload("download https://youtu.be/abc")?.platform).toBe("youtube");
  });

  it("leaves plain links and other sites to the normal chat", () => {
    expect(detectSocialDownload(reel)).toBeNull();
    expect(detectSocialDownload("номи ин видео чист? " + reel)).toBeNull();
    expect(detectSocialDownload("скачат кун https://instagram.com.evil.example/reel/1")).toBeNull();
  });

  it("answers in Tajik with the official save steps and a link back", () => {
    const text = socialDownloadMarkdown({ platform: "instagram", url: reel }, "tg");
    expect(text).toContain("Instagram");
    expect(text).toContain("«Download»");
    expect(text).toContain(`](${reel})`);
  });
});

describe("download hosts", () => {
  it("allows Jamendo storage subdomains only", () => {
    expect(isAllowedDownloadHost("prod-1.storage.jamendo.com")).toBe(true);
    expect(isAllowedDownloadHost("evil-storage.jamendo.com.attacker.net")).toBe(false);
    expect(isAllowedDownloadHost("audio-ssl.itunes.apple.com")).toBe(false);
  });
});

describe("providers (mocked network)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("iTunes previews can be played but never downloaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          results: [
            {
              kind: "song",
              trackId: 1,
              trackName: "Shape of You",
              artistName: "Ed Sheeran",
              collectionName: "÷",
              trackTimeMillis: 233_713,
              releaseDate: "2017-01-06T08:00:00Z",
              artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/a/100x100bb.jpg",
              previewUrl: "https://audio-ssl.itunes.apple.com/p.m4a",
              trackViewUrl: "https://music.apple.com/us/album/1",
            },
          ],
        }),
      ),
    );
    const { searchItunesMusic } = await import("../src/providers/media/itunes");
    const [item] = await searchItunesMusic("shape of you");
    expect(item).toMatchObject({
      title: "Shape of You",
      artist: "Ed Sheeran",
      durationSec: 234,
      year: 2017,
      cover: "https://is1-ssl.mzstatic.com/image/thumb/a/600x600bb.jpg",
      play: { preview: true, kind: "audio" },
    });
    expect(item!.download).toBeUndefined();
  });

  it("Jamendo offers Download only when the artist allows it", async () => {
    vi.stubEnv("JAMENDO_CLIENT_ID", "test-id");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          headers: { status: "success" },
          results: [
            { id: "1", name: "Free", artist_name: "A", audio: "https://prod-1.storage.jamendo.com/s/1", audiodownload: "https://prod-1.storage.jamendo.com/d/1", audiodownload_allowed: true, license_ccurl: "http://creativecommons.org/licenses/by-sa/3.0/" },
            { id: "2", name: "Stream only", artist_name: "B", audio: "https://prod-1.storage.jamendo.com/s/2", audiodownload: "https://prod-1.storage.jamendo.com/d/2", audiodownload_allowed: false },
          ],
        }),
      ),
    );
    const { searchJamendo } = await import("../src/providers/media/jamendo");
    const [free, streamOnly] = await searchJamendo("x");
    expect(free!.download).toMatchObject({ url: "https://prod-1.storage.jamendo.com/d/1", license: "CC BY-SA 3.0" });
    expect(streamOnly!.download).toBeUndefined();
    expect(streamOnly!.play?.url).toBe("https://prod-1.storage.jamendo.com/s/2");
  });

  it("search service corrects a typo and caches the answer", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("itunes.apple.com")) {
        const term = new URL(url).searchParams.get("term");
        return Response.json({
          results:
            term === "believer"
              ? [{ kind: "song", trackId: 7, trackName: "Believer", artistName: "Imagine Dragons", previewUrl: "https://audio-ssl.itunes.apple.com/b.m4a" }]
              : [],
        });
      }
      if (url.includes("list=search")) return Response.json({ query: { searchinfo: { suggestion: "believer" } } });
      if (url.includes("opensearch")) return Response.json(["q", []]);
      return Response.json({ query: { pages: [] } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { searchMedia } = await import("../src/services/media/search");
    const result = await searchMedia({ query: "beleiverr", kind: "music" });
    expect(result.corrected).toBe("believer");
    expect(result.items[0]).toMatchObject({ title: "Believer", artist: "Imagine Dragons" });
    const calls = fetchMock.mock.calls.length;
    await searchMedia({ query: "beleiverr", kind: "music" });
    expect(fetchMock.mock.calls.length).toBe(calls);
  });
});

describe("download proxy resume", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("forwards Range and returns 206 with Content-Range", async () => {
    const upstream = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const range = new Headers(init?.headers).get("range");
      expect(range).toBe("bytes=100-");
      return new Response(new Uint8Array(50), {
        status: 206,
        headers: { "content-type": "audio/mpeg", "content-length": "50", "content-range": "bytes 100-149/150", etag: '"abc"' },
      });
    });
    vi.stubGlobal("fetch", upstream);
    const { GET } = await import("../src/app/api/download/route");
    const res = await GET(
      new Request("http://localhost/api/download?url=https%3A%2F%2Fupload.wikimedia.org%2Fa.mp3&name=A%20-%20B", {
        headers: { range: "bytes=100-", "x-forwarded-for": "10.9.9.9" },
      }),
    );
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 100-149/150");
    expect(res.headers.get("etag")).toBe('"abc"');
    expect((await res.arrayBuffer()).byteLength).toBe(50);
  });
});
