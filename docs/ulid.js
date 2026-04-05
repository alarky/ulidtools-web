// ===== Crockford's Base32 encoding table / エンコードテーブル =====
// Characters: 0-9 A-H J-K M N P-T V-W X-Y Z (excludes I, L, O, U)
// 文字セット: I, L, O, U を除いた32文字
export const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

// Build decoding map (char -> value) / デコード用マップ（文字 → 値）を構築
export const DECODING = {};
for (let i = 0; i < ENCODING.length; i++) {
  DECODING[ENCODING[i]] = i;
}
// Allow lowercase input / 小文字入力にも対応
for (let i = 0; i < ENCODING.length; i++) {
  DECODING[ENCODING[i].toLowerCase()] = i;
}
// Crockford aliases: O→0, I/L→1 / Crockfordエイリアス: O→0, I/L→1
DECODING['O'] = 0; DECODING['o'] = 0;
DECODING['I'] = 1; DECODING['i'] = 1;
DECODING['L'] = 1; DECODING['l'] = 1;

// ===== Encode / エンコード =====

// Encode a millisecond timestamp into Base32 string of given length
// ミリ秒タイムスタンプを指定長のBase32文字列にエンコード
export function encodeTime(now, len) {
  let str = '';
  for (let i = len - 1; i >= 0; i--) {
    const mod = now % 32;
    str = ENCODING[mod] + str;
    now = Math.floor(now / 32);
  }
  return str;
}

// Generate Base32 random string (80-bit / 16 chars) using Web Crypto API
// Web Crypto APIで80bitの乱数を生成し、Base32文字列（16文字）にエンコード
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

// ===== ULID generation / ULID生成 =====

// 48-bit max timestamp (~10889 AD) / 48bitタイムスタンプの上限（西暦10889年頃）
export const MAX_ULID_TIMESTAMP = 2 ** 48 - 1;

// Generate a ULID: 10-char timestamp + 16-char randomness = 26 chars
// ULID生成: タイムスタンプ10文字 + ランダム16文字 = 26文字
export function generateULID(timestamp) {
  const now = timestamp !== undefined ? timestamp : Date.now();
  if (now < 0 || now > MAX_ULID_TIMESTAMP) {
    throw new Error('Timestamp out of range for ULID');
  }
  const timeStr = encodeTime(now, 10);
  const randStr = encodeRandom(10);
  return timeStr + randStr;
}

// ===== Conversion: ULID <-> bytes (128-bit) / ULID ↔ バイト列（128bit）変換 =====

// Decode a 26-char ULID string into 16 bytes
// 26文字のULID文字列を16バイトにデコード
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

// Encode 16 bytes into a 26-char ULID string
// 16バイトを26文字のULID文字列にエンコード
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

// ===== Conversion: bytes <-> hex / バイト列 ↔ hex 変換 =====

// Convert 16 bytes to 32-char hex string
// 16バイトを32文字のhex文字列に変換
export function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Parse 32-char hex string into 16 bytes
// 32文字のhex文字列を16バイトにパース
export function hexToBytes(hex) {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// ===== Conversion: bytes <-> UUID / バイト列 ↔ UUID 変換 =====

// Convert 16 bytes to UUID string (8-4-4-4-12 format)
// 16バイトをUUID文字列（8-4-4-4-12形式）に変換
export function bytesToUuid(bytes) {
  const hex = bytesToHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Parse UUID string into 16 bytes (strip hyphens and decode hex)
// UUID文字列を16バイトにパース（ハイフンを除去してhexデコード）
export function uuidToBytes(uuid) {
  const hex = uuid.replace(/-/g, '');
  return hexToBytes(hex);
}

// ===== Timestamp extraction / タイムスタンプ抽出 =====

// Extract 48-bit timestamp from first 6 bytes and format as UTC and local time
// 先頭6バイトから48bitタイムスタンプを抽出し、UTCとローカルタイムに変換
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

// ===== Timestamp parsing / タイムスタンプパース =====

// Parse flexible timestamp formats (ISO 8601, slashes, no zero-padding, etc.)
// 柔軟なタイムスタンプ形式をパース（ISO 8601、スラッシュ区切り、ゼロ埋めなし等）
// When no timezone is specified, useUtc flag determines interpretation
// TZ指定がない場合、useUtcフラグに従ってUTCまたはローカルとして解釈
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

// ===== Input format detection / 入力形式の自動判定 =====

// Auto-detect input format: uuid, ulid, hex (with optional 0x prefix), or timestamp
// 入力形式を自動判定: uuid, ulid, hex（0xプレフィックス付きも可）, タイムスタンプ
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

// ===== Unified conversion / 統合変換 =====

// Parse any supported format and convert to all formats (ulid, uuid, hex, timestamp)
// 対応する任意の形式をパースし、全形式（ulid, uuid, hex, timestamp）に変換
// For timestamp input, generates a zero-randomness ULID (useful as range query boundaries)
// タイムスタンプ入力時はランダム部ゼロのULIDを生成（range queryの境界値に便利）
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
      // Set timestamp in first 6 bytes, randomness stays zero
      // 先頭6バイトにタイムスタンプを設定、ランダム部はゼロのまま
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
