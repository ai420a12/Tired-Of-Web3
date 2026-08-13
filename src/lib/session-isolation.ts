/**
 * Client-side session isolation helpers.
 * Rule: private keys / seed phrases NEVER go to localStorage, cookies, or our APIs.
 */

const KEY_LIKE =
  /^(0x)?[0-9a-fA-F]{64}$|^\s*(seed|mnemonic|private)/i;

/** Safe storage key scoped to one verified wallet. */
export function walletStorageKey(
  prefix: string,
  wallet: string,
  slot: string,
): string {
  return `${prefix}:${wallet.toLowerCase()}:${slot}`;
}

/** Reject accidental persistence of secrets. */
export function assertSafeToPersist(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  if (KEY_LIKE.test(v)) return false;
  if (v.split(/\s+/).length >= 12) return false; // mnemonic-ish
  return true;
}

export function safeLocalSet(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  if (!assertSafeToPersist(value)) return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeLocalGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export const SENSITIVE_INPUT_PROPS = {
  autoComplete: "off" as const,
  autoCorrect: "off" as const,
  autoCapitalize: "off" as const,
  spellCheck: false,
  "data-lpignore": "true",
  "data-form-type": "other",
  "data-1p-ignore": "true",
};
