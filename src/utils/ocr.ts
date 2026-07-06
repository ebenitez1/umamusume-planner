/**
 * OCR skill import — Tesseract.js pipeline (Import agent).
 *
 * Tesseract.js is loaded via a DYNAMIC import so it never enters the main
 * bundle. NOTE: on first use tesseract.js downloads its worker script, WASM
 * core and English trained data from its CDN (jsDelivr) — screenshot OCR and
 * screen capture therefore REQUIRE a network connection. Everything else in
 * the app remains fully offline.
 *
 * Matching strategy (documented threshold):
 *   1. Exact normalized-name lookup (includes fan-translation alt names).
 *   2. Otherwise `fuzzyFindSkills` candidates are re-scored with a normalized
 *      Levenshtein similarity: sim = 1 − editDistance / longerLength, with a
 *      containment shortcut (one normalized string containing the other, at
 *      least 5 chars → 0.9). A line counts as matched when
 *      sim ≥ MIN_SIMILARITY (0.66) — i.e. roughly one OCR error per three
 *      characters is tolerated.
 *   Limitation: a *partial* fan-translation alt-name hit whose official name
 *   differs wildly can be rejected by the primary-name re-score; exact alt
 *   names always match via step 1.
 */

import type { SkillEntry } from '../types';
import {
  findSkillByName,
  fuzzyFindSkills,
  normalizeSkillName,
} from '../data/skills';

/** Anything tesseract.js can consume that we accept from the UI. */
export type OcrImageSource =
  | File
  | Blob
  | HTMLCanvasElement
  | HTMLImageElement
  | string;

export interface DetectedSkill {
  skill: SkillEntry;
  /** SP cost parsed from the same OCR line, when present. */
  cost?: number;
  /** The cleaned OCR text the match came from. */
  rawText: string;
  /** 0..1 normalized similarity between the OCR text and the matched name. */
  similarity: number;
}

export interface OcrParseResult {
  matched: DetectedSkill[];
  unmatched: string[];
}

/** Minimum normalized similarity for an OCR line to count as a match. */
export const MIN_SIMILARITY = 0.66;

/* ------------------------------------------------------------------ *
 * String matching
 * ------------------------------------------------------------------ */

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

/** Normalized similarity between two already-normalized strings (0..1). */
export function nameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length >= 5 && longer.includes(shorter)) return 0.9;
  return 1 - levenshtein(a, b) / longer.length;
}

/**
 * Match free text (OCR line, JSON import name, manual entry) to the skill DB.
 * Returns undefined when nothing clears MIN_SIMILARITY.
 */
export function matchSkillName(
  raw: string,
): { skill: SkillEntry; similarity: number } | undefined {
  const norm = normalizeSkillName(raw);
  if (norm.length < 3) return undefined;
  const exact = findSkillByName(raw);
  if (exact) return { skill: exact, similarity: 1 };
  let best: { skill: SkillEntry; similarity: number } | undefined;
  for (const cand of fuzzyFindSkills(raw, 5)) {
    const sim = nameSimilarity(norm, normalizeSkillName(cand.name));
    if (!best || sim > best.similarity) best = { skill: cand, similarity: sim };
  }
  return best !== undefined && best.similarity >= MIN_SIMILARITY
    ? best
    : undefined;
}

/* ------------------------------------------------------------------ *
 * OCR text parsing
 * ------------------------------------------------------------------ */

/** Common screenshot UI chrome that should never be treated as a skill. */
const NOISE_RE =
  /^(skills?|skill points?|sp|pts?|learn(ed)?|hints?|hint (lv|level)\.? ?\d*|lv\.? ?\d*|level ?\d*|back|close|ok|confirm|cancel|menu|details?|owned|acquired?|obtain(ed)?|inherited|unique|evolved?|upgraded?|filter|sort|all|list)$/i;

/**
 * Parse raw OCR output into matched/unmatched skills.
 * Line-based: each OCR line is cleaned, an optional trailing SP cost
 * (2–4 digits, 20..2000, optionally suffixed "SP"/"pt") is split off, UI
 * noise is dropped, and the remainder is fuzzy-matched against SKILLS.
 */
export function parseOcrText(text: string): OcrParseResult {
  const byId = new Map<number, DetectedSkill>();
  const unmatched: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const cleaned = rawLine
      .replace(/[|_~`'"*•■□◆●▲▶«»<>{}[\]()]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) continue;

    let namePart = cleaned;
    let cost: number | undefined;
    const costMatch = cleaned.match(
      /^(.*?)[\s:.…‥-]*(\d{2,4})\s*(?:sp|pts?)?$/i,
    );
    if (costMatch && costMatch[1].trim().length >= 3) {
      const n = parseInt(costMatch[2], 10);
      if (n >= 20 && n <= 2000) {
        cost = n;
        namePart = costMatch[1].trim();
      }
    }

    if (NOISE_RE.test(namePart)) continue;
    const norm = normalizeSkillName(namePart);
    if (norm.length < 4 || /^\d+$/.test(norm)) continue;

    const hit = matchSkillName(namePart);
    if (!hit) {
      if (!unmatched.includes(cleaned)) unmatched.push(cleaned);
      continue;
    }
    const prev = byId.get(hit.skill.id);
    if (!prev || hit.similarity > prev.similarity) {
      byId.set(hit.skill.id, {
        skill: hit.skill,
        cost: cost ?? prev?.cost,
        rawText: namePart,
        similarity: hit.similarity,
      });
    } else if (prev.cost === undefined && cost !== undefined) {
      byId.set(hit.skill.id, { ...prev, cost });
    }
  }

  return {
    matched: [...byId.values()].sort((a, b) => b.similarity - a.similarity),
    unmatched: unmatched.slice(0, 25),
  };
}

/* ------------------------------------------------------------------ *
 * Tesseract worker (dynamic import, cached across scans)
 * ------------------------------------------------------------------ */

type TesseractModule = typeof import('tesseract.js');
type TesseractWorker = Awaited<ReturnType<TesseractModule['createWorker']>>;

let workerPromise: Promise<TesseractWorker> | null = null;
let progressHandler: ((progress: number) => void) | null = null;

function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    const p = (async () => {
      const { createWorker } = await import('tesseract.js');
      return createWorker('eng', undefined, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text' && progressHandler) {
            progressHandler(m.progress);
          }
        },
      });
    })();
    workerPromise = p;
    // If boot fails (offline, CDN blocked), allow a retry on the next call.
    p.catch(() => {
      if (workerPromise === p) workerPromise = null;
    });
  }
  return workerPromise;
}

/**
 * OCR an image (file upload, canvas frame, data URL…) and match the text
 * against the skill DB. `onProgress` receives 0..1 during recognition.
 */
export async function recognizeImage(
  source: OcrImageSource,
  onProgress?: (progress: number) => void,
): Promise<OcrParseResult> {
  progressHandler = onProgress ?? null;
  try {
    let worker: TesseractWorker;
    try {
      worker = await getWorker();
    } catch (err) {
      throw new Error(
        'Could not load the OCR engine — screenshot import needs an internet connection on first use.' +
          (err instanceof Error && err.message ? ` (${err.message})` : ''),
      );
    }
    const { data } = await worker.recognize(source);
    return parseOcrText(data.text);
  } finally {
    progressHandler = null;
  }
}

/* ------------------------------------------------------------------ *
 * Screen capture
 * ------------------------------------------------------------------ */

/**
 * Grab a single frame of a user-picked screen/window/tab via
 * `getDisplayMedia`. Requires a secure context (https or localhost) — it is
 * unavailable from `file://`.
 */
export async function captureScreenFrame(): Promise<HTMLCanvasElement> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getDisplayMedia !== 'function'
  ) {
    throw new Error(
      'Screen capture is not supported here — it needs a secure context (https or localhost).',
    );
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
  } catch {
    throw new Error('Screen capture was cancelled or denied.');
  }
  try {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    // Give the compositor a beat so the first painted frame is real content.
    await new Promise((resolve) => setTimeout(resolve, 150));
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create a canvas context.');
    ctx.drawImage(video, 0, 0);
    return canvas;
  } finally {
    for (const track of stream.getTracks()) track.stop();
  }
}

/** Capture one screen frame and run the full OCR → skill-match pipeline. */
export async function recognizeScreenCapture(
  onProgress?: (progress: number) => void,
): Promise<OcrParseResult> {
  const frame = await captureScreenFrame();
  return recognizeImage(frame, onProgress);
}
