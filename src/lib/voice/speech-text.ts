/**
 * Turning a (streaming) markdown chat answer into text-to-speech chunks.
 * Code blocks, tables, URLs and markup are shown in the chat but never read aloud.
 */

const FENCE = "```";

/** Markdown / chat markup → plain text a TTS voice can read naturally. */
export function toSpeakable(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?(?:```|$)/g, " ")
    .replace(/^\s*\|.*\|\s*$/gm, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\((?:[^)]*)\)/g, "$1")
    .replace(/\[image:[^\]]*]/gi, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*(?:[-*+•]|\d+[.)])\s+/gm, "")
    .replace(/(\*\*|__|~~)(.+?)\1/g, "$2")
    .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,!?:;]|$)/g, "$1$2")
    .replace(/[*_#>|~]+/g, " ")
    .replace(/\p{Extended_Pictographic}\uFE0F?/gu, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Sentence end: punctuation followed by whitespace, or a line break. */
const BOUNDARY = /[.!?…。！？؟]+["»”')\]]*(?=\s)|\n/g;

export type ChunkerOptions = {
  /** First chunk is short so the voice starts quickly. */
  firstMinChars?: number;
  /** Later chunks are merged up to this size for natural prosody and fewer requests. */
  minChars?: number;
  /** Never let a chunk grow past this before cutting at a comma / space. */
  maxChars?: number;
};

/**
 * Feeds a growing answer and returns only the new, complete, speakable chunks.
 * `update()` returns `reset: true` when the text was replaced instead of appended.
 */
export class SentenceChunker {
  private raw = "";
  private pos = 0;
  private emitted = 0;
  private readonly firstMin: number;
  private readonly min: number;
  private readonly max: number;

  constructor(opts: ChunkerOptions = {}) {
    this.firstMin = opts.firstMinChars ?? 24;
    this.min = opts.minChars ?? 90;
    this.max = opts.maxChars ?? 320;
  }

  update(text: string, final = false): { chunks: string[]; reset: boolean } {
    let reset = false;
    if (!text.startsWith(this.raw)) {
      reset = this.pos > 0;
      this.raw = "";
      this.pos = 0;
      this.emitted = 0;
    }
    this.raw = text;
    return { chunks: this.drain(final), reset };
  }

  /** Remaining text once the answer is complete. */
  flush(): string[] {
    return this.drain(true);
  }

  private drain(final: boolean): string[] {
    const out: string[] = [];
    // Stop before an unclosed code fence — its content is never spoken.
    let limit = this.raw.length;
    const fences = this.raw.split(FENCE).length - 1;
    if (fences % 2 === 1) limit = this.raw.lastIndexOf(FENCE);

    for (;;) {
      const piece = this.nextPiece(limit, final);
      if (piece === null) break;
      const spoken = toSpeakable(piece);
      if (spoken) {
        out.push(spoken);
        this.emitted += 1;
      }
    }
    return out;
  }

  /** Raw text of the next chunk, or null when more text is needed. */
  private nextPiece(limit: number, final: boolean): string | null {
    if (this.pos >= limit) return null;
    const want = this.emitted === 0 ? this.firstMin : this.min;
    const slice = this.raw.slice(this.pos, limit);

    let cut = -1;
    BOUNDARY.lastIndex = 0;
    for (let m = BOUNDARY.exec(slice); m; m = BOUNDARY.exec(slice)) {
      const end = m.index + m[0].length;
      if (insideFence(this.raw, this.pos + end)) continue;
      if (toSpeakable(slice.slice(0, end)).length >= want) {
        cut = end;
        break;
      }
    }

    if (cut < 0 && slice.length > this.max) {
      const window = slice.slice(0, this.max);
      const soft = Math.max(window.lastIndexOf(", "), window.lastIndexOf("; "), window.lastIndexOf(" — "));
      cut = soft > this.max / 2 ? soft + 1 : Math.max(window.lastIndexOf(" "), 1);
    }
    if (cut < 0) {
      if (!final) return null;
      cut = slice.length;
    }

    this.pos += cut;
    return slice.slice(0, cut);
  }
}

function insideFence(text: string, index: number): boolean {
  return (text.slice(0, index).split(FENCE).length - 1) % 2 === 1;
}
