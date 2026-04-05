// Alpine.js application for ULID Tools
// ULID Toolsの Alpine.js アプリケーション
import {
  generateULID, ulidToBytes, bytesToUuid, bytesToHex,
  bytesToTimestamps, parseTimestamp, parseAndConvert,
} from './ulid.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('ulidApp', () => ({
    // --- State: Generate / 生成の状態 ---
    countInput: '',
    customTime: '',
    useUtc: true,       // Toggle UTC / Localtime display / UTC・ローカルタイム表示切替
    useUuid: true,      // Toggle uuid / hex display / uuid・hex 表示切替
    genResults: [],
    genError: '',

    // --- State: Convert / 変換の状態 ---
    convertInput: '',
    convertResults: [],
    convertError: '',

    // --- State: Result view / 結果表示の状態 ---
    viewMode: 'all',
    viewColumns: [
      { key: 'all', label: 'All' },
      { key: 'ulid', label: 'ULID' },
      { key: 'id', label: 'uuid' },
      { key: 'ts', label: 'timestamp' },
    ],

    // --- State: Copy toast / コピー通知トーストの状態 ---
    copiedField: null,
    copiedTimeout: null,
    toastX: 0,
    toastY: 0,

    // Generate ULIDs on init / 初期化時にULIDを生成
    init() {
      this.generate();
    },

    // Return values for single-column view mode
    // カラムモード表示用の値一覧を返す
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

    // Copy all values in the current column view to clipboard
    // 現在のカラム表示の全値をクリップボードにコピー
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

    // Merge generate/convert results for display; convert takes priority
    // 表示用に生成・変換結果を統合（変換結果があればそちらを優先）
    get displayResults() {
      if (this.convertResults.length > 0) {
        return this.convertResults.map((r, i) => ({ ...r, _prefix: 'conv-' + i }));
      }
      return this.genResults.map((r, i) => ({ ...r, _prefix: 'gen-' + i }));
    },

    // Generate ULIDs with optional custom timestamp and count (max 10000)
    // 任意のタイムスタンプ・件数でULIDを生成（最大10000件）
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
        for (let i = 0; i < Math.min(Math.max(count, 1), 10000); i++) {
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

    // Parse each line of input and convert between ULID/UUID/hex/timestamp
    // 入力の各行をパースし、ULID・UUID・hex・タイムスタンプ間で相互変換
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

    // Build field list for "All" view mode (ULID, uuid/hex, timestamp)
    // 「All」表示モード用のフィールド一覧を生成（ULID, uuid/hex, timestamp）
    resultFields(r, prefix) {
      return [
        { label: 'ULID:', value: r.ulid, id: prefix + '-ulid' },
        { label: this.useUuid ? 'uuid:' : 'hex:', value: this.useUuid ? r.uuid : r.hex, id: prefix + '-id' },
        { label: 'timestamp:', value: this.useUtc ? r.timestamp.utc : r.timestamp.local, id: prefix + '-ts' },
      ];
    },

    // Copy a single value to clipboard and show toast at click position
    // 値をクリップボードにコピーし、クリック位置にトーストを表示
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
