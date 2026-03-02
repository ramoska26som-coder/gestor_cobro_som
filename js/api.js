// ============================================
// API - Conexión con Google Apps Script
// ============================================

const API = {
  // GET request
  async get(action, params = {}) {
    try {
      const url = new URL(CONFIG.API_URL);
      url.searchParams.append('action', action);
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          url.searchParams.append(k, v);
        }
      });

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Error de red: ' + response.status);
      
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      return data;
    } catch (err) {
      console.error(`API GET ${action}:`, err);
      throw err;
    }
  },

  // POST request
  async post(action, body = {}) {
    try {
      const response = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action, ...body }),
      });

      if (!response.ok) throw new Error('Error de red: ' + response.status);
      
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      return data;
    } catch (err) {
      console.error(`API POST ${action}:`, err);
      throw err;
    }
  },

  // Métodos específicos
  async getPrestamos() {
    return this.get('getPrestamos');
  },

  async getPagos(fechaInicio, fechaFin) {
    return this.get('getPagos', { fechaInicio, fechaFin });
  },

  async getGestiones(fechaInicio, fechaFin) {
    return this.get('getGestiones', { fechaInicio, fechaFin });
  },

  async getDashboard() {
    return this.get('getDashboard');
  },

  async guardarGestion(gestion) {
    return this.post('guardarGestion', { gestion });
  },
};
