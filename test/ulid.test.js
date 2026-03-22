import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateULID, ulidToBytes, bytesToUlid,
  bytesToHex, hexToBytes, bytesToUuid, uuidToBytes,
  bytesToTimestamps, parseTimestamp, detectFormat,
  parseAndConvert, encodeTime, MAX_ULID_TIMESTAMP,
} from '../docs/ulid.js';

describe('encodeTime', () => {
  it('encodes 0 as 10 zero chars', () => {
    assert.equal(encodeTime(0, 10), '0000000000');
  });

  it('encodes known timestamp', () => {
    // 1700000000000 ms = 2023-11-14T22:13:20.000Z
    const encoded = encodeTime(1700000000000, 10);
    assert.equal(encoded.length, 10);
    // Decode back to verify
    const bytes = ulidToBytes(encoded + '0000000000000000');
    const ts = bytesToTimestamps(bytes);
    assert.equal(ts.utc, '2023-11-14T22:13:20.000Z');
  });
});

describe('generateULID', () => {
  it('returns 26 character string', () => {
    const ulid = generateULID();
    assert.equal(ulid.length, 26);
  });

  it('uses provided timestamp', () => {
    const ms = 1700000000000;
    const ulid = generateULID(ms);
    const bytes = ulidToBytes(ulid);
    const ts = bytesToTimestamps(bytes);
    assert.equal(ts.utc, '2023-11-14T22:13:20.000Z');
  });

  it('generates different ULIDs each time', () => {
    const a = generateULID();
    const b = generateULID();
    assert.notEqual(a, b);
  });

  it('throws on negative timestamp', () => {
    assert.throws(() => generateULID(-1), /out of range/);
  });

  it('throws on timestamp exceeding 48 bits', () => {
    assert.throws(() => generateULID(MAX_ULID_TIMESTAMP + 1), /out of range/);
  });

  it('accepts max timestamp', () => {
    const ulid = generateULID(MAX_ULID_TIMESTAMP);
    assert.equal(ulid.length, 26);
  });
});

describe('ULID <-> bytes roundtrip', () => {
  it('roundtrips correctly', () => {
    const ulid = generateULID();
    const bytes = ulidToBytes(ulid);
    const back = bytesToUlid(bytes);
    assert.equal(back, ulid);
  });

  it('handles all-zero ULID', () => {
    const ulid = '00000000000000000000000000';
    const bytes = ulidToBytes(ulid);
    assert.deepEqual(bytes, new Uint8Array(16));
    assert.equal(bytesToUlid(bytes), ulid);
  });

  it('handles max ULID', () => {
    const ulid = '7ZZZZZZZZZZZZZZZZZZZZZZZZZ';
    const bytes = ulidToBytes(ulid);
    const back = bytesToUlid(bytes);
    assert.equal(back, ulid);
  });

  it('accepts lowercase input', () => {
    const ulid = generateULID();
    const lower = ulid.toLowerCase();
    const bytes = ulidToBytes(lower);
    assert.equal(bytesToUlid(bytes), ulid);
  });
});

describe('hex conversion', () => {
  it('roundtrips bytes -> hex -> bytes', () => {
    const ulid = generateULID();
    const bytes = ulidToBytes(ulid);
    const hex = bytesToHex(bytes);
    assert.equal(hex.length, 32);
    const back = hexToBytes(hex);
    assert.deepEqual(back, bytes);
  });

  it('produces lowercase hex', () => {
    const bytes = new Uint8Array([0xAB, 0xCD, 0xEF, 0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF, 0x01, 0x23, 0x45, 0x67, 0x89]);
    const hex = bytesToHex(bytes);
    assert.equal(hex, 'abcdef0123456789abcdef0123456789');
  });
});

describe('UUID conversion', () => {
  it('roundtrips bytes -> uuid -> bytes', () => {
    const ulid = generateULID();
    const bytes = ulidToBytes(ulid);
    const uuid = bytesToUuid(bytes);
    const back = uuidToBytes(uuid);
    assert.deepEqual(back, bytes);
  });

  it('formats as 8-4-4-4-12', () => {
    const uuid = bytesToUuid(new Uint8Array(16));
    assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe('ULID <-> UUID <-> hex interop', () => {
  it('same 128-bit value across all formats', () => {
    const ulid = generateULID();
    const bytes = ulidToBytes(ulid);
    const uuid = bytesToUuid(bytes);
    const hex = bytesToHex(bytes);

    // UUID -> bytes -> ULID
    assert.equal(bytesToUlid(uuidToBytes(uuid)), ulid);
    // hex -> bytes -> ULID
    assert.equal(bytesToUlid(hexToBytes(hex)), ulid);
    // UUID -> hex
    assert.equal(uuid.replace(/-/g, ''), hex);
  });
});

describe('bytesToTimestamps', () => {
  it('extracts correct UTC timestamp', () => {
    const ms = 1700000000000;
    const ulid = generateULID(ms);
    const bytes = ulidToBytes(ulid);
    const ts = bytesToTimestamps(bytes);
    assert.equal(ts.utc, '2023-11-14T22:13:20.000Z');
  });

  it('extracts epoch 0', () => {
    const bytes = new Uint8Array(16);
    const ts = bytesToTimestamps(bytes);
    assert.equal(ts.utc, '1970-01-01T00:00:00.000Z');
  });
});

describe('detectFormat', () => {
  it('detects ULID', () => {
    assert.equal(detectFormat('01HGW3J5P7C1YRD6F4E2Z0KXMN'), 'ulid');
  });

  it('detects UUID', () => {
    assert.equal(detectFormat('0190a5c2-d1a0-7000-8000-000000000000'), 'uuid');
  });

  it('detects UUID case-insensitive', () => {
    assert.equal(detectFormat('0190A5C2-D1A0-7000-8000-000000000000'), 'uuid');
  });

  it('detects hex', () => {
    assert.equal(detectFormat('0190a5c2d1a070008000000000000000'), 'hex');
  });

  it('detects hex with 0x prefix', () => {
    assert.equal(detectFormat('0x0190a5c2d1a070008000000000000000'), 'hex');
  });

  it('detects timestamp ISO', () => {
    assert.equal(detectFormat('2024-03-15T12:00:00Z'), 'timestamp');
  });

  it('detects timestamp with slashes', () => {
    assert.equal(detectFormat('2024/03/15 12:00:00'), 'timestamp');
  });

  it('returns null for garbage', () => {
    assert.equal(detectFormat('hello world'), null);
  });

  it('returns null for empty', () => {
    assert.equal(detectFormat(''), null);
  });
});

describe('parseTimestamp', () => {
  it('parses ISO 8601 with Z', () => {
    const r = parseTimestamp('2024-03-15T12:34:56.789Z', true);
    assert.equal(r.ms, new Date('2024-03-15T12:34:56.789Z').getTime());
    assert.equal(r.hasTz, true);
  });

  it('parses with timezone offset', () => {
    const r = parseTimestamp('2024-03-15T21:34:56.789+09:00', true);
    assert.equal(r.ms, new Date('2024-03-15T12:34:56.789Z').getTime());
    assert.equal(r.hasTz, true);
  });

  it('parses slash-separated', () => {
    const r = parseTimestamp('2024/03/15 12:34:56', true);
    assert.equal(r.ms, new Date('2024-03-15T12:34:56.000Z').getTime());
  });

  it('parses without zero-padding', () => {
    const r = parseTimestamp('2024/3/5 6:7:8', true);
    assert.equal(r.ms, new Date('2024-03-05T06:07:08.000Z').getTime());
  });

  it('parses date only', () => {
    const r = parseTimestamp('2024-03-15', true);
    assert.equal(r.ms, new Date('2024-03-15T00:00:00.000Z').getTime());
  });

  it('uses UTC when useUtc=true and no tz', () => {
    const r = parseTimestamp('2024-03-15T12:00:00', true);
    assert.equal(r.ms, new Date('2024-03-15T12:00:00.000Z').getTime());
  });

  it('uses local when useUtc=false and no tz', () => {
    const r = parseTimestamp('2024-03-15T12:00:00', false);
    assert.equal(r.ms, new Date('2024-03-15T12:00:00').getTime());
  });

  it('explicit tz overrides useUtc flag', () => {
    const a = parseTimestamp('2024-03-15T12:00:00Z', false);
    const b = parseTimestamp('2024-03-15T12:00:00Z', true);
    assert.equal(a.ms, b.ms);
  });

  it('truncates milliseconds beyond 3 digits', () => {
    const r = parseTimestamp('2024-03-15T12:00:00.78901Z', true);
    assert.equal(r.ms, new Date('2024-03-15T12:00:00.789Z').getTime());
  });

  it('returns null for invalid input', () => {
    assert.equal(parseTimestamp('not a date', true), null);
  });

  it('returns null for trailing garbage', () => {
    assert.equal(parseTimestamp('2024-03-15T12:00:00 garbage', true), null);
  });
});

describe('parseAndConvert', () => {
  it('converts ULID input', () => {
    const ulid = generateULID(1700000000000);
    const r = parseAndConvert(ulid, true);
    assert.equal(r.format, 'ulid');
    assert.equal(r.ulid, ulid);
    assert.equal(r.timestamp.utc, '2023-11-14T22:13:20.000Z');
  });

  it('converts UUID input', () => {
    const ulid = generateULID();
    const bytes = ulidToBytes(ulid);
    const uuid = bytesToUuid(bytes);
    const r = parseAndConvert(uuid, true);
    assert.equal(r.format, 'uuid');
    assert.equal(r.ulid, ulid);
  });

  it('converts hex input', () => {
    const ulid = generateULID();
    const bytes = ulidToBytes(ulid);
    const hex = bytesToHex(bytes);
    const r = parseAndConvert(hex, true);
    assert.equal(r.format, 'hex');
    assert.equal(r.ulid, ulid);
  });

  it('converts 0x-prefixed hex', () => {
    const ulid = generateULID();
    const bytes = ulidToBytes(ulid);
    const hex = '0x' + bytesToHex(bytes);
    const r = parseAndConvert(hex, true);
    assert.equal(r.format, 'hex');
    assert.equal(r.ulid, ulid);
  });

  it('converts timestamp to zero-value ULID', () => {
    const r = parseAndConvert('2024-03-15T12:00:00Z', true);
    assert.equal(r.format, 'timestamp');
    assert.equal(r.timestamp.utc, '2024-03-15T12:00:00.000Z');
    // Random part should be all zeros
    const bytes = ulidToBytes(r.ulid);
    for (let i = 6; i < 16; i++) {
      assert.equal(bytes[i], 0);
    }
  });

  it('returns null for invalid input', () => {
    assert.equal(parseAndConvert('not valid', true), null);
  });

  it('all formats point to same 128 bits', () => {
    const ulid = generateULID();
    const r = parseAndConvert(ulid, true);
    const r2 = parseAndConvert(r.uuid, true);
    const r3 = parseAndConvert(r.hex, true);
    assert.equal(r.ulid, r2.ulid);
    assert.equal(r.ulid, r3.ulid);
    assert.equal(r.uuid, r2.uuid);
    assert.equal(r.hex, r3.hex);
  });
});

describe('Crockford Base32 aliases', () => {
  it('treats O as 0', () => {
    const ulid = generateULID(0);
    // Replace first '0' with 'O'
    const modified = 'O' + ulid.slice(1);
    const bytes1 = ulidToBytes(ulid);
    const bytes2 = ulidToBytes(modified);
    assert.deepEqual(bytes1, bytes2);
  });

  it('treats I and L as 1', () => {
    const ulid = generateULID();
    // Find a '1' in the ULID and replace with I/L
    if (ulid.includes('1')) {
      const withI = ulid.replace('1', 'I');
      const withL = ulid.replace('1', 'L');
      assert.deepEqual(ulidToBytes(withI), ulidToBytes(ulid));
      assert.deepEqual(ulidToBytes(withL), ulidToBytes(ulid));
    }
  });
});
