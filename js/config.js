// ============================================================
// CONFIGURACIÓN - COBROS PRO v4
// ============================================================
const CONFIG = {
  // ⚡ Cambia esta URL por tu Apps Script Web App
  API_URL: 'https://script.google.com/macros/s/TU_ID_AQUI/exec',

  DIA_CIERRE: 8,
  MIN_BALANCE: 5,

  // Los usuarios se cargan desde Google Sheets (no van aquí)
  USUARIOS: [],
  META_CICLO: 0,

  ROLES: {
    gerente: {
      label: 'Gerente',
      tabs: ['dashboard','cartera','hoy','historial','pagos','ranking','logros','usuarios'],
      canEditUsers: true, canSeeAllGestiones: true, canDelete: true,
    },
    supervisor: {
      label: 'Supervisor',
      tabs: ['dashboard','cartera','hoy','historial','pagos','ranking','logros'],
      canEditUsers: false, canSeeAllGestiones: true, canDelete: false,
    },
    gestor: {
      label: 'Gestor',
      tabs: ['dashboard','cartera','hoy','historial','pagos','logros'],
      canEditUsers: false, canSeeAllGestiones: false, canDelete: false,
    },
  },

  ESTADOS: [
    { value:'pagado',          label:'Pagado',           color:'#22c55e', bg:'rgba(34,197,94,.15)',   icon:'✅' },
    { value:'promesa',         label:'Promesa de Pago',  color:'#f59e0b', bg:'rgba(245,158,11,.12)',  icon:'🤝' },
    { value:'no_contesta',     label:'No Contesta',      color:'#6b7280', bg:'rgba(107,114,128,.12)', icon:'📵' },
    { value:'mensaje_enviado', label:'Mensaje Enviado',  color:'#3b82f6', bg:'rgba(59,130,246,.12)',  icon:'💬' },
    { value:'rechaza_pago',    label:'Rechaza Pago',     color:'#ef4444', bg:'rgba(239,68,68,.12)',   icon:'❌' },
    { value:'ilocalizable',    label:'Ilocalizable',     color:'#a855f7', bg:'rgba(168,85,247,.12)',  icon:'❓' },
    { value:'pendiente',       label:'Pendiente',        color:'#64748b', bg:'rgba(100,116,139,.1)',  icon:'⏳' },
  ],

  TABS: [
    { id:'dashboard', label:'Dashboard',    icon:'📊' },
    { id:'cartera',   label:'Cartera',      icon:'📋' },
    { id:'hoy',       label:'Gestión Hoy',  icon:'📞' },
    { id:'historial', label:'Historial',    icon:'📜' },
    { id:'pagos',     label:'Pagos',        icon:'💰' },
    { id:'ranking',   label:'Ranking',      icon:'🏆' },
    { id:'logros',    label:'Mis Logros',   icon:'🎖️' },
    { id:'usuarios',  label:'Usuarios',     icon:'👥' },
  ],

  // Sistema de logros
  LOGROS: [
    { id:'primera_gestion',    icon:'🌅', nombre:'Primer Paso',       desc:'Primera gestión del día',           pts:10  },
    { id:'cobro_exitoso',      icon:'💰', nombre:'Cobro Exitoso',     desc:'Registraste un pago',               pts:25  },
    { id:'cinco_gestiones',    icon:'⚡', nombre:'En Racha',          desc:'5 gestiones en el día',             pts:30  },
    { id:'diez_gestiones',     icon:'🔥', nombre:'Imparable',         desc:'10 gestiones completadas hoy',      pts:75  },
    { id:'todos_contactados',  icon:'📱', nombre:'100% Contactados',  desc:'Gestionaste todos los de hoy',      pts:100 },
    { id:'meta_diaria',        icon:'🎯', nombre:'Meta Cumplida',     desc:'Superaste la meta del día',         pts:200 },
    { id:'tres_cobros',        icon:'💎', nombre:'Cosechador',        desc:'3 cobros en el día',                pts:80  },
    { id:'sin_pendientes',     icon:'✨', nombre:'Carpeta Limpia',    desc:'Sin pendientes al final del día',   pts:150 },
    { id:'racha_3',            icon:'📅', nombre:'3 días seguidos',   desc:'Racha de 3 días con cobros',        pts:120 },
    { id:'racha_5',            icon:'🏅', nombre:'Semana perfecta',   desc:'5 días consecutivos con cobros',    pts:300 },
  ],

  // Niveles
  NIVELES: [
    { nivel:1, nombre:'Novato',     icon:'🥉', minPts:0,   maxPts:99   },
    { nivel:2, nombre:'Intermedio', icon:'🥈', minPts:100, maxPts:299  },
    { nivel:3, nombre:'Avanzado',   icon:'🥇', minPts:300, maxPts:599  },
    { nivel:4, nombre:'Experto',    icon:'💎', minPts:600, maxPts:999  },
    { nivel:5, nombre:'Leyenda',    icon:'👑', minPts:1000, maxPts:Infinity },
  ],

  // Plantillas WhatsApp por mora
  PLANTILLAS_WA: [
    {
      nivel: 0, label: 'Recordatorio Amable',
      template: 'Hola {nombre}, le recordamos cordialmente su cuota de L {monto}. Gracias por su pago puntual. 🙏'
    },
    {
      nivel: 1, label: 'Primer Aviso',
      template: 'Hola {nombre}, notamos que su cuota de L {monto} está pendiente. Por favor contáctenos para coordinar su pago. 📞'
    },
    {
      nivel: 2, label: 'Aviso Urgente',
      template: 'Estimado/a {nombre}, su cuenta presenta {dias} días en mora por L {monto}. Es necesario regularizar HOY. ⚠️'
    },
    {
      nivel: 3, label: 'Último Aviso',
      template: '🚨 {nombre}: Mora de {dias} días — Balance: L {monto}. Debe contactarnos HOY para evitar acciones de cobro.'
    },
  ],
};
