import { useEffect, useState } from "react";

// useState wrapper that persists to localStorage. On mount it tries to
// load the saved value; on each change it writes back. If localStorage
// is unavailable (private browsing, etc.) it falls back to a normal
// in-memory state — never throws.
//
// Bumping STORAGE_VERSION invalidates all saved entries (use when our
// state shape changes incompatibly).

export const STORAGE_VERSION = "1";
const KEY_PREFIX = `ump:v${STORAGE_VERSION}:`;

export function usePersistedState<T>(
  key: string,
  initialValue: T,
  // Optional validator — return false to fall back to initialValue.
  // Useful when a previously-saved uma/meeting/etc. no longer exists.
  validate?: (loaded: T) => boolean
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const storageKey = KEY_PREFIX + key;

  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw === null) return initialValue;
      const parsed = JSON.parse(raw) as T;
      if (validate && !validate(parsed)) return initialValue;
      return parsed;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* quota or unavailable — silently no-op */
    }
  }, [storageKey, value]);

  return [value, setValue];
}

// Wipe everything we've persisted (used by the "Reset build" button).
export function clearPersistedBuild() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(KEY_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* no-op */
  }
}
