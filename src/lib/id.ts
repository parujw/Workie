const ALPHABET = 'abcdefghijkmnopqrstuvwxyz0123456789';

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(out);
  } else {
    for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  }
  return out;
}

export function randomId(length = 16): string {
  const bytes = randomBytes(length);
  let s = '';
  for (let i = 0; i < length; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s;
}

/** Prefixed id, e.g. `prj_k3n...`. Stable forever; renames never touch it. */
export function newId(prefix: string): string {
  return `${prefix}_${randomId(14)}`;
}

/**
 * Workspace ids double as the access secret (there is no login), so they are
 * deliberately long and unguessable.
 */
export function newWorkspaceId(): string {
  return `ws_${randomId(24)}`;
}
