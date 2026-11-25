const PBKDF2_ITERATIONS = 100000;

function bytesToHex(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex) {
  const pairs = hex.match(/../g) || [];
  return Uint8Array.from(pairs, (byte) => parseInt(byte, 16));
}

export function makeSalt() {
  const bytes = new Uint8Array(16);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToHex(bytes);
}

export async function hashPassword(password, salt) {
  const subtle = window.crypto && window.crypto.subtle;
  if (subtle) {
    const encoder = new TextEncoder();
    const keyMaterial = await subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const derivedBits = await subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: hexToBytes(salt),
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );
    return `pbkdf2_v2:${bytesToHex(derivedBits)}`;
  }

  // Fallback for restricted non-secure environments
  let h1 = 2166136261;
  let h2 = 2246822519;
  const input = `${salt}|${password}`;
  for (let round = 0; round < 3000; round += 1) {
    for (let i = 0; i < input.length; i += 1) {
      const code = input.charCodeAt(i) + round;
      h1 = Math.imul(h1 ^ code, 16777619);
      h2 = Math.imul(h2 ^ code, 2246822519);
    }
  }
  return `local:${[h1, h2].map((v) => (v >>> 0).toString(16).padStart(8, '0')).join('')}`;
}

async function legacyV3Hash(password, salt) {
  const subtle = window.crypto && window.crypto.subtle;
  if (!subtle) return '';
  const encoder = new TextEncoder();
  const key = await subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(salt), iterations: 50000, hash: 'SHA-256' },
    key,
    256
  );
  return `pbkdf2:${bytesToHex(bits)}`;
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyPassword(password, user) {
  if (!user || !user.salt || !user.hash) return false;
  if (user.hash.startsWith('pbkdf2:')) {
    const legacyDigest = await legacyV3Hash(password, user.salt);
    return timingSafeEqual(legacyDigest, user.hash);
  }
  const digest = await hashPassword(password, user.salt);
  return timingSafeEqual(digest, user.hash);
}
