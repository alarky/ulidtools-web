import {
  generateULID, ulidToBytes, bytesToUuid, bytesToHex,
  bytesToTimestamps, parseTimestamp, parseAndConvert,
} from './ulid.js';

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
