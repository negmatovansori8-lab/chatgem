import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyDownloadUrl, isDownloadable } from "../src/lib/downloads/policy";
import {
  buildDownloadName,
  contentDisposition,
  effectiveMime,
  sanitizeFileBase,
  timestampBase,
  withExtension,
} from "../src/lib/downloads/filename";
import { GET } from "../src/app/api/download/route";

const ORIGIN = "https://chatgem.app";

describe("download URL policy", () => {
  it("allows inline media and same-origin files", () => {
    expect(classifyDownloadUrl("data:image/png;base64,AAAA", ORIGIN).via).toBe("local");
    expect(classifyDownloadUrl("data:video/mp4;base64,AAAA", ORIGIN).via).toBe("local");
    expect(classifyDownloadUrl(`blob:${ORIGIN}/123`, ORIGIN).via).toBe("local");
    expect(classifyDownloadUrl("/api/voice/speech", ORIGIN).via).toBe("same-origin");
    expect(classifyDownloadUrl(`${ORIGIN}/files/a.mp3`, ORIGIN)).toEqual({ via: "same-origin", url: "/files/a.mp3" });
  });

  it("proxies only allow-listed https hosts", () => {
    expect(classifyDownloadUrl("https://image.pollinations.ai/prompt/cat", ORIGIN).via).toBe("proxy");
    expect(classifyDownloadUrl("https://upload.wikimedia.org/a/b/Song.ogg", ORIGIN).via).toBe("proxy");
  });

  it("blocks unknown, insecure and dangerous URLs", () => {
    for (const url of [
      "https://evil.example.com/a.mp4",
      "http://image.pollinations.ai/prompt/cat",
      "https://image.pollinations.ai:8443/x",
      "https://user:pw@image.pollinations.ai/x",
      "javascript:alert(1)",
      "file:///etc/passwd",
      "data:text/html;base64,PGgxPg==",
      "data:image/svg+xml;base64,PHN2Zz4=",
      "blob:https://other.site/123",
      "//evil.example.com/a.png",
      "https://127.0.0.1/a.png",
      "https://image.pollinations.ai.evil.com/x",
    ]) {
      expect(isDownloadable(url, ORIGIN), url).toBe(false);
    }
  });
});

describe("download file names", () => {
  it("uses metadata: Artist - Song.mp3, Movie.mp4, Image.jpg", () => {
    expect(buildDownloadName({ artist: "Shabnami Surayyo", title: "Duhtari Tojik", mimeType: "audio/mpeg" })).toBe(
      "Shabnami Surayyo - Duhtari Tojik.mp3",
    );
    expect(buildDownloadName({ title: "Movie Name", mimeType: "video/mp4" })).toBe("Movie Name.mp4");
    expect(buildDownloadName({ title: "Гурба дар кайҳон", mimeType: "image/jpeg" })).toBe("Гурба дар кайҳон.jpg");
    expect(buildDownloadName({ title: "Song", url: "https://upload.wikimedia.org/x/Song.ogg" })).toBe("Song.ogg");
  });

  it("falls back to Downloaded_YYYYMMDD_HHMMSS.ext", () => {
    const date = new Date(2026, 8, 30, 20, 5, 9);
    expect(timestampBase(date)).toBe("Downloaded_20260930_200509");
    expect(buildDownloadName({ mimeType: "image/png", date })).toBe("Downloaded_20260930_200509.png");
    expect(buildDownloadName({ title: "  ***  ", mimeType: "audio/mpeg", date })).toBe("Downloaded_20260930_200509.mp3");
  });

  it("trusts the URL extension when the container matches", () => {
    expect(effectiveMime("audio/webm", "https://upload.wikimedia.org/a/clip.webm?x=1")).toBe("video/webm");
    expect(effectiveMime("audio/webm", "https://example.com/voice.weba")).toBe("audio/webm");
    expect(effectiveMime("audio/mpeg", "https://example.com/song.webm")).toBe("audio/mpeg");
  });

  it("shortens long titles at a word boundary", () => {
    expect(
      buildDownloadName({
        title: "coffee shop website, A cozy coffee shop website mockup featuring a beautiful interior",
        mimeType: "image/png",
      }),
    ).toBe("coffee shop website, A cozy coffee shop website mockup.png");
  });

  it("strips unsafe characters and reserved names", () => {
    expect(sanitizeFileBase('a/b\\c:d*e?f"g<h>i|j')).toBe("a b c d e f g h i j");
    expect(sanitizeFileBase("../../etc/passwd")).toBe("etc passwd");
    expect(sanitizeFileBase("CON")).toBe("CON_");
    expect(sanitizeFileBase("x".repeat(200)).length).toBe(80);
  });

  it("fixes the extension from the real content type", () => {
    expect(withExtension("Photo.png", "image/jpeg")).toBe("Photo.jpg");
    expect(withExtension("Clip.mp4", "video/quicktime")).toBe("Clip.mov");
    expect(withExtension("Clip.mp4", "application/x-unknown")).toBe("Clip.mp4");
  });

  it("encodes UTF-8 names in Content-Disposition", () => {
    const header = contentDisposition("Гурба.jpg");
    expect(header).toContain('filename="_.jpg"');
    expect(header).toContain("filename*=UTF-8''%D0%93%D1%83%D1%80%D0%B1%D0%B0.jpg");
  });
});

describe("GET /api/download", () => {
  afterEach(() => vi.unstubAllGlobals());

  function call(url: string, name?: string) {
    const qs = new URLSearchParams({ url, ...(name ? { name } : {}) });
    return GET(new Request(`http://localhost/api/download?${qs}`, { headers: { "x-forwarded-for": `t-${Math.random()}` } }));
  }

  it("streams an allowed image with attachment headers", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(bytes, { headers: { "content-type": "image/jpeg", "content-length": "5" } })),
    );
    const res = await call("https://image.pollinations.ai/prompt/cat", "Гурба.png");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("content-length")).toBe("5");
    expect(res.headers.get("content-disposition")).toContain("filename*=UTF-8''%D0%93%D1%83%D1%80%D0%B1%D0%B0.jpg");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
  });

  it("rejects hosts outside the allow-list without fetching", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect((await call("https://evil.example.com/a.mp4")).status).toBe(403);
    expect((await call("http://image.pollinations.ai/x")).status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses redirects to other hosts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest" } })),
    );
    expect((await call("https://image.pollinations.ai/prompt/cat")).status).toBe(403);
  });

  it("refuses non-media content and oversized files", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>", { headers: { "content-type": "text/html" } })),
    );
    expect((await call("https://image.pollinations.ai/prompt/cat")).status).toBe(415);

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("x", { headers: { "content-type": "video/mp4", "content-length": String(600 * 1024 * 1024) } }),
      ),
    );
    expect((await call("https://upload.wikimedia.org/a.mp4")).status).toBe(413);
  });

  it("maps a missing upstream file to 404", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("gone", { status: 404 })));
    expect((await call("https://upload.wikimedia.org/a.mp3")).status).toBe(404);
  });
});
