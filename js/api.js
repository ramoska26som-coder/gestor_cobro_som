// ============================================
// API v3 - Conexión con Google Apps Script
// Corregido: CORS, redirect, error handling
// ============================================
const API = {
  async get(action, params = {}) {
    // Si la URL no está configurada, lanzar error inmediatamente
    if (!CONFIG.API_URL || CONFIG.API_URL.includes('TU_ID_AQUI')) {
      throw new Error('URL_NO_CONFIGURADA');
    }
    try {
      const url = new URL(CONFIG.API_URL);
      url.searchParams.append('action', action);
      Object.entries(params).forEach(([k, v]) => {
        if (v != null && v !== '') url.searchParams.append(k, v);
      });
      const r = await fetch(url.toString(), { method: 'GET', redirect: 'follow' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const txt = await r.text();
      try { return JSON.parse(txt); } catch(e) { throw new Error('Respuesta inválida'); }
    } catch (err) {
      console.error('API GET ' + action + ':', err);
      throw err;
    }
  },

  async post(action, body = {}) {
    if (!CONFIG.API_URL || CONFIG.API_URL.includes('TU_ID_AQUI')) {
      throw new Error('URL_NO_CONFIGURADA');
    }
    try {
      const r = await fetch(CONFIG.API_URL, {
        method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, ...body }),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const txt = await r.text();
      try { return JSON.parse(txt); } catch(e) { throw new Error('Respuesta inválida'); }
    } catch (err) {
      console.error('API POST ' + action + ':', err);
      throw err;
    }
  },

  getPrestamos() { return this.get('getPrestamos'); },
  getPagos(fi, ff) { return this.get('getPagos', { fechaInicio: fi, fechaFin: ff }); },
  getGestiones(fi, ff) { return this.get('getGestiones', { fechaInicio: fi, fechaFin: ff }); },
  getDashboard() { return this.get('getDashboard'); },
  guardarGestion(g) { return this.post('guardarGestion', { gestion: g }); },
};
