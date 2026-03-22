// Crockford's Base32
export const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const DECODING = {};
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

export function encodeTime(now, len) {
  let str = '';
  for (let i = len - 1; i >= 0; i--) {
    const mod = now % 32;
    str = ENCODING[mod] + str;
    now = Math.floor(now / 32);
  }
  return str;
}

export function encodeRandom(len) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
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

export const MAX_ULID_TIMESTAMP = 2 ** 48 - 1;

export function generateULID(timestamp) {
  const now = timestamp !== undefined ? timestamp : Date.now();
  if (now < 0 || now > MAX_ULID_TIMESTAMP) {
    throw new Error('Timestamp out of range for ULID');
  }
  const timeStr = encodeTime(now, 10);
  const randStr = encodeRandom(10);
  return timeStr + randStr;
}

export function ulidToBytes(ulid) {
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

export function bytesToUlid(bytes) {
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

export function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex) {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

export function bytesToUuid(bytes) {
  const hex = bytesToHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function uuidToBytes(uuid) {
  const hex = uuid.replace(/-/g, '');
  return hexToBytes(hex);
}

export function bytesToTimestamps(bytes) {
  let ms = 0;
  for (let i = 0; i < 6; i++) {
    ms = ms * 256 + bytes[i];
  }
  const d = new Date(ms);
  const utc = d.toISOString();
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const tzStr = `${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
  return { utc, local: local + tzStr };
}

export function parseTimestamp(input, useUtc) {
  const m = input.match(
    /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[T ](\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.(\d+))?)?)?(.*)$/
  );
  if (!m) return null;

  const [, year, month, day, h, min, sec, msStr, tzPart] = m;
  const hours = h || '0';
  const minutes = min || '0';
  const seconds = sec || '0';
  const millis = msStr ? msStr.slice(0, 3).padEnd(3, '0') : '0';

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
    iso += useUtc ? 'Z' : '';
  } else {
    return null;
  }

  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return { ms: d.getTime(), hasTz };
}

export function detectFormat(input) {
  const trimmed = input.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return 'uuid';
  }
  if (/^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/.test(trimmed)) {
    return 'ulid';
  }
  if (/^(?:0x)?[0-9a-f]{32}$/i.test(trimmed)) {
    return 'hex';
  }
  if (/^\d{4}[\/\-]/.test(trimmed)) {
    return 'timestamp';
  }
  return null;
}

export function parseAndConvert(input, useUtc) {
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
