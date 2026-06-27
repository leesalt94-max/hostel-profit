const Store = {
  _k: { agency: 'hpa2_agency', hostel: 'hpa2_hostel' },

  save(type, data) {
    try { localStorage.setItem(this._k[type], JSON.stringify(data)); } catch {}
  },

  load(type) {
    try {
      const s = localStorage.getItem(this._k[type]);
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  },

  has(type) {
    return !!localStorage.getItem(this._k[type]);
  },

  clear(type) {
    localStorage.removeItem(this._k[type]);
  },
};
