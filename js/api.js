// ============================================
// API - Conexión con Google Apps Script
// CORREGIDO: Manejo de CORS con Google Apps Script
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

      const response = await fetch(url.toString(), {
        method: 'GET',
        redirect: 'follow',
      });

      if (!response.ok) throw new Error('Error de red: ' + response.status);
      
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch(e) {
        throw new Error('Respuesta no válida del servidor');
      }
      
      if (data.error) throw new Error(data.error);
      return data;
    } catch (err) {
      console.error('API GET ' + action + ':', err);
      throw err;
    }
  },

  // POST request (para guardar gestiones)
  async post(action, body = {}) {
    try {
      const response = await fetch(CONFIG.API_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, ...body }),
      });

      if (!response.ok) throw new Error('Error de red: ' + response.status);
      
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch(e) {
        throw new Error('Respuesta no válida del servidor');
      }
      
      if (data.error) throw new Error(data.error);
      return data;
    } catch (err) {
      console.error('API POST ' + action + ':', err);
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
