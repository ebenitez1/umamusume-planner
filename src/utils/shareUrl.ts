/**
 * Build share-URL encoding/decoding (Builds module).
 *
 * A build is serialized as a versioned envelope `{ v: 1, build: Build }`,
 * JSON-stringified, then compressed with lz-string's URI-safe variant and
 * carried in the URL hash as `#build=<encoded>`.
 *
 * Decoding is defensive: malformed, truncated, or hostile payloads return
 * `null` — these functions never throw.
 */

import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from 'lz-string';
import type {
  AptitudeGrade,
  AptitudeSet,
  Build,
  DistanceClass,
  RaceConfig,
  Strategy,
  Surface,
  UmaConfig,
  UmaStats,
} from '../types';

/** Current share-payload schema version. */
const SHARE_VERSION = 1;

interface ShareEnvelopeV1 {
  v: typeof SHARE_VERSION;
  build: Build;
}

// ---------------------------------------------------------------------------
// Encode
// ---------------------------------------------------------------------------

/** Compress a build into a URL-safe opaque string. */
export function encodeBuild(build: Build): string {
  const envelope: ShareEnvelopeV1 = { v: SHARE_VERSION, build };
  return compressToEncodedURIComponent(JSON.stringify(envelope));
}

/**
 * Full shareable URL for a build: the current page (origin + path + query,
 * hash stripped) with `#build=<encoded>` appended. Uses `location.href`
 * minus the hash so it also works under `file://` (where `origin` is "null").
 */
export function buildToShareUrl(build: Build): string {
  const base =
    typeof window !== 'undefined' && window.location
      ? window.location.href.split('#')[0]
      : '';
  return `${base}#build=${encodeBuild(build)}`;
}

// ---------------------------------------------------------------------------
// Decode + sanitize
// ---------------------------------------------------------------------------

const GRADES: readonly AptitudeGrade[] = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
const SURFACES: readonly Surface[] = ['turf', 'dirt'];
const DISTANCES: readonly DistanceClass[] = ['sprint', 'mile', 'medium', 'long'];
const STRATEGIES: readonly Strategy[] = ['front', 'pace', 'late', 'end'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = finiteNumber(value);
  if (n === null) return fallback;
  return Math.min(max, Math.max(min, n));
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function sanitizeStats(value: unknown): UmaStats {
  const raw = isRecord(value) ? value : {};
  return {
    speed: clampNumber(raw.speed, 600, 0, 9999),
    stamina: clampNumber(raw.stamina, 600, 0, 9999),
    power: clampNumber(raw.power, 600, 0, 9999),
    guts: clampNumber(raw.guts, 600, 0, 9999),
    wisdom: clampNumber(raw.wisdom, 600, 0, 9999),
  };
}

function sanitizeUma(value: unknown): UmaConfig {
  const raw = isRecord(value) ? value : {};
  const star = Math.round(clampNumber(raw.starLevel, 3, 1, 5)) as UmaConfig['starLevel'];
  const unique = Math.round(
    clampNumber(raw.uniqueLevel, 2, 1, 6),
  ) as UmaConfig['uniqueLevel'];
  return { stats: sanitizeStats(raw.stats), starLevel: star, uniqueLevel: unique };
}

function sanitizeAptitudes(value: unknown): AptitudeSet {
  const raw = isRecord(value) ? value : {};
  const track = isRecord(raw.track) ? raw.track : {};
  const distance = isRecord(raw.distance) ? raw.distance : {};
  const strategy = isRecord(raw.strategy) ? raw.strategy : {};
  const grade = (v: unknown): AptitudeGrade => oneOf(v, GRADES, 'A');
  return {
    track: { turf: grade(track.turf), dirt: grade(track.dirt) },
    distance: {
      sprint: grade(distance.sprint),
      mile: grade(distance.mile),
      medium: grade(distance.medium),
      long: grade(distance.long),
    },
    strategy: {
      front: grade(strategy.front),
      pace: grade(strategy.pace),
      late: grade(strategy.late),
      end: grade(strategy.end),
    },
  };
}

function sanitizeRace(value: unknown): RaceConfig {
  const raw = isRecord(value) ? value : {};
  return {
    surface: oneOf(raw.surface, SURFACES, 'turf'),
    distanceClass: oneOf(raw.distanceClass, DISTANCES, 'medium'),
    strategy: oneOf(raw.strategy, STRATEGIES, 'pace'),
    fieldSize: Math.round(clampNumber(raw.fieldSize, 9, 2, 18)),
  };
}

function sanitizeSkillIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const ids: number[] = [];
  for (const entry of value) {
    const n = finiteNumber(entry);
    if (n !== null) {
      const id = Math.round(n);
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

function sanitizeCostOverrides(value: unknown): Record<number, number> {
  const out: Record<number, number> = {};
  if (!isRecord(value)) return out;
  for (const [key, raw] of Object.entries(value)) {
    const id = Number(key);
    const cost = finiteNumber(raw);
    if (Number.isInteger(id) && cost !== null && cost >= 0) {
      out[id] = Math.round(cost);
    }
  }
  return out;
}

/**
 * Decode a share payload (the opaque string produced by {@link encodeBuild})
 * back into a Build. Every field is validated and coerced to a safe value;
 * structurally unusable input yields `null`. Never throws.
 */
export function decodeBuild(hash: string): Build | null {
  if (typeof hash !== 'string' || hash.length === 0) return null;
  let parsed: unknown;
  try {
    const json = decompressFromEncodedURIComponent(hash);
    if (!json) return null;
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.v !== SHARE_VERSION || !isRecord(parsed.build)) {
    return null;
  }
  const raw = parsed.build;
  return {
    id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : '',
    name:
      typeof raw.name === 'string' && raw.name.trim().length > 0
        ? raw.name.trim().slice(0, 120)
        : 'Shared Build',
    createdAt: clampNumber(raw.createdAt, Date.now(), 0, 8_640_000_000_000_000),
    uma: sanitizeUma(raw.uma),
    aptitudes: sanitizeAptitudes(raw.aptitudes),
    race: sanitizeRace(raw.race),
    skillIds: sanitizeSkillIds(raw.skillIds),
    costOverrides: sanitizeCostOverrides(raw.costOverrides),
    spBudget: Math.round(clampNumber(raw.spBudget, 600, 0, 99999)),
  };
}

/**
 * Extract and decode a build from a `location.hash` value.
 * Accepts `#build=…`, `build=…`, or the parameter anywhere in an
 * `&`-separated hash. Returns `null` when absent or malformed.
 */
export function parseShareHash(hash: string): Build | null {
  if (typeof hash !== 'string') return null;
  const match = /(?:^#?|[#&])build=([^&\s]+)/.exec(hash);
  if (!match) return null;
  return decodeBuild(match[1]);
}
