# ULID Tools

ULID (Universally Unique Lexicographically Sortable Identifier) の生成・変換を行うWebツール。
A web tool for generating and converting ULIDs.

## Features

### Generate

ULIDを生成し、複数フォーマットで表示する。
Generate ULIDs and display them in multiple formats.

- タイムスタンプ指定可能（空欄なら現在時刻） / Custom timestamp input (defaults to current time)
- 生成件数指定（デフォルト5件、最大100件） / Configurable count (default 5, max 100)
- 柔軟なタイムスタンプ入力（`2026-03-22T15:30:00Z`, `2026/3/22 6:33:37` など） / Flexible timestamp parsing (ISO 8601, slashes, no zero-padding, etc.)

### Convert

ULID / UUID / hex / タイムスタンプを相互変換する。
Convert between ULID, UUID, hex, and timestamps.

- 入力形式を自動判定 / Auto-detects input format
- 複数行入力対応（1行1入力） / Multi-line input (one per line)
- タイムスタンプ入力時はランダム部ゼロのULIDを生成（range queryの境界値に便利） / Timestamp input generates zero-randomness ULID (useful as range query boundaries)
- hex は `0x` プレフィックス付きも対応 / Supports `0x`-prefixed hex

### Global Settings / グローバル設定

- **uuid / hex** - 結果表示のID形式を切り替え / Toggle ID format in results
- **UTC / Localtime** - タイムスタンプの表示・解釈を切り替え（TZ指定なしの入力に影響） / Toggle timestamp display and parsing (affects inputs without explicit timezone)

### Result View / 結果表示

- **All** - 全フォーマット表示（ULID, uuid/hex, timestamp） / Show all formats
- **ULID / uuid / timestamp** - 指定カラムのみの一覧表示 + Copy all / Single-column list view with Copy all
- 各値クリックでコピー / Click any value to copy

## Tech Stack

- HTML + CSS + JavaScript（ビルド不要、静的ファイルのみ） / No build step, static files only
- [Alpine.js](https://alpinejs.dev/) - リアクティブUI / Reactive UI
- [Pico.css](https://picocss.com/) - ミニマルデザイン + ダークモード自動対応 / Minimal design with automatic dark mode
- ULID生成/パースは自前実装（Web Crypto API使用） / Custom ULID implementation using Web Crypto API

## ULID Implementation

- **Crockford's Base32**: `0123456789ABCDEFGHJKMNPQRSTVWXYZ`
- ULID = 26文字（timestamp 10文字 + randomness 16文字） / 26 chars (10 timestamp + 16 randomness)
- 128bit = UUIDと同じビット数、ロスなく相互変換可能 / Same 128 bits as UUID, lossless conversion
- タイムスタンプ: 48bit（ミリ秒精度、最大 10889年） / 48-bit timestamp (millisecond precision, max year 10889)
- ランダム部: 80bit（`crypto.getRandomValues()`） / 80-bit randomness
- Crockfordエイリアス対応（O→0, I/L→1） / Crockford aliases (O→0, I/L→1)

## Development

### Local / ローカル実行

```bash
# ES module import requires a server / module importにはサーバーが必要
npx serve docs
```

### Test / テスト

```bash
node --test test/ulid.test.js
```

## License

MIT
