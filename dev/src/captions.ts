// Story captions shown at the bottom of the screen during flight.
//
// The narration is delivered as a sequence of caption "groups". A group may have
// an optional `audio` voiceover file (served from /assets/voiceovers/). When a
// group is voiced, its lines are advanced in sync with the audio's playback time
// (split by line length), so a single recording can cover several consecutive
// lines. Groups without audio fall back to a comfortable reading-pace timer, so
// lines that don't have a voiceover yet still show up. Drop new recordings into
// `dev/public/assets/voiceovers/` and point a group's `audio` at them.

export type Speaker = "Dad" | "Uti";

export interface CaptionLine {
  speaker: Speaker;
  text: string;
}

export interface CaptionGroup {
  /** Voiceover filename under /assets/voiceovers/, or omit for reading-pace timing. */
  audio?: string;
  lines: CaptionLine[];
}

const Dad = (text: string): CaptionLine => ({ speaker: "Dad", text });
const Uti = (text: string): CaptionLine => ({ speaker: "Uti", text });

export const CAPTION_SCRIPT: CaptionGroup[] = [
  { audio: "1.mp3", lines: [Dad("Have I ever told you how I met your mother?")] },
  { audio: "2.mp3", lines: [Dad("It began with a cat—a small black cat who stole my breakfast and ran away with an entire fish.")] },
  { audio: "3.mp3", lines: [Uti("You chased a cat over a fish?")] },
  { audio: "4.mp3", lines: [Uti("It was a very good fish.")] },
  { audio: "5.mp3", lines: [Dad("I chased the cat through the market until I tripped over a sandal lying in the road. The sandal flew through the air and landed—plop!—inside a beautiful Egyptian vessel.")] },
  { audio: "6.mp3", lines: [Dad("That vessel belonged to your mother.")] },
  { audio: "7.mp3", lines: [Uti("She was selling pottery?")] },
  {
    audio: "8-11.mp3",
    lines: [
      Dad("No. She was buying it. Which was worse."),
      Dad("When I tried to retrieve the sandal, my hand became stuck inside the vessel."),
      Dad("And then a cat leapt onto my head, blocking my view."),
      Dad("I stumbled through the market with a cat on my head, a vessel on my hand, and only one sandal on my feet."),
    ],
  },
  { audio: "12.mp3", lines: [Uti("Hahahah, you are funny.")] },
  {
    audio: "13-14.mp3",
    lines: [
      Dad("And your mother followed me all the way to the Great Pyramid, shouting, 'Come back with my vessel!'"),
      Dad("At the base of the pyramid, I finally tripped and fell into the sand. The vessel slipped safely from my hand, the cat dropped the stolen fish, and your Mother burst out laughing."),
    ],
  },
  { audio: "15.mp3", lines: [Uti("What did you say to her?")] },
  { audio: "16.mp3", lines: [Dad("I said, 'Since you already chased me across Egypt, would you like to have dinner?'")] },
  { audio: "17.mp3", lines: [Uti("And she said yes?")] },
  { audio: "18.mp3", lines: [Dad("Not immediately. First, she made me buy her a new vessel.")] },
  { audio: "19.mp3", lines: [Uti("hahahahah")] },
];

/** Comfortable reading time for an unvoiced line, based on word count. */
function readingDurationMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(9000, Math.max(2200, 900 + words * 360));
}

/**
 * Drives a caption view element through a CaptionGroup[] script. Voiced groups
 * follow the audio timeline; unvoiced groups use a reading-pace timer. Playback
 * is cancellable via stop(), and gracefully falls back to reading pace if audio
 * playback is blocked or errors.
 */
export class CaptionPlayer {
  private root: HTMLElement;
  private speakerEl: HTMLElement;
  private textEl: HTMLElement;
  private bubbleEl: HTMLElement;
  private audio = new Audio();
  private audioBase: string;
  private active = false;
  // Invoked by stop()/next-step to unblock whatever we're currently awaiting.
  private cancelCurrent: (() => void) | null = null;

  constructor(root: HTMLElement, audioBase = "/assets/voiceovers/") {
    this.root = root;
    this.speakerEl = root.querySelector<HTMLElement>(".caption-speaker")!;
    this.textEl = root.querySelector<HTMLElement>(".caption-text")!;
    this.bubbleEl = root.querySelector<HTMLElement>(".caption-bubble")!;
    this.audioBase = audioBase;
    this.audio.preload = "auto";
  }

  async play(script: CaptionGroup[]): Promise<void> {
    this.stop();
    this.active = true;
    for (const group of script) {
      if (!this.active) return;
      if (group.audio) {
        await this.playVoicedGroup(group);
      } else {
        await this.playReadingLines(group.lines);
      }
      if (!this.active) return;
      await this.wait(300); // small beat between groups
    }
    if (this.active) {
      await this.wait(1400);
      if (this.active) this.hide();
    }
  }

  stop(): void {
    this.active = false;
    const cancel = this.cancelCurrent;
    this.cancelCurrent = null;
    this.audio.pause();
    this.audio.ontimeupdate = null;
    this.audio.onended = null;
    this.audio.onerror = null;
    if (cancel) cancel();
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const id = window.setTimeout(() => {
        this.cancelCurrent = null;
        resolve();
      }, ms);
      this.cancelCurrent = () => {
        window.clearTimeout(id);
        resolve();
      };
    });
  }

  private async playReadingLines(lines: CaptionLine[]): Promise<void> {
    for (const line of lines) {
      if (!this.active) return;
      this.show(line);
      await this.wait(readingDurationMs(line.text));
    }
  }

  private playVoicedGroup(group: CaptionGroup): Promise<void> {
    return new Promise((resolve) => {
      const lines = group.lines;
      // Cumulative end-fractions of the clip for each line, weighted by length.
      const weights = lines.map((l) => Math.max(l.text.trim().length, 1));
      const total = weights.reduce((a, b) => a + b, 0);
      const ends: number[] = [];
      let acc = 0;
      for (const w of weights) {
        acc += w;
        ends.push(acc / total);
      }

      let shownIdx = -1;
      const showByFraction = (frac: number) => {
        let idx = ends.findIndex((e) => frac < e - 1e-6);
        if (idx === -1) idx = lines.length - 1;
        if (idx !== shownIdx) {
          shownIdx = idx;
          this.show(lines[idx]);
        }
      };

      const audio = this.audio;
      const detach = () => {
        audio.ontimeupdate = null;
        audio.onended = null;
        audio.onerror = null;
      };
      const finish = () => {
        detach();
        this.cancelCurrent = null;
        resolve();
      };
      const fallback = () => {
        detach();
        this.playReadingLines(lines).then(() => {
          this.cancelCurrent = null;
          resolve();
        });
      };

      this.cancelCurrent = () => {
        detach();
        audio.pause();
        resolve();
      };

      audio.ontimeupdate = () => {
        const dur = audio.duration;
        if (!dur || !isFinite(dur)) return;
        showByFraction(audio.currentTime / dur);
      };
      audio.onended = finish;
      audio.onerror = fallback;

      // Show the first line right away so there's never a blank frame.
      showByFraction(0);
      audio.src = this.audioBase + group.audio;
      audio.currentTime = 0;
      const started = audio.play();
      if (started) started.catch(fallback);
    });
  }

  private show(line: CaptionLine): void {
    this.root.classList.remove("caption-hidden");
    this.speakerEl.textContent = line.speaker;
    this.speakerEl.dataset.speaker = line.speaker.toLowerCase();
    this.textEl.textContent = line.text.trim();
    // Restart the entrance animation on each line change.
    this.bubbleEl.classList.remove("caption-in");
    void this.bubbleEl.offsetWidth;
    this.bubbleEl.classList.add("caption-in");
  }

  private hide(): void {
    this.root.classList.add("caption-hidden");
  }
}
