// ============================================
// CONFIGURACIÓN DE LA APP
// ============================================
// INSTRUCCIONES:
// 1. Publicá tu Apps Script como Web App
// 2. Copiá la URL y pegala aquí abajo
// 3. Subí a GitHub Pages
// ============================================

const CONFIG = {
  // URL de tu Google Apps Script Web App
  API_URL: 'https://script.google.com/macros/s/AKfycbyjLrMeHNPCBEcRRVx2m5HXhbbKnKjh7Rr8OZOxetK8d4ouodF1zoP58UtpvqBKkIvC/exec',
  
  // Nombre del gestor (podés cambiarlo por gestor)
  GESTOR_NOMBRE: 'Gestor 1',
  
  // Zona horaria
  TIMEZONE: 'America/Tegucigalpa',
  
  // Día de cierre de mes
  DIA_CIERRE: 8,
  
  // Mínimo para considerar préstamo activo
  MIN_BALANCE_ACTIVO: 5,
  
  // Estados de gestión disponibles
  ESTADOS: [
    { value: 'pagado', label: 'Pagado', color: '#16a34a', bg: '#dcfce7', icon: '✅' },
    { value: 'promesa', label: 'Promesa de Pago', color: '#d97706', bg: '#fef3c7', icon: '🤝' },
    { value: 'no_contesta', label: 'No Contesta', color: '#6b7280', bg: '#f3f4f6', icon: '📵' },
    { value: 'mensaje_enviado', label: 'Mensaje Enviado', color: '#2563eb', bg: '#dbeafe', icon: '💬' },
    { value: 'rechaza_pago', label: 'Rechaza Pago', color: '#dc2626', bg: '#fee2e2', icon: '❌' },
    { value: 'ilocalizable', label: 'Ilocalizable', color: '#7c3aed', bg: '#ede9fe', icon: '❓' },
    { value: 'pendiente', label: 'Pendiente', color: '#94a3b8', bg: '#f1f5f9', icon: '⏳' },
  ],
};
