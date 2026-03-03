// ============================================
// CONFIGURACIÓN - COBROS PRO v3
// ============================================
const CONFIG = {
  // ⚡ CAMBIAR ESTA URL por tu Apps Script Web App
  API_URL: 'https://script.google.com/macros/s/TU_ID_AQUI/exec',

  DIA_CIERRE: 8,
  MIN_BALANCE: 5,

  // Usuarios del sistema (también se pueden manejar desde Sheets)
  USUARIOS: [
    { id: 'admin', nombre: 'Administrador', pass: '1234', rol: 'gerente', avatar: 'A' },
    { id: 'gestor1', nombre: 'Gestor 1', pass: '1234', rol: 'gestor', avatar: 'G1' },
    { id: 'gestor2', nombre: 'Gestor 2', pass: '1234', rol: 'gestor', avatar: 'G2' },
    { id: 'super1', nombre: 'Supervisor', pass: '1234', rol: 'supervisor', avatar: 'S' },
  ],

  // Permisos por rol
  ROLES: {
    gerente: {
      label: 'Gerente',
      tabs: ['dashboard', 'cartera', 'hoy', 'historial', 'pagos', 'usuarios'],
      canEditUsers: true,
      canSeeAllGestiones: true,
      canDelete: true,
    },
    supervisor: {
      label: 'Supervisor',
      tabs: ['dashboard', 'cartera', 'hoy', 'historial', 'pagos'],
      canEditUsers: false,
      canSeeAllGestiones: true,
      canDelete: false,
    },
    gestor: {
      label: 'Gestor',
      tabs: ['dashboard', 'cartera', 'hoy', 'historial', 'pagos'],
      canEditUsers: false,
      canSeeAllGestiones: false,
      canDelete: false,
    },
  },

  ESTADOS: [
    { value: 'pagado', label: 'Pagado', color: '#22c55e', bg: 'rgba(34,197,94,.15)', icon: '✅' },
    { value: 'promesa', label: 'Promesa de Pago', color: '#f59e0b', bg: 'rgba(245,158,11,.12)', icon: '🤝' },
    { value: 'no_contesta', label: 'No Contesta', color: '#6b7280', bg: 'rgba(107,114,128,.12)', icon: '📵' },
    { value: 'mensaje_enviado', label: 'Mensaje Enviado', color: '#3b82f6', bg: 'rgba(59,130,246,.12)', icon: '💬' },
    { value: 'rechaza_pago', label: 'Rechaza Pago', color: '#ef4444', bg: 'rgba(239,68,68,.12)', icon: '❌' },
    { value: 'ilocalizable', label: 'Ilocalizable', color: '#a855f7', bg: 'rgba(168,85,247,.12)', icon: '❓' },
    { value: 'pendiente', label: 'Pendiente', color: '#64748b', bg: 'rgba(100,116,139,.1)', icon: '⏳' },
  ],

  TABS: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'cartera', label: 'Cartera', icon: '📋' },
    { id: 'hoy', label: 'Gestión Hoy', icon: '📞' },
    { id: 'historial', label: 'Historial', icon: '📜' },
    { id: 'pagos', label: 'Pagos', icon: '💰' },
    { id: 'usuarios', label: 'Usuarios', icon: '👥' },
  ],
};
