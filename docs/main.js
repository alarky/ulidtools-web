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

const MAX_ULID_TIMESTAMP = 2 ** 48 - 1;

function generateULID(timestamp) {
  const now = timestamp !== undefined ? timestamp : Date.now();
  if (now < 0 || now > MAX_ULID_TIMESTAMP) {
    throw new Error('Timestamp out of range for ULID');
  }
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

// Extract timestamps from 16-byte Uint8Array (first 48 bits)
function bytesToTimestamps(bytes) {
  let ms = 0;
  for (let i = 0; i < 6; i++) {
    ms = ms * 256 + bytes[i];
  }
  const d = new Date(ms);
  const utc = d.toISOString();
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  // Timezone offset string like +09:00 or -05:00
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const tzStr = `${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
  return { utc, local: local + tzStr };
}

// Parse flexible timestamp string into epoch ms
// Returns { ms, hasTz } or null if not a timestamp
function parseTimestamp(input, useUtc) {
  // Match: YYYY[-/]MM[-/]DD[T ]HH:MM[:SS[.sss]][tz]  or  YYYY[-/]MM[-/]DD
  const m = input.match(
    /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[T ](\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.(\d+))?)?)?(.*)$/
  );
  if (!m) return null;

  const [, year, month, day, h, min, sec, msStr, tzPart] = m;
  const hours = h || '0';
  const minutes = min || '0';
  const seconds = sec || '0';
  const millis = msStr ? msStr.slice(0, 3).padEnd(3, '0') : '0';

  // Detect timezone
  const tz = tzPart ? tzPart.trim() : '';
  let hasTz = false;
  let iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}.${millis}`;

  if (tz === 'Z' || tz === 'z') {
    iso += 'Z';
    hasTz = true;
  } else if (/^[+\-]\d{1,2}(:\d{2})?$/.test(tz)) {
    iso += tz;
    hasTz = true;
  } else if (tz === '') {
    // No timezone specified — use global setting
    iso += useUtc ? 'Z' : '';
  } else {
    return null; // unknown trailing text
  }

  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return { ms: d.getTime(), hasTz };
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
  // Hex: 32 hex chars, optionally with 0x prefix
  if (/^(?:0x)?[0-9a-f]{32}$/i.test(trimmed)) {
    return 'hex';
  }
  // Timestamp (flexible)
  if (/^\d{4}[\/\-]/.test(trimmed)) {
    return 'timestamp';
  }
  return null;
}

// Convert any supported format to all formats
function parseAndConvert(input, useUtc) {
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
      bytes = hexToBytes(trimmed.replace(/^0x/i, ''));
      break;
    case 'timestamp': {
      const parsed = parseTimestamp(trimmed, useUtc);
      if (!parsed) return null;
      bytes = new Uint8Array(16);
      let val = BigInt(parsed.ms);
      for (let i = 5; i >= 0; i--) {
        bytes[i] = Number(val & 0xFFn);
        val >>= 8n;
      }
      break;
    }
  }

  return {
    format,
    ulid: bytesToUlid(bytes),
    uuid: bytesToUuid(bytes),
    hex: bytesToHex(bytes),
    timestamp: bytesToTimestamps(bytes),
  };
}

// Alpine.js app
document.addEventListener('alpine:init', () => {
  Alpine.data('ulidApp', () => ({
    // Generate
    countInput: '',
    customTime: '',
    useUtc: true,
    useUuid: true,
    genResults: [],
    genError: '',
    // Convert
    convertInput: '',
    convertResults: [],
    convertError: '',
    // Toast
    // View
    viewMode: 'all',
    viewColumns: [
      { key: 'all', label: 'All' },
      { key: 'ulid', label: 'ULID' },
      { key: 'id', label: 'uuid' },
      { key: 'ts', label: 'timestamp' },
    ],
    // Toast
    copiedField: null,
    copiedTimeout: null,
    toastX: 0,
    toastY: 0,

    init() {
      this.generate();
    },

    get columnValues() {
      return this.displayResults.map(r => {
        switch (this.viewMode) {
          case 'ulid': return r.ulid;
          case 'id': return this.useUuid ? r.uuid : r.hex;
          case 'ts': return this.useUtc ? r.timestamp.utc : r.timestamp.local;
          default: return '';
        }
      });
    },

    async copyAllColumn(event) {
      const text = this.columnValues.join('\n');
      const rect = event.currentTarget.getBoundingClientRect();
      await navigator.clipboard.writeText(text);
      if (this.copiedTimeout) clearTimeout(this.copiedTimeout);
      this.toastX = rect.right - 8;
      this.toastY = rect.top + rect.height / 2;
      this.copiedField = 'copy-all';
      this.copiedTimeout = setTimeout(() => {
        this.copiedField = null;
      }, 800);
    },

    get displayResults() {
      if (this.convertResults.length > 0) {
        return this.convertResults.map((r, i) => ({ ...r, _prefix: 'conv-' + i }));
      }
      return this.genResults.map((r, i) => ({ ...r, _prefix: 'gen-' + i }));
    },

    generate() {
      this.convertInput = '';
      this.convertResults = [];
      this.convertError = '';
      this.genResults = [];
      this.genError = '';
      let ts;
      if (this.customTime.trim()) {
        const parsed = parseTimestamp(this.customTime.trim(), this.useUtc);
        if (!parsed) {
          this.genError = 'Invalid timestamp format.';
          return;
        }
        ts = parsed.ms;
      }
      try {
        const count = parseInt(this.countInput, 10) || 5;
        for (let i = 0; i < Math.min(Math.max(count, 1), 100); i++) {
          const ulid = generateULID(ts);
          const bytes = ulidToBytes(ulid);
          this.genResults.push({
            ulid,
            uuid: bytesToUuid(bytes),
            hex: bytesToHex(bytes),
            timestamp: bytesToTimestamps(bytes),
          });
        }
      } catch (e) {
        this.genError = e.message;
      }
    },

    convert() {
      this.genResults = [];
      this.genError = '';
      this.convertResults = [];
      this.convertError = '';
      if (!this.convertInput.trim()) return;
      const lines = this.convertInput.split('\n').map(l => l.trim()).filter(Boolean);
      const results = [];
      const errors = [];
      for (let i = 0; i < lines.length; i++) {
        try {
          const result = parseAndConvert(lines[i], this.useUtc);
          if (result) {
            results.push(result);
          } else {
            errors.push(`Line ${i + 1}: invalid input`);
          }
        } catch (e) {
          errors.push(`Line ${i + 1}: ${e.message}`);
        }
      }
      this.convertResults = results;
      if (errors.length > 0) {
        this.convertError = errors.join('\n');
      }
    },

    resultFields(r, prefix) {
      return [
        { label: 'ULID:', value: r.ulid, id: prefix + '-ulid' },
        { label: this.useUuid ? 'uuid:' : 'hex:', value: this.useUuid ? r.uuid : r.hex, id: prefix + '-id' },
        { label: 'timestamp:', value: this.useUtc ? r.timestamp.utc : r.timestamp.local, id: prefix + '-ts' },
      ];
    },

    async copyValue(text, fieldId, event) {
      const rect = event.currentTarget.getBoundingClientRect();
      await navigator.clipboard.writeText(text);
      if (this.copiedTimeout) clearTimeout(this.copiedTimeout);
      this.toastX = rect.right - 8;
      this.toastY = rect.top + rect.height / 2;
      this.copiedField = fieldId;
      this.copiedTimeout = setTimeout(() => {
        this.copiedField = null;
      }, 800);
    },
  }));
});
