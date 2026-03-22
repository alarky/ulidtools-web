// Crockford's Base32
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const DECODING = {};
for (let i = 0; i < ENCODING.length; i++) {
  DECODING[ENCODING[i]] = i;
}
// Allow lowercase input
for (let i = 0; i < ENCODING.length; i++) {
  DECODING[ENCODING[i].toLowerCase()] = i;
}
// Crockford aliases
DECODING['O'] = 0; DECODING['o'] = 0;
DECODING['I'] = 1; DECODING['i'] = 1;
DECODING['L'] = 1; DECODING['l'] = 1;

function encodeTime(now, len) {
  let str = '';
  for (let i = len - 1; i >= 0; i--) {
    const mod = now % 32;
    str = ENCODING[mod] + str;
    now = Math.floor(now / 32);
  }
  return str;
}

function encodeRandom(len) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  // Convert random bytes to base32
  // 80 bits of randomness = 16 base32 chars
  // We need to pack bytes into a big number and extract base32 digits
  let value = 0n;
  for (const b of bytes) {
    value = (value << 8n) | BigInt(b);
  }
  let str = '';
  for (let i = 0; i < 16; i++) {
    str = ENCODING[Number(value & 31n)] + str;
    value >>= 5n;
  }
  return str;
}

function generateULID() {
  const now = Date.now();
  const timeStr = encodeTime(now, 10);
  const randStr = encodeRandom(10); // 10 bytes = 80 bits
  return timeStr + randStr;
}

// Convert ULID string (26 chars, base32) to 16-byte Uint8Array (128 bits)
function ulidToBytes(ulid) {
  let value = 0n;
  for (let i = 0; i < 26; i++) {
    const v = DECODING[ulid[i]];
    if (v === undefined) throw new Error(`Invalid ULID character: ${ulid[i]}`);
    value = value * 32n + BigInt(v);
  }
  const bytes = new Uint8Array(16);
  for (let i = 15; i >= 0; i--) {
    bytes[i] = Number(value & 0xFFn);
    value >>= 8n;
  }
  return bytes;
}

// Convert 16-byte Uint8Array to ULID string
function bytesToUlid(bytes) {
  let value = 0n;
  for (const b of bytes) {
    value = (value << 8n) | BigInt(b);
  }
  let str = '';
  for (let i = 0; i < 26; i++) {
    str = ENCODING[Number(value & 31n)] + str;
    value >>= 5n;
  }
  return str;
}

// Convert 16-byte Uint8Array to hex string (32 chars, lowercase)
function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Convert hex string (32 chars) to 16-byte Uint8Array
function hexToBytes(hex) {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// Convert 16-byte Uint8Array to UUID string (lowercase, with hyphens)
function bytesToUuid(bytes) {
  const hex = bytesToHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Convert UUID string to 16-byte Uint8Array
function uuidToBytes(uuid) {
  const hex = uuid.replace(/-/g, '');
  return hexToBytes(hex);
}

// Extract timestamp from 16-byte Uint8Array (first 48 bits)
function bytesToTimestamp(bytes) {
  let ms = 0;
  for (let i = 0; i < 6; i++) {
    ms = ms * 256 + bytes[i];
  }
  return new Date(ms).toISOString();
}

// Detect input format
function detectFormat(input) {
  const trimmed = input.trim();
  // UUID: 8-4-4-4-12 hex with hyphens
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return 'uuid';
  }
  // ULID: 26 chars, Crockford's Base32
  if (/^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/.test(trimmed)) {
    return 'ulid';
  }
  // Hex: 32 hex chars
  if (/^[0-9a-f]{32}$/i.test(trimmed)) {
    return 'hex';
  }
  return null;
}

// Convert any supported format to all formats
function convertInput(input) {
  const trimmed = input.trim();
  const format = detectFormat(trimmed);
  if (!format) return null;

  let bytes;
  switch (format) {
    case 'ulid':
      bytes = ulidToBytes(trimmed.toUpperCase());
      break;
    case 'uuid':
      bytes = uuidToBytes(trimmed);
      break;
    case 'hex':
      bytes = hexToBytes(trimmed);
      break;
  }

  return {
    format,
    ulid: bytesToUlid(bytes),
    uuid: bytesToUuid(bytes),
    hex: bytesToHex(bytes),
    timestamp: bytesToTimestamp(bytes),
  };
}

// Alpine.js app
document.addEventListener('alpine:init', () => {
  Alpine.data('ulidApp', () => ({
    // Generate
    count: 5,
    results: [],
    // Convert
    convertInput: '',
    convertResult: null,
    convertError: '',
    // Toast
    copiedField: null,
    copiedTimeout: null,

    init() {
      this.generate();
    },

    generate() {
      this.results = [];
      for (let i = 0; i < this.count; i++) {
        const ulid = generateULID();
        const bytes = ulidToBytes(ulid);
        this.results.push({
          ulid,
          uuid: bytesToUuid(bytes),
          hex: bytesToHex(bytes),
          timestamp: bytesToTimestamp(bytes),
        });
      }
    },

    reset() {
      this.results = [];
      this.count = 5;
    },

    convert() {
      this.convertResult = null;
      this.convertError = '';
      if (!this.convertInput.trim()) return;
      try {
        const result = convertInput(this.convertInput);
        if (!result) {
          this.convertError = 'Invalid input. Please enter a valid ULID, UUID, or hex string.';
          return;
        }
        this.convertResult = result;
      } catch (e) {
        this.convertError = e.message;
      }
    },

    async copyValue(text, fieldId) {
      try {
        await navigator.clipboard.writeText(text);
        if (this.copiedTimeout) clearTimeout(this.copiedTimeout);
        this.copiedField = fieldId;
        this.copiedTimeout = setTimeout(() => {
          this.copiedField = null;
        }, 800);
      } catch {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        this.copiedField = fieldId;
        this.copiedTimeout = setTimeout(() => {
          this.copiedField = null;
        }, 800);
      }
    },
  }));
});
