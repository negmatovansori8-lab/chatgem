/**
 * Voice activity detection on RMS frames (no browser APIs — unit-testable).
 * Adapts to the room's noise floor; `strict` mode (while the AI is talking)
 * needs a louder, longer voice so the assistant's own echo doesn't trigger it.
 */

export type DetectorEvent = "speech-start" | "speech-end" | null;

export type DetectorConfig = {
  /** Minimum RMS that can count as speech. */
  minRms: number;
  /** Speech must be this many times louder than the noise floor. */
  ratio: number;
  /** Voice must last this long before "speech-start". */
  startMs: number;
  /** Quiet this long after speech → "speech-end". */
  endSilenceMs: number;
};

export const NORMAL_DETECTOR: DetectorConfig = { minRms: 0.012, ratio: 2.8, startMs: 140, endSilenceMs: 950 };
export const STRICT_DETECTOR: DetectorConfig = { minRms: 0.04, ratio: 5, startMs: 260, endSilenceMs: 950 };

const CALIBRATE_MS = 400;
/** A "voice" this steady for this long is a fan / engine hum, not a person. */
const STEADY_NOISE_MS = 6000;
const STEADY_NOISE_CV = 0.2;
/** Gaps between syllables shorter than this don't restart the speech onset. */
const ONSET_DIP_MS = 160;

export class SpeechDetector {
  private floor = 0.004;
  private loudSince: number | null = null;
  private lastLoudAt = 0;
  private loudMs = 0;
  private lastPushAt: number | null = null;
  private quietSince: number | null = null;
  private speaking = false;
  private speechStartedAt = 0;
  private calibrateUntil: number | null = null;
  private calibrating = true;
  // Running mean / variance of RMS during the current utterance (Welford).
  private n = 0;
  private mean = 0;
  private m2 = 0;

  constructor(private config: DetectorConfig = NORMAL_DETECTOR) {}

  /** Re-learn the room's noise level (mic just opened / unmuted). */
  calibrate() {
    this.calibrating = true;
    this.calibrateUntil = null;
    this.reset();
  }

  setConfig(config: DetectorConfig) {
    this.config = config;
  }

  get isSpeaking() {
    return this.speaking;
  }

  /** Milliseconds of the current utterance (0 when silent). */
  speechDuration(now: number) {
    return this.speaking ? now - this.speechStartedAt : 0;
  }

  reset() {
    this.loudSince = null;
    this.loudMs = 0;
    this.quietSince = null;
    this.speaking = false;
  }

  threshold() {
    return Math.max(this.config.minRms, this.floor * this.config.ratio);
  }

  push(rms: number, now: number): DetectorEvent {
    const dt = this.lastPushAt === null ? 40 : Math.min(100, Math.max(0, now - this.lastPushAt));
    this.lastPushAt = now;

    if (this.calibrating) {
      if (this.calibrateUntil === null) {
        this.calibrateUntil = now + CALIBRATE_MS;
        this.floor = Math.max(0.002, rms);
      }
      this.floor = Math.min(0.05, Math.max(0.002, this.floor * 0.7 + rms * 0.3));
      if (now >= this.calibrateUntil) this.calibrating = false;
      return null;
    }

    const threshold = this.threshold();
    // Hysteresis: once talking, softer syllables still count as speech.
    const loud = rms >= (this.speaking ? threshold * 0.65 : threshold);

    if (!loud && !this.speaking) {
      // Track the room noise only while nobody talks.
      this.floor = Math.min(0.05, Math.max(0.002, this.floor * 0.97 + rms * 0.03));
    }

    if (loud) {
      this.quietSince = null;
      if (!this.speaking) {
        if (this.loudSince === null) {
          this.loudSince = now;
          this.loudMs = 0;
        }
        this.loudMs += dt;
        this.lastLoudAt = now;
        // Voiced time is accumulated across short syllable gaps.
        if (this.loudMs >= this.config.startMs) {
          this.speaking = true;
          this.speechStartedAt = this.loudSince;
          this.n = 0;
          this.mean = 0;
          this.m2 = 0;
          return "speech-start";
        }
        return null;
      }
      this.n += 1;
      const d = rms - this.mean;
      this.mean += d / this.n;
      this.m2 += d * (rms - this.mean);
      if (now - this.speechStartedAt > STEADY_NOISE_MS && this.n > 20) {
        const cv = Math.sqrt(this.m2 / this.n) / Math.max(this.mean, 1e-6);
        if (cv < STEADY_NOISE_CV) {
          this.floor = Math.min(0.05, this.mean * 1.05);
          this.speaking = false;
          this.loudSince = null;
          return "speech-end";
        }
      }
      return null;
    }

    if (this.loudSince !== null && now - this.lastLoudAt > ONSET_DIP_MS) this.loudSince = null;
    if (this.speaking) {
      this.quietSince ??= now;
      if (now - this.quietSince >= this.config.endSilenceMs) {
        this.speaking = false;
        this.quietSince = null;
        return "speech-end";
      }
    }
    return null;
  }
}
