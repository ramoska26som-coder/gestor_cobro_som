// ============================================================
// APP v4 - Cobros Pro  |  Todas las funciones
// ============================================================
let D = { prestamos:[], pagos:[], gestiones:[] };
let USER = null, estadoSel = '', clienteAct = null;
let siguienteLista = [], siguienteIdx = 0;
let timerInterval = null, timerInicio = null;
let dashData = null;

const hoy    = new Date();
const hoyStr = hoy.toISOString().split('T')[0];

// ── Utilidades ───────────────────────────────────────────────
const fL  = n => 'L ' + Number(n||0).toLocaleString('es-HN',{minimumFractionDigits:2,maximumFractionDigits:2});
const diaSem = () => ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'][hoy.getDay()];
const diaMes  = () => hoy.getDate();

function getCiclo() {
  const y=hoy.getFullYear(), m=hoy.getMonth(), d=hoy.getDate(), dc=CONFIG.DIA_CIERRE;
  const ini = d<=dc ? new Date(y,m-1,dc+1) : new Date(y,m,dc+1);
  const fin = d<=dc ? new Date(y,m,dc)     : new Date(y,m+1,dc);
  return { ini, fin, dias:Math.max(0,Math.ceil((fin-hoy)/864e5)), totalDias:Math.ceil((fin-ini)/864e5) };
}
const getEst  = v => CONFIG.ESTADOS.find(e=>e.value===v) || CONFIG.ESTADOS[6];
const blClass = v => ({pagado:'bl-green',promesa:'bl-yellow',rechaza_pago:'bl-red',
                        mensaje_enviado:'bl-blue',ilocalizable:'bl-purple'}[v]||'bl-gray');
const ultGest = c => D.gestiones.filter(g=>g.cliente===c).sort((a,b)=>(b.fecha+b.hora).localeCompare(a.fecha+a.hora))[0];

function agrupar(ps) {
  const m = {};
  ps.forEach(p => {
    if (!m[p.cliente]) m[p.cliente]={cliente:p.cliente,cartera:p.cartera,diaPago:p.diaPago,prestamos:[],totalBal:0,totalCuo:0};
    m[p.cliente].prestamos.push(p); m[p.cliente].totalBal+=p.balance; m[p.cliente].totalCuo+=p.balanceCuotas;
  });
  return Object.values(m);
}

function toast(msg, type='') {
  const t=document.getElementById('toast');
  t.textContent=msg; t.className='toast '+(type==='success'?'ok':type==='error'?'err':'');
  t.style.display='block'; setTimeout(()=>t.style.display='none', 3500);
}

function diasDesdeUltimoPago(cliente) {
  const pagos = D.pagos.filter(p=>p.cliente===cliente).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  if (!pagos.length) return null;
  const diff = Math.floor((hoy - new Date(pagos[0].fecha)) / 864e5);
  return diff;
}

function calcRiesgo(cliente) {
  const dias = diasDesdeUltimoPago(cliente) ?? 999;
  const promesasInc = D.gestiones.filter(g =>
    g.cliente===cliente && g.estado==='promesa' && g.fechaPromesa < hoyStr &&
    !D.gestiones.some(g2=>g2.cliente===cliente && g2.estado==='pagado' && g2.fecha>=g.fechaPromesa)
  ).length;
  let score = 0;
  if      (dias > 90) score += 50;
  else if (dias > 60) score += 35;
  else if (dias > 30) score += 20;
  else if (dias > 15) score += 10;
  score += Math.min(promesasInc * 15, 45);
  score  = Math.min(score, 100);
  const nivel = score >= 70 ? {label:'Alto',   color:'#ef4444', icon:'🔴'}
              : score >= 40 ? {label:'Medio',  color:'#f59e0b', icon:'🟡'}
              :               {label:'Bajo',   color:'#22c55e', icon:'🟢'};
  return {score, nivel, dias, promesasInc};
}

function prioridadCliente(c) {
  const r = calcRiesgo(c.cliente);
  const u = ultGest(c.cliente);
  let pts = 0;
  if (!u) pts += 40;                            // nunca gestionado
  if (r.score > 60) pts += 30;                 // riesgo alto
  if (u && u.estado==='promesa') pts += 20;    // promesa pendiente
  pts += Math.min(c.totalCuo / 100, 20);       // mayor cuota = más urgente
  return pts;
}

// ── GAMIFICACIÓN ─────────────────────────────────────────────
const GAME = {
  calcLogros(gestiones, usuario) {
    const gH = gestiones.filter(g => g.fecha===hoyStr && g.gestor===usuario.nombre);
    const pagosH = gH.filter(g=>g.estado==='pagado');
    const cliHoy = [...new Set(D.prestamos.filter(p=>{
      const dp=p.diaPago.toLowerCase();
      return dp.includes(diaSem()) || dp==='día '+diaMes();
    }).map(p=>p.cliente))];
    const cliGest = [...new Set(gH.map(g=>g.cliente))];

    const desbloqueados = [];
    if (gH.length >= 1)          desbloqueados.push('primera_gestion');
    if (pagosH.length >= 1)      desbloqueados.push('cobro_exitoso');
    if (gH.length >= 5)          desbloqueados.push('cinco_gestiones');
    if (gH.length >= 10)         desbloqueados.push('diez_gestiones');
    if (pagosH.length >= 3)      desbloqueados.push('tres_cobros');
    if (cliHoy.length > 0 && cliHoy.every(c=>cliGest.includes(c))) desbloqueados.push('todos_contactados');
    if (cliHoy.length > 0 && !cliHoy.some(c=>!cliGest.includes(c))) desbloqueados.push('sin_pendientes');
    // Meta diaria
    const meta = CONFIG.META_CICLO / (getCiclo().totalDias||1);
    const cobHoy = pagosH.reduce((s,g)=>s+(g.montoPagado||0),0);
    if (meta > 0 && cobHoy >= meta) desbloqueados.push('meta_diaria');
    // Racha
    const racha = this.calcRacha(gestiones, usuario);
    if (racha >= 3) desbloqueados.push('racha_3');
    if (racha >= 5) desbloqueados.push('racha_5');

    const pts = desbloqueados.reduce((s,id) => {
      const l = CONFIG.LOGROS.find(x=>x.id===id);
      return s + (l ? l.pts : 0);
    }, 0);
    return { desbloqueados, puntos:pts };
  },

  calcRacha(gestiones, usuario) {
    let racha = 0;
    for (let i = 0; i < 30; i++) {
      const dt  = new Date(hoy); dt.setDate(dt.getDate()-i);
      const dts = dt.toISOString().split('T')[0];
      const tienePago = gestiones.some(g=>g.fecha===dts && g.gestor===usuario.nombre && g.estado==='pagado');
      if (tienePago) racha++;
      else if (i > 0) break;
    }
    return racha;
  },

  getNivel(pts) {
    return CONFIG.NIVELES.slice().reverse().find(n=>pts>=n.minPts) || CONFIG.NIVELES[0];
  }
};

// ── CELEBRACIÓN ──────────────────────────────────────────────
function celebrar(monto) {
  const overlay = document.getElementById('celebracion');
  document.getElementById('cel-monto').textContent = fL(monto);
  overlay.style.display = 'flex';
  // Confetti particles
  const cont = document.getElementById('confetti');
  cont.innerHTML = '';
  const colors = ['#22c55e','#f59e0b','#3b82f6','#a855f7','#ef4444','#fff'];
  for (let i=0; i<60; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-p';
    p.style.cssText = `left:${Math.random()*100}%;background:${colors[i%colors.length]};
      animation-delay:${Math.random()*0.5}s;animation-duration:${0.8+Math.random()*0.7}s;
      width:${6+Math.random()*6}px;height:${6+Math.random()*6}px;border-radius:${Math.random()>0.5?'50%':'2px'}`;
    cont.appendChild(p);
  }
  setTimeout(() => { overlay.style.display='none'; cont.innerHTML=''; }, 3000);
}

// ── RESUMEN INICIAL ───────────────────────────────────────────
function mostrarResumenInicial() {
  if (!dashData) return;
  const d = dashData;
  const meta = d.meta || 0;
  const rec  = d.recuperacion.totalRecuperado;
  const pct  = meta > 0 ? (rec/meta*100).toFixed(1) : d.recuperacion.porcentaje;
  const gH   = d.gestionHoy;
  document.getElementById('ri-meta').textContent    = fL(meta);
  document.getElementById('ri-rec').textContent     = fL(rec) + ' (' + pct + '%)';
  document.getElementById('ri-dias').textContent    = d.ciclo.diasRestantes + ' días';
  document.getElementById('ri-gest').textContent    = gH.total + ' gestiones · ' + gH.contactados + ' contactados';
  document.getElementById('ri-prom').textContent    = d.promesasVencidas + ' promesas vencidas';
  document.getElementById('resumen-inicial').style.display = 'flex';
}

// ══════════════════════════════════════
// LOGIN / SESIÓN
// ══════════════════════════════════════
async function initLogin() {
  // Cargar usuarios desde Sheets o demo
  try {
    const res = await API.getUsuarios();
    if (res.success && res.data.length) {
      CONFIG.USUARIOS = res.data;
    } else {
      CONFIG.USUARIOS = [{id:'admin',nombre:'Administrador',pass:'1234',rol:'gerente',avatar:'A',cartera:''}];
    }
  } catch(e) {
    CONFIG.USUARIOS = [{id:'admin',nombre:'Administrador',pass:'1234',rol:'gerente',avatar:'A',cartera:''}];
  }

  const sel = document.getElementById('login-usuario');
  sel.innerHTML = '<option value="">Seleccionar usuario...</option>';
  CONFIG.USUARIOS.forEach(u => {
    sel.innerHTML += `<option value="${u.id}">${u.nombre} (${CONFIG.ROLES[u.rol]?.label||u.rol})</option>`;
  });

  // Recuperar sesión
  const saved = sessionStorage.getItem('cobros_user');
  if (saved) { USER = JSON.parse(saved); mostrarApp(); }
}

function iniciarSesion() {
  const uid  = document.getElementById('login-usuario').value;
  const pass = document.getElementById('login-pass').value;
  const err  = document.getElementById('login-error');
  if (!uid)  { err.textContent='Seleccioná un usuario'; return; }
  const u = CONFIG.USUARIOS.find(x=>x.id===uid);
  if (!u)    { err.textContent='Usuario no encontrado';  return; }
  if (u.pass !== pass) { err.textContent='Contraseña incorrecta'; return; }
  USER = u; err.textContent='';
  sessionStorage.setItem('cobros_user', JSON.stringify(u));
  mostrarApp();
}

function cerrarSesion() {
  USER=null; sessionStorage.removeItem('cobros_user');
  document.getElementById('app-container').style.display='none';
  document.getElementById('login-screen').style.display='flex';
  document.getElementById('login-pass').value='';
}

function mostrarApp() {
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app-container').style.display='flex';
  document.getElementById('user-avatar').textContent    = USER.avatar||USER.nombre[0];
  document.getElementById('user-name').textContent      = USER.nombre;
  document.getElementById('user-role-label').textContent= CONFIG.ROLES[USER.rol]?.label||USER.rol;
  document.getElementById('sidebar-user-role').textContent= CONFIG.ROLES[USER.rol]?.label||USER.rol;
  buildMenu();
  populateFilters();
  cargarTodosDatos();
}

function buildMenu() {
  const perms = CONFIG.ROLES[USER.rol];
  const menu  = document.getElementById('sidebar-menu');
  menu.innerHTML = '';
  CONFIG.TABS.filter(t => perms.tabs.includes(t.id)).forEach(t => {
    menu.innerHTML += `<button class="menu-item${t.id==='dashboard'?' active':''}" data-tab="${t.id}" onclick="switchTab('${t.id}')"><span class="menu-icon">${t.icon}</span><span class="menu-label">${t.label}</span></button>`;
  });
  menu.innerHTML += '<button class="menu-item" onclick="cargarTodosDatos()" style="margin-top:8px;opacity:.7"><span class="menu-icon">🔄</span><span class="menu-label">Actualizar</span></button>';
}

function populateFilters() {
  const dm = document.getElementById('f-dm');
  if (dm && dm.options.length <= 1)
    for (let i=1;i<=31;i++) dm.innerHTML+=`<option value="${i}">Día ${i}</option>`;
  ['f-est','fh-est'].forEach(id => {
    const s=document.getElementById(id); if(!s||s.options.length>1) return;
    CONFIG.ESTADOS.forEach(e => { s.innerHTML+=`<option value="${e.value}">${e.icon} ${e.label}</option>`; });
  });
}

// ══════════════════════════════════════
// SIDEBAR
// ══════════════════════════════════════
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('show');
}
function switchTab(id) {
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.menu-item').forEach(m=>m.classList.remove('active'));
  const tab=document.getElementById('tab-'+id);
  if(tab) tab.classList.add('active');
  const mi=document.querySelector(`.menu-item[data-tab="${id}"]`);
  if(mi) mi.classList.add('active');
  if(window.innerWidth<=768){document.getElementById('sidebar').classList.remove('open');document.getElementById('sidebar-overlay').classList.remove('show');}
  switch(id) {
    case 'dashboard': renderDash();      break;
    case 'cartera':   filtrarCartera();  break;
    case 'hoy':       renderHoy();       break;
    case 'historial': renderHist();      break;
    case 'pagos':     filtrarPagos();    break;
    case 'ranking':   renderRanking();   break;
    case 'logros':    renderLogros();    break;
    case 'usuarios':  renderUsers();     break;
  }
}

// ══════════════════════════════════════
// CARGA DE DATOS
// ══════════════════════════════════════
async function cargarTodosDatos() {
  document.getElementById('loading').style.display='flex';
  try {
    const [pr, pa, ge, meta] = await Promise.all([
      API.getPrestamos(), API.getPagos(), API.getGestiones(), API.getMeta()
    ]);
    D.prestamos  = pr.data||[];
    D.pagos      = pa.data||[];
    D.gestiones  = ge.data||[];
    CONFIG.META_CICLO = meta.meta||0;
    // Cargar dashboard para resumen inicial
    try { const db=await API.getDashboard(); if(db.success) dashData=db.data; } catch(e){}
    toast('Datos sincronizados','success');
    mostrarResumenInicial();
  } catch(e) {
    if (e.message==='URL_NO_CONFIGURADA') {
      cargarEjemplo(); toast('Modo demo — Configurá la URL en config.js','error');
    } else {
      cargarEjemplo(); toast('Sin conexión — Datos de ejemplo','error');
    }
  }
  document.getElementById('loading').style.display='none';
  const at=document.querySelector('.menu-item.active');
  switchTab(at?at.dataset.tab:'dashboard');
}

function cargarEjemplo() {
  CONFIG.META_CICLO = 80000;
  D.prestamos = [
    {id:5, cliente:'Carmen Dalila Vasquez Ferrera',     tipo:'PREST. MENSUAL',    capital:15264, balance:13662.69, balanceCuotas:728.70,  diaPago:'Día 17',       cartera:'Zona 3'},
    {id:9, cliente:'Gladys Carolina Castillo Ramirez',  tipo:'PREST. QUINCENAL',  capital:6000,  balance:6000,    balanceCuotas:600,     diaPago:'Día 15',       cartera:'Zona 3'},
    {id:13,cliente:'Angelica Patricia Pineda Carbajal', tipo:'PREST. QUINCENAL',  capital:12000, balance:12000,   balanceCuotas:2840,    diaPago:'Día 15',       cartera:'Zona 3'},
    {id:15,cliente:'Daisy Rivera Valladares',           tipo:'PREST. SEMANAL',    capital:13400, balance:8500,    balanceCuotas:1200,    diaPago:'Día lunes',    cartera:'Zona 3'},
    {id:19,cliente:'Keylin Roxana Mejia Garcia',        tipo:'PREST. QUINCENAL',  capital:12598, balance:12598,   balanceCuotas:5292.43, diaPago:'Día 15',       cartera:'Zona 1'},
    {id:24,cliente:'Mauricio Zamora Perdomo',           tipo:'PREST. SEMANAL',    capital:7958,  balance:4200,    balanceCuotas:850,     diaPago:`Día ${diaSem()}`, cartera:'Zona 1'},
    {id:25,cliente:'Mirian Maritza Flores Aguilar',     tipo:'PREST. SEMANAL',    capital:3500,  balance:1800,    balanceCuotas:400,     diaPago:`Día ${diaSem()}`, cartera:'Zona 2'},
    {id:26,cliente:'Olvin Enrique Castro Ortega',       tipo:'PREST. SEMANAL',    capital:5822,  balance:4443.16, balanceCuotas:476.10,  diaPago:`Día ${diaSem()}`, cartera:'Zona 2'},
    {id:28,cliente:'Suyapa Yadira Cardona Marquez',     tipo:'PREST. QUINCENAL',  capital:10000, balance:7500,    balanceCuotas:1500,    diaPago:'Día 15',       cartera:'Zona 2'},
    {id:29,cliente:'Mario Emmanuel Lopez Ortez',        tipo:'PREST. SEMANAL',    capital:4500,  balance:3200,    balanceCuotas:520,     diaPago:`Día ${diaSem()}`, cartera:'Zona 1'},
    {id:30,cliente:'Delmy Cristina Gutierrez Caceres',  tipo:'PREST. SEMANAL',    capital:8000,  balance:5600,    balanceCuotas:1100,    diaPago:`Día ${diaSem()}`, cartera:'Zona 2'},
  ];
  D.pagos = [
    {cliente:'Carmen Dalila Vasquez Ferrera',    tipo:'PREST. MENSUAL',   valor:728.70,  fecha:'2026-02-10', capital:600,   intereses:128.70, caja:'Bac',     medioPago:'transferencia'},
    {cliente:'Gladys Carolina Castillo Ramirez', tipo:'PREST. QUINCENAL', valor:600,     fecha:'2026-02-11', capital:500,   intereses:100,    caja:'Bac',     medioPago:'efectivo'},
    {cliente:'Angelica Patricia Pineda Carbajal',tipo:'PREST. QUINCENAL', valor:2840,    fecha:'2026-02-12', capital:2200,  intereses:640,    caja:'Ficohsa', medioPago:'transferencia'},
    {cliente:'Keylin Roxana Mejia Garcia',       tipo:'PREST. QUINCENAL', valor:5292.43, fecha:'2026-02-12', capital:4000,  intereses:1292.43,caja:'Banpais', medioPago:'efectivo'},
    {cliente:'Daisy Rivera Valladares',          tipo:'PREST. SEMANAL',   valor:1200,    fecha:'2026-02-24', capital:900,   intereses:300,    caja:'Bac',     medioPago:'efectivo'},
    {cliente:'Olvin Enrique Castro Ortega',      tipo:'PREST. SEMANAL',   valor:476.10,  fecha:'2026-02-24', capital:380,   intereses:96.10,  caja:'Ficohsa', medioPago:'transferencia'},
    {cliente:'Mauricio Zamora Perdomo',          tipo:'PREST. SEMANAL',   valor:850,     fecha:hoyStr,       capital:700,   intereses:150,    caja:'Bac',     medioPago:'efectivo'},
    {cliente:'Mirian Maritza Flores Aguilar',    tipo:'PREST. SEMANAL',   valor:400,     fecha:hoyStr,       capital:330,   intereses:70,     caja:'Ficohsa', medioPago:'efectivo'},
  ];
  D.gestiones = [
    {cliente:'Carmen Dalila Vasquez Ferrera',    estado:'promesa',         comentario:'Paga el viernes',       fechaPromesa:'2026-02-28', montoPagado:0,    montoPromesa:728.70, fecha:'2026-02-25', hora:'10:30', gestor:'Gestor 1'},
    {cliente:'Gladys Carolina Castillo Ramirez', estado:'mensaje_enviado', comentario:'WhatsApp enviado',      fechaPromesa:'',           montoPagado:0,    montoPromesa:0,      fecha:hoyStr,       hora:'08:15', gestor:USER?USER.nombre:'Gestor 1'},
    {cliente:'Angelica Patricia Pineda Carbajal',estado:'pagado',          comentario:'Pagó en Ficohsa',       fechaPromesa:'',           montoPagado:2840, montoPromesa:0,      fecha:hoyStr,       hora:'09:45', gestor:USER?USER.nombre:'Gestor 1'},
    {cliente:'Mauricio Zamora Perdomo',          estado:'pagado',          comentario:'Pagó cuota completa',   fechaPromesa:'',           montoPagado:850,  montoPromesa:0,      fecha:hoyStr,       hora:'11:20', gestor:USER?USER.nombre:'Gestor 1'},
  ];
  dashData = {
    ciclo:{inicio:'2026-02-09',fin:'2026-03-08',diasRestantes:5},
    cartera:{totalBalance:D.prestamos.reduce((s,p)=>s+p.balance,0), totalCuotas:D.prestamos.reduce((s,p)=>s+p.balanceCuotas,0), clientesActivos:D.prestamos.length},
    recuperacion:{totalRecuperado:D.pagos.reduce((s,p)=>s+p.valor,0), cantidadPagos:D.pagos.length, porcentaje:'15.8'},
    gestionHoy:{total:4, contactados:3, porEstado:{pagado:2,mensaje_enviado:1}},
    promesasVencidas:1, promesasDetalle:[],
    meta:CONFIG.META_CICLO
  };
}

// ══════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════
function renderDash() {
  const act    = D.prestamos.filter(p=>(p.balance+p.balanceCuotas)>=CONFIG.MIN_BALANCE);
  const c      = getCiclo();
  const totCar = act.reduce((s,p)=>s+p.balance,0);
  const totCuo = act.reduce((s,p)=>s+p.balanceCuotas,0);
  const totRec = D.pagos.reduce((s,p)=>s+p.valor,0);
  const meta   = CONFIG.META_CICLO || totCuo;
  const cliU   = [...new Set(act.map(p=>p.cliente))];
  const gH     = D.gestiones.filter(g=>g.fecha===hoyStr);
  const cont   = [...new Set(gH.map(g=>g.cliente))];
  const pagH   = gH.filter(g=>g.estado==='pagado');
  const pagosHoy = D.pagos.filter(p=>p.fecha===hoyStr);
  const cobHoy = pagosHoy.reduce((s,p)=>s+p.valor,0) + pagH.reduce((s,g)=>s+(g.montoPagado||0),0);
  const pct    = meta > 0 ? (totRec/meta*100) : 0;
  const diasT  = c.totalDias||1, diasP = Math.max(1, diasT-c.dias);
  const promD  = totRec / diasP;
  const proy   = Math.min(totRec + promD*c.dias, meta*1.5);
  const pctP   = meta > 0 ? (proy/meta*100) : 0;
  const falta  = Math.max(0, meta - totRec);
  const faltaD = c.dias > 0 ? falta/c.dias : falta;

  // Render stats
  document.getElementById('ciclo-info').textContent = `Ciclo: ${c.ini.toLocaleDateString('es-HN')} – ${c.fin.toLocaleDateString('es-HN')}`;
  const dc=document.getElementById('dias-cierre');
  dc.textContent = c.dias+' días para cierre';
  dc.className   = 'badge-cierre '+(c.dias<=3?'danger':c.dias<=7?'warning':'ok');

  document.getElementById('s-cobrado-hoy').textContent = fL(cobHoy);
  document.getElementById('s-cobros-count').textContent= (pagosHoy.length+pagH.length)+' cobros hoy';
  document.getElementById('s-pct').textContent         = pct.toFixed(1)+'%';
  document.getElementById('s-pct-det').textContent     = fL(totRec)+' de '+fL(meta);
  document.getElementById('s-proyeccion').textContent  = fL(proy);
  document.getElementById('s-proy-pct').textContent    = pctP.toFixed(1)+'% de meta';
  document.getElementById('s-falta-meta').textContent  = fL(falta);
  document.getElementById('s-falta-det').textContent   = c.dias>0?fL(faltaD)+'/día':'Ciclo cerrado';
  document.getElementById('s-cartera').textContent     = fL(totCar);
  document.getElementById('s-clientes').textContent    = cliU.length+' clientes';
  document.getElementById('s-cuotas').textContent      = fL(totCuo);
  document.getElementById('s-recup').textContent       = fL(totRec);
  document.getElementById('s-recup-count').textContent = D.pagos.length+' pagos';
  document.getElementById('s-gest').textContent        = gH.length;
  document.getElementById('s-contact').textContent     = cont.length+'/'+cliU.length+' contactados';

  // Meta configurable (botón editar)
  document.getElementById('meta-valor').textContent = fL(meta);

  // Progress bars
  const pb=document.getElementById('progress-bars'); pb.innerHTML='';
  [{l:'% Cobro vs Meta',v:totRec,mx:meta,cl:'#22c55e'},{l:'Proyección vs Meta',v:proy,mx:meta,cl:'#a855f7'},
   {l:'Contactados Hoy',v:cont.length,mx:cliU.length,cl:'#3b82f6'},{l:'Efectividad',v:pagH.length,mx:Math.max(gH.length,1),cl:'#f59e0b'}
  ].forEach(b => {
    const p=b.mx>0?Math.min(b.v/b.mx*100,100):0;
    pb.innerHTML+=`<div class="prog"><div class="prog-head"><span class="prog-lbl">${b.l}</span><span class="prog-pct">${p.toFixed(1)}%</span></div><div class="prog-track"><div class="prog-fill" style="width:${p}%;background:${b.cl}"></div></div></div>`;
  });

  // Estados hoy
  const eh=document.getElementById('estados-hoy'); eh.innerHTML='';
  CONFIG.ESTADOS.forEach(e => {
    const n=gH.filter(g=>g.estado===e.value).length;
    const mnt=gH.filter(g=>g.estado===e.value&&g.montoPagado>0).reduce((s,g)=>s+(g.montoPagado||0),0);
    eh.innerHTML+=`<div class="erow"><div class="erow-l"><span>${e.icon}</span><span>${e.label}</span></div><div style="display:flex;align-items:center;gap:8px">${mnt>0?`<span style="font-size:11px;color:var(--green);font-weight:600">${fL(mnt)}</span>`:''}<span class="ebadge" style="background:${e.bg};color:${e.color}">${n}</span></div></div>`;
  });

  // Gráfico cobro diario (SVG)
  renderGraficoCobro();

  // Desglose capital vs intereses
  const totCap = D.pagos.reduce((s,p)=>s+(p.capital||0),0);
  const totInt = D.pagos.reduce((s,p)=>s+(p.intereses||0),0);
  document.getElementById('desglose-capital').textContent   = fL(totCap);
  document.getElementById('desglose-intereses').textContent = fL(totInt);

  // Métodos de pago
  const mpMap={};
  D.pagos.forEach(p=>{const mp=p.medioPago||'efectivo';mpMap[mp]=(mpMap[mp]||0)+p.valor;});
  const mpEl=document.getElementById('metodos-pago'); mpEl.innerHTML='';
  const mpTotal=Object.values(mpMap).reduce((s,v)=>s+v,0)||1;
  const mpColors={'efectivo':'#22c55e','transferencia':'#3b82f6','cheque':'#f59e0b'};
  Object.entries(mpMap).forEach(([mp,v])=>{
    const pct2=(v/mpTotal*100).toFixed(1);
    mpEl.innerHTML+=`<div class="mp-row"><span class="mp-label">${mp.charAt(0).toUpperCase()+mp.slice(1)}</span><div class="prog-track" style="flex:1"><div class="prog-fill" style="width:${pct2}%;background:${mpColors[mp]||'#6b7280'}"></div></div><span class="mp-pct">${pct2}%</span><span class="mp-val">${fL(v)}</span></div>`;
  });

  // Mora por antigüedad
  renderMoraAntigüedad();

  // Promesas vencidas
  const pv=D.gestiones.filter(g=>g.estado==='promesa'&&g.fechaPromesa&&g.fechaPromesa<=hoyStr&&
    !D.gestiones.some(g2=>g2.cliente===g.cliente&&g2.estado==='pagado'&&g2.fecha>=g.fechaPromesa));
  const pvBox=document.getElementById('promesas-box');
  if(pv.length>0){
    pvBox.style.display='block';
    document.getElementById('prom-count').textContent=pv.length;
    document.getElementById('prom-list').innerHTML=pv.slice(0,8).map(g=>
      `<div class="pi"><span class="pi-n">${g.cliente}</span><span class="pi-f">${g.fechaPromesa}${g.montoPromesa?' — '+fL(g.montoPromesa):''}</span><button class="btn-wa-sm" onclick="abrirModalPorNombre('${g.cliente}')">Gestionar</button></div>`
    ).join('');
  } else pvBox.style.display='none';

  // Mini ranking hoy
  renderMiniRanking(gH);
}

function renderGraficoCobro() {
  // Últimos 14 días desde D.pagos
  const dias=[];
  for(let i=13;i>=0;i--){
    const dt=new Date(hoy); dt.setDate(dt.getDate()-i);
    const ds=dt.toISOString().split('T')[0];
    const monto=D.pagos.filter(p=>p.fecha===ds).reduce((s,p)=>s+p.valor,0);
    dias.push({ds:ds.slice(5),monto});
  }
  const maxMonto=Math.max(...dias.map(d=>d.monto),1);
  const W=300,H=80,pad=4;
  const bw=Math.floor((W-pad*(dias.length+1))/dias.length);
  let bars='';
  dias.forEach((d,i)=>{
    const h2=Math.max(4,Math.floor((d.monto/maxMonto)*(H-16)));
    const x=pad+(bw+pad)*i;
    const y=H-h2-4;
    const color=d.ds===hoyStr.slice(5)?'#22c55e':'#3b82f6';
    bars+=`<rect x="${x}" y="${y}" width="${bw}" height="${h2}" rx="2" fill="${color}" opacity="0.85"/>`;
    if(i%3===0)bars+=`<text x="${x+bw/2}" y="${H}" text-anchor="middle" fill="#64748b" font-size="7">${d.ds}</text>`;
    if(d.monto>0)bars+=`<text x="${x+bw/2}" y="${y-2}" text-anchor="middle" fill="${color}" font-size="6">${(d.monto/1000).toFixed(0)}k</text>`;
  });
  document.getElementById('grafico-cobro').innerHTML=`<svg viewBox="0 0 ${W} ${H+4}" style="width:100%;height:90px">${bars}</svg>`;
}

function renderMoraAntigüedad() {
  const buckets=[
    {label:'Al día (< 30 días)',    color:'#22c55e',count:0},
    {label:'1 mes (30-60 días)',    color:'#f59e0b',count:0},
    {label:'2 meses (60-90 días)',  color:'#f97316',count:0},
    {label:'3 meses (90-180 días)', color:'#ef4444',count:0},
    {label:'Más de 180 días',       color:'#a855f7',count:0},
  ];
  D.prestamos.forEach(p=>{
    const dias=p.fecha?Math.floor((hoy-new Date(p.fecha))/864e5):0;
    if(dias<30)       buckets[0].count++;
    else if(dias<60)  buckets[1].count++;
    else if(dias<90)  buckets[2].count++;
    else if(dias<180) buckets[3].count++;
    else              buckets[4].count++;
  });
  const total=D.prestamos.length||1;
  const el=document.getElementById('mora-antiguedad'); el.innerHTML='';
  buckets.forEach(b=>{
    const pct=(b.count/total*100).toFixed(1);
    el.innerHTML+=`<div class="prog" style="margin-bottom:6px">
      <div class="prog-head"><span class="prog-lbl" style="color:${b.color}">${b.label}</span><span class="prog-pct">${b.count} clientes (${pct}%)</span></div>
      <div class="prog-track"><div class="prog-fill" style="width:${pct}%;background:${b.color}"></div></div>
    </div>`;
  });
}

function renderMiniRanking(gH) {
  const rank={}; gH.forEach(g=>{
    if(!g.gestor)return;
    if(!rank[g.gestor])rank[g.gestor]={nombre:g.gestor,cobrado:0,gestiones:0};
    rank[g.gestor].gestiones++;
    if(g.estado==='pagado')rank[g.gestor].cobrado+=g.montoPagado||0;
  });
  const top=Object.values(rank).sort((a,b)=>b.cobrado-a.cobrado).slice(0,3);
  const el=document.getElementById('mini-ranking'); if(!el)return;
  const medals=['🥇','🥈','🥉'];
  el.innerHTML=top.length?top.map((r,i)=>`<div class="erow"><div class="erow-l"><span>${medals[i]}</span><span>${r.nombre}</span></div><span style="color:var(--green);font-weight:600">${fL(r.cobrado)}</span></div>`).join('')
    :'<p style="color:var(--text3);font-size:13px;text-align:center">Sin gestiones hoy</p>';
}

// ── META CONFIGURABLE ─────────────────────────────────────────
function editarMeta() {
  const nueva = prompt(`Meta del ciclo actual:\nActual: ${fL(CONFIG.META_CICLO)}\n\nIngresa nueva meta (solo número):`);
  if (!nueva || isNaN(nueva)) return;
  CONFIG.META_CICLO = parseFloat(nueva);
  API.guardarMeta(CONFIG.META_CICLO).catch(()=>{});
  renderDash();
  toast('Meta actualizada: '+fL(CONFIG.META_CICLO),'success');
}

// ══════════════════════════════════════
// CARTERA
// ══════════════════════════════════════
function filtrarCartera() {
  const ft  = document.getElementById('f-texto')?.value.toLowerCase()||'';
  const fds = document.getElementById('f-ds')?.value||'';
  const fdm = document.getElementById('f-dm')?.value||'';
  const fe  = document.getElementById('f-est')?.value||'';
  const fc  = document.getElementById('f-cart')?.value||'';
  const fo  = document.getElementById('f-ord')?.value||'prioridad';

  let cls = agrupar(D.prestamos.filter(p=>(p.balance+p.balanceCuotas)>=CONFIG.MIN_BALANCE));
  if (ft)  cls = cls.filter(c=>c.cliente.toLowerCase().includes(ft));
  if (fds) cls = cls.filter(c=>c.diaPago.toLowerCase().includes(fds));
  if (fdm) cls = cls.filter(c=>{const m=c.diaPago.match(/Día (\d+)/);return m&&parseInt(m[1])===parseInt(fdm);});
  if (fe)  cls = cls.filter(c=>{const u=ultGest(c.cliente);if(fe==='pendiente')return !u;return u&&u.estado===fe;});
  if (fc)  cls = cls.filter(c=>c.cartera===fc);
  // Filtro por cartera del gestor
  if (USER && USER.cartera && USER.rol==='gestor') cls=cls.filter(c=>c.cartera===USER.cartera);

  switch(fo) {
    case 'prioridad':     cls.sort((a,b)=>prioridadCliente(b)-prioridadCliente(a)); break;
    case 'balance_desc':  cls.sort((a,b)=>b.totalBal-a.totalBal); break;
    case 'balance_asc':   cls.sort((a,b)=>a.totalBal-b.totalBal); break;
    case 'cuotas_desc':   cls.sort((a,b)=>b.totalCuo-a.totalCuo); break;
    case 'nombre':        cls.sort((a,b)=>a.cliente.localeCompare(b.cliente)); break;
    case 'riesgo':        cls.sort((a,b)=>calcRiesgo(b.cliente).score-calcRiesgo(a.cliente).score); break;
    case 'mora':          cls.sort((a,b)=>(diasDesdeUltimoPago(b.cliente)||0)-(diasDesdeUltimoPago(a.cliente)||0)); break;
  }

  // Populate carteras filter
  const carteras=[...new Set(D.prestamos.map(p=>p.cartera).filter(Boolean))];
  const fcEl=document.getElementById('f-cart');
  if(fcEl&&fcEl.options.length<=1) carteras.forEach(ca=>fcEl.innerHTML+=`<option value="${ca}">${ca}</option>`);

  siguienteLista=cls; siguienteIdx=0;
  document.getElementById('c-count').textContent=cls.length+' clientes activos';
  document.getElementById('c-list').innerHTML=cls.map((c,idx)=>{
    const u=ultGest(c.cliente),e=u?getEst(u.estado):getEst('pendiente');
    const r=calcRiesgo(c.cliente);
    const dias=diasDesdeUltimoPago(c.cliente);
    return `<div class="li ${blClass(u?.estado||'pendiente')}">
      <div class="li-info">
        <div class="li-name">${c.cliente}</div>
        <div class="li-det">${c.diaPago} · ${c.cartera} · ${c.prestamos.length} prést.</div>
        <div class="li-det" style="color:var(--text3)">
          ${dias!==null?`⏱ Último pago: hace ${dias} días · `:''}
          <span style="color:${r.nivel.color}">${r.nivel.icon} Riesgo ${r.nivel.label}</span>
        </div>
      </div>
      <div class="li-amt">
        <div class="li-bal">${fL(c.totalBal)}</div>
        <div class="li-cuo">Cuota: ${fL(c.totalCuo)}</div>
      </div>
      <span class="li-badge" style="background:${e.bg};color:${e.color}">${e.icon} ${e.label}</span>
      <div class="li-acts">
        <button class="btn-gest" onclick='abrirModal(${JSON.stringify(c)},${idx})'>Gestionar</button>
        <button class="btn-wa" onclick='abrirWA("${c.cliente}")' title="WhatsApp">💬</button>
      </div>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════
// GESTIÓN HOY
// ══════════════════════════════════════
function renderHoy() {
  const ds=diaSem(), dm=diaMes();
  document.getElementById('hoy-info').textContent=hoy.toLocaleDateString('es-HN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const act=D.prestamos.filter(p=>(p.balance+p.balanceCuotas)>=CONFIG.MIN_BALANCE);
  const ch={};
  act.forEach(p=>{
    const dp=p.diaPago.toLowerCase();
    if(dp.includes(ds)||dp==='día '+dm){
      if(!ch[p.cliente])ch[p.cliente]={cliente:p.cliente,cartera:p.cartera,diaPago:p.diaPago,prestamos:[],totalBal:0,totalCuo:0};
      ch[p.cliente].prestamos.push(p);ch[p.cliente].totalBal+=p.balance;ch[p.cliente].totalCuo+=p.balanceCuotas;
    }
  });
  if(USER&&USER.cartera&&USER.rol==='gestor') Object.keys(ch).forEach(k=>{if(ch[k].cartera!==USER.cartera)delete ch[k];});
  const lista=Object.values(ch).sort((a,b)=>prioridadCliente(b)-prioridadCliente(a));
  const gDH=D.gestiones.filter(g=>g.fecha===hoyStr);
  const yaG=new Set(gDH.map(g=>g.cliente));
  const pend=lista.filter(c=>!yaG.has(c.cliente));
  const comp=lista.filter(c=>yaG.has(c.cliente));

  // Actualizar lista de "siguiente cliente"
  siguienteLista=pend; siguienteIdx=0;

  document.getElementById('hoy-empty').style.display=lista.length===0?'block':'none';
  const cobH=gDH.filter(g=>g.estado==='pagado').reduce((s,g)=>s+(g.montoPagado||0),0);
  document.getElementById('hoy-stats').innerHTML=`
    <div class="hoy-stat"><span>💰 Cobrado hoy</span><strong>${fL(cobH)}</strong></div>
    <div class="hoy-stat"><span>✅ Gestionados</span><strong>${comp.length}/${lista.length}</strong></div>
    <div class="hoy-stat"><span>⏳ Pendientes</span><strong>${pend.length}</strong></div>
  `;
  document.getElementById('hoy-pend').innerHTML=pend.length?
    `<div class="sh-row"><h3 class="sh sh-r">⏳ Pendientes (${pend.length})</h3>${pend.length>0?`<button class="btn-sec btn-sm" onclick="siguienteCliente()">Siguiente ▶</button>`:''}</div>`+
    pend.map((c,idx)=>`<div class="li li-pend" style="margin-bottom:6px">
      <div class="li-info"><div class="li-name">${c.cliente}</div><div class="li-det">${c.diaPago} · Cuota: ${fL(c.totalCuo)}</div></div>
      <div class="li-bal">${fL(c.totalBal)}</div>
      <button class="btn-gest" onclick='abrirModal(${JSON.stringify(c)},${idx})'>Gestionar</button>
    </div>`).join(''):'';

  document.getElementById('hoy-done').innerHTML=comp.length?
    `<h3 class="sh sh-g">✅ Gestionados (${comp.length})</h3>`+
    comp.map(c=>{
      const u=gDH.filter(g=>g.cliente===c.cliente).sort((a,b)=>(b.hora||'').localeCompare(a.hora||''))[0];
      const e=u?getEst(u.estado):getEst('pendiente');
      const mTxt=u&&u.montoPagado>0?' — '+fL(u.montoPagado):'';
      return `<div class="li li-done ${blClass(u?.estado)}" style="margin-bottom:6px">
        <div class="li-info"><div class="li-name">${c.cliente}</div><div class="li-det">${u?.comentario||''}${mTxt}</div></div>
        <span class="li-badge" style="background:${e.bg};color:${e.color}">${e.icon} ${e.label}</span>
      </div>`;
    }).join(''):'';
}

function siguienteCliente() {
  if(!siguienteLista.length) return;
  const c=siguienteLista[siguienteIdx % siguienteLista.length];
  siguienteIdx++;
  abrirModal(c, siguienteIdx-1);
}

// ══════════════════════════════════════
// HISTORIAL
// ══════════════════════════════════════
function renderHist(){document.getElementById('fh-date').value=hoyStr;filtrarHistorial();}
function filtrarHistorial() {
  const ff=document.getElementById('fh-date').value, fe=document.getElementById('fh-est').value;
  let g=[...D.gestiones].sort((a,b)=>(b.fecha+b.hora).localeCompare(a.fecha+a.hora));
  if(USER&&USER.rol==='gestor'&&!CONFIG.ROLES[USER.rol].canSeeAllGestiones) g=g.filter(x=>x.gestor===USER.nombre);
  if(ff) g=g.filter(x=>x.fecha===ff);
  if(fe) g=g.filter(x=>x.estado===fe);
  document.getElementById('h-count').textContent=g.length+' gestiones';
  if(!g.length){document.getElementById('h-list').innerHTML='<div class="empty"><span class="empty-icon">📭</span><span>Sin resultados</span></div>';return;}
  document.getElementById('h-list').innerHTML=g.map(x=>{
    const e=getEst(x.estado);
    const mTxt=x.montoPagado>0?' — '+fL(x.montoPagado):'';
    return `<div class="li ${blClass(x.estado)}">
      <div class="li-info">
        <div class="li-name">${x.cliente}</div>
        ${x.comentario?`<div class="li-det">${x.comentario}${mTxt}</div>`:''}
        ${x.fechaPromesa?`<div class="li-det" style="color:var(--yellow)">Promesa: ${x.fechaPromesa}${x.montoPromesa?' — '+fL(x.montoPromesa):''}</div>`:''}
        <div class="li-det" style="color:var(--text3)">👤 ${x.gestor||'—'}</div>
      </div>
      <span class="li-badge" style="background:${e.bg};color:${e.color}">${e.icon} ${e.label}</span>
      <span class="li-date">${x.fecha} ${x.hora||''}</span>
    </div>`;
  }).join('');
}
function limpiarFiltrosHist(){document.getElementById('fh-date').value='';document.getElementById('fh-est').value='';filtrarHistorial();}

// ══════════════════════════════════════
// PAGOS
// ══════════════════════════════════════
function filtrarPagos() {
  const ft=document.getElementById('fp-txt')?.value.toLowerCase()||'';
  const fm=document.getElementById('fp-medio')?.value||'';
  let p=[...D.pagos].sort((a,b)=>b.fecha.localeCompare(a.fecha));
  if(ft) p=p.filter(x=>x.cliente.toLowerCase().includes(ft));
  if(fm) p=p.filter(x=>(x.medioPago||'efectivo')===fm);
  const totV=p.reduce((s,x)=>s+x.valor,0);
  const totC=p.reduce((s,x)=>s+(x.capital||0),0);
  const totI=p.reduce((s,x)=>s+(x.intereses||0),0);
  document.getElementById('p-total').innerHTML=`<b>${fL(totV)}</b> · Cap: ${fL(totC)} · Int: ${fL(totI)}`;
  document.getElementById('p-list').innerHTML=p.map(x=>`
    <div class="li bl-green">
      <div class="li-info">
        <div class="li-name">${x.cliente}</div>
        <div class="li-det">${x.tipo} · ${x.caja||''} · <span style="color:var(--blue)">${(x.medioPago||'efectivo').charAt(0).toUpperCase()+(x.medioPago||'efectivo').slice(1)}</span></div>
        ${x.capital||x.intereses?`<div class="li-det" style="color:var(--text3)">Capital: ${fL(x.capital||0)} · Intereses: ${fL(x.intereses||0)}</div>`:''}
      </div>
      <div class="li-val">${fL(x.valor)}</div>
      <span class="li-date">${x.fecha}</span>
    </div>`).join('');
}

// ══════════════════════════════════════
// RANKING
// ══════════════════════════════════════
function renderRanking() {
  const c=getCiclo();
  const fi=c.ini.toISOString().split('T')[0];
  const fn=c.fin.toISOString().split('T')[0];
  const rank={};
  D.gestiones.filter(g=>g.fecha>=fi&&g.fecha<=fn).forEach(x=>{
    if(!x.gestor)return;
    if(!rank[x.gestor])rank[x.gestor]={nombre:x.gestor,gestiones:0,pagos:0,cobrado:0,promesas:0};
    rank[x.gestor].gestiones++;
    if(x.estado==='pagado'){rank[x.gestor].pagos++;rank[x.gestor].cobrado+=x.montoPagado||0;}
    if(x.estado==='promesa')rank[x.gestor].promesas++;
  });
  const r=Object.values(rank).sort((a,b)=>b.cobrado-a.cobrado);
  r.forEach((x,i)=>{x.posicion=i+1;x.efectividad=x.gestiones>0?((x.pagos/x.gestiones)*100).toFixed(1):'0.0';});

  const medals=['🥇','🥈','🥉'];
  const el=document.getElementById('ranking-list'); if(!el)return;
  el.innerHTML=r.length?r.map((x,i)=>`
    <div class="li ${i===0?'bl-green':i===1?'bl-blue':i===2?'bl-yellow':'bl-gray'}" style="position:relative">
      <div class="rank-pos">${medals[i]||('#'+(i+1))}</div>
      <div class="li-info">
        <div class="li-name">${x.nombre}</div>
        <div class="li-det">${x.gestiones} gestiones · ${x.pagos} cobros · ${x.efectividad}% efectividad</div>
        ${x.promesas?`<div class="li-det" style="color:var(--yellow)">🤝 ${x.promesas} promesas</div>`:''}
      </div>
      <div class="li-amt" style="text-align:right">
        <div class="li-bal">${fL(x.cobrado)}</div>
        <div class="li-cuo">cobrado</div>
      </div>
    </div>`).join('')
    :'<div class="empty"><span class="empty-icon">📊</span><span>Sin gestiones en este ciclo</span></div>';

  // Análisis horario óptimo
  const hMap={};
  D.gestiones.filter(g=>g.fecha===hoyStr&&g.estado==='pagado').forEach(g=>{
    const hr=(g.hora||'00:00').split(':')[0]+'h'; hMap[hr]=(hMap[hr]||0)+1;
  });
  const mejorH=Object.entries(hMap).sort((a,b)=>b[1]-a[1])[0];
  const horEl=document.getElementById('mejor-hora'); if(horEl)
    horEl.textContent=mejorH?`⏰ Mejor hora de cobro hoy: ${mejorH[0]} (${mejorH[1]} cobros)`:'⏰ Sin datos de horario hoy';
}

// ══════════════════════════════════════
// LOGROS / GAMIFICACIÓN
// ══════════════════════════════════════
function renderLogros() {
  if(!USER)return;
  const {desbloqueados,puntos} = GAME.calcLogros(D.gestiones, USER);
  const nivel = GAME.getNivel(puntos);
  const racha  = GAME.calcRacha(D.gestiones, USER);

  // Nivel y puntos
  document.getElementById('g-nivel-icon').textContent  = nivel.icon;
  document.getElementById('g-nivel-name').textContent  = nivel.nombre;
  document.getElementById('g-puntos').textContent      = puntos+' pts';
  document.getElementById('g-racha').textContent       = racha+' 🔥';

  // Barra de nivel
  const nextNivel=CONFIG.NIVELES.find(n=>n.nivel===nivel.nivel+1);
  const pctNivel=nextNivel?Math.min((puntos-nivel.minPts)/(nextNivel.minPts-nivel.minPts)*100,100):100;
  document.getElementById('g-nivel-bar').style.width  = pctNivel+'%';
  document.getElementById('g-nivel-prox').textContent = nextNivel?`${nextNivel.icon} ${nextNivel.nombre} en ${nextNivel.minPts-puntos} pts`:'¡Nivel máximo! 👑';

  // Logros grid
  const el=document.getElementById('logros-grid'); el.innerHTML='';
  CONFIG.LOGROS.forEach(l=>{
    const ok=desbloqueados.includes(l.id);
    el.innerHTML+=`<div class="logro-card ${ok?'ok':'lock'}">
      <div class="logro-icon">${ok?l.icon:'🔒'}</div>
      <div class="logro-nombre">${l.nombre}</div>
      <div class="logro-desc">${l.desc}</div>
      <div class="logro-pts">+${l.pts} pts</div>
    </div>`;
  });

  // Stats del gestor
  const gH=D.gestiones.filter(g=>g.fecha===hoyStr&&g.gestor===USER.nombre);
  const pagH=gH.filter(g=>g.estado==='pagado');
  const cobH=pagH.reduce((s,g)=>s+(g.montoPagado||0),0);
  document.getElementById('g-gest-hoy').textContent  = gH.length;
  document.getElementById('g-cobros-hoy').textContent= pagH.length;
  document.getElementById('g-cobrado-hoy').textContent=fL(cobH);
}

// ══════════════════════════════════════
// USUARIOS (solo gerente)
// ══════════════════════════════════════
function renderUsers() {
  if(!USER||USER.rol!=='gerente'){
    document.getElementById('users-list').innerHTML='<div class="empty"><span class="empty-icon">🔒</span><span>Sin permisos</span></div>';return;
  }
  document.getElementById('users-list').innerHTML=CONFIG.USUARIOS.map(u=>{
    const r=CONFIG.ROLES[u.rol]||{label:u.rol};
    return `<div class="li bl-blue">
      <div class="li-info">
        <div class="li-name">${u.nombre}</div>
        <div class="li-det">ID: ${u.id} · Rol: ${r.label}${u.cartera?' · Cartera: '+u.cartera:''}</div>
      </div>
      <span class="li-badge" style="background:var(--blue-g);color:var(--blue)">${r.label}</span>
      <button class="btn-sec btn-sm" onclick='editarUsuario(${JSON.stringify(u)})'>Editar</button>
    </div>`;
  }).join('')+
  `<button class="btn-pri" style="width:100%;margin-top:12px" onclick="nuevoUsuario()">+ Nuevo Usuario</button>`;
}

function nuevoUsuario() {
  const id=prompt('ID (sin espacios):'); if(!id)return;
  const nombre=prompt('Nombre completo:'); if(!nombre)return;
  const pass=prompt('Contraseña:'); if(!pass)return;
  const rol=prompt('Rol (gerente/supervisor/gestor):','gestor'); if(!rol)return;
  const cartera=prompt('Cartera asignada (opcional):','')||'';
  const u={id,nombre,pass,rol,avatar:nombre[0].toUpperCase(),cartera};
  API.guardarUsuario(u).then(()=>{
    CONFIG.USUARIOS.push(u); renderUsers();
    toast('Usuario creado: '+nombre,'success');
  }).catch(()=>{CONFIG.USUARIOS.push(u);renderUsers();toast('Guardado localmente','');});
}

function editarUsuario(u) {
  const pass=prompt(`Editar contraseña de ${u.nombre}:`,u.pass); if(!pass)return;
  const cartera=prompt('Cartera asignada:',u.cartera||'');
  const u2={...u,pass,cartera:cartera||''};
  const idx=CONFIG.USUARIOS.findIndex(x=>x.id===u.id);
  if(idx>=0) CONFIG.USUARIOS[idx]=u2;
  API.guardarUsuario(u2).then(()=>{renderUsers();toast('Usuario actualizado','success');})
    .catch(()=>{renderUsers();toast('Guardado localmente','');});
}

// ══════════════════════════════════════
// MODAL GESTIONAR
// ══════════════════════════════════════
function abrirModalPorNombre(nombre) {
  const cls=agrupar(D.prestamos);
  const c=cls.find(x=>x.cliente===nombre);
  if(c) abrirModal(c,0);
}

function abrirModal(c, idx=0) {
  clienteAct=c; estadoSel=''; siguienteIdx=idx+1;
  document.getElementById('modal').style.display='flex';
  document.getElementById('m-nombre').textContent=c.cliente;

  const dias=diasDesdeUltimoPago(c.cliente);
  const r=calcRiesgo(c.cliente);
  document.getElementById('m-info').innerHTML=
    `${c.diaPago} · Balance: ${fL(c.totalBal)} · Cuota: ${fL(c.totalCuo)}`+
    `<br><span style="color:${r.nivel.color}">${r.nivel.icon} Riesgo ${r.nivel.label} (score ${r.score})</span>`+
    (dias!==null?` · Último pago hace ${dias} días`:'');

  // Préstamos
  const ps=document.getElementById('m-prest-sec'),pl=document.getElementById('m-prest');
  if(c.prestamos&&c.prestamos.length){
    ps.style.display='block';
    pl.innerHTML=c.prestamos.map(p=>`<div class="prow"><span class="p-tipo">${p.tipo}</span><div><span class="p-monto">${fL(p.balance)}</span><span class="p-cuo">Cuota: ${fL(p.balanceCuotas)}</span></div></div>`).join('');
  } else ps.style.display='none';

  // Estados
  document.getElementById('m-estados').innerHTML=CONFIG.ESTADOS.filter(e=>e.value!=='pendiente').map(e=>
    `<button class="estado-btn" data-e="${e.value}" onclick="selEstado('${e.value}')" style="border-color:${e.color}">${e.icon} ${e.label}</button>`
  ).join('');

  // Reset campos
  ['m-comment','m-monto','m-prom-date','m-prom-monto'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('m-prom-date').min=hoyStr;
  document.getElementById('m-medio-pago').value='efectivo';
  ['m-monto-box','m-prom-date-box','m-prom-monto-box','m-medio-box'].forEach(id=>document.getElementById(id).style.display='none');
  document.getElementById('m-save').disabled=true;

  // Historial del cliente (historial de contactabilidad)
  const h=D.gestiones.filter(g=>g.cliente===c.cliente).sort((a,b)=>(b.fecha+b.hora).localeCompare(a.fecha+a.hora));
  const hs=document.getElementById('m-hist-sec'),hl=document.getElementById('m-hist');
  if(h.length){
    hs.style.display='block';
    hl.innerHTML=h.slice(0,15).map(g=>{
      const e=getEst(g.estado);
      const mt=g.montoPagado>0?' — '+fL(g.montoPagado):g.montoPromesa>0?' — Prom: '+fL(g.montoPromesa):'';
      return `<div class="hist-i">
        <div><span class="li-badge" style="background:${e.bg};color:${e.color};font-size:10px;padding:1px 7px">${e.icon} ${e.label}${mt}</span>
        ${g.comentario?`<div class="hist-c">${g.comentario}</div>`:''}
        ${g.fechaPromesa?`<div class="hist-p">📅 ${g.fechaPromesa}</div>`:''}
        <div class="hist-c" style="font-style:italic;color:var(--text3)">${g.gestor||''}</div>
        </div><div class="hist-d">${g.fecha}<br>${g.hora||''}</div></div>`;
    }).join('');
  } else { hs.style.display='none'; }

  // Plantillas WhatsApp
  renderPlantillasWA(c, r);

  // Iniciar timer
  iniciarTimer();
}

function iniciarTimer() {
  if(timerInterval) clearInterval(timerInterval);
  timerInicio=new Date();
  const el=document.getElementById('m-timer');
  timerInterval=setInterval(()=>{
    const secs=Math.floor((new Date()-timerInicio)/1000);
    const m=String(Math.floor(secs/60)).padStart(2,'0');
    const s=String(secs%60).padStart(2,'0');
    if(el) el.textContent=`⏱ ${m}:${s}`;
  },1000);
}

function renderPlantillasWA(c, riesgo) {
  const nivel=riesgo.score>=70?3:riesgo.score>=40?2:riesgo.score>=20?1:0;
  const dias=diasDesdeUltimoPago(c.cliente)??0;
  const el=document.getElementById('m-plantillas'); if(!el)return;
  el.innerHTML='<p class="fl" style="margin:8px 0 4px">📲 Plantillas WhatsApp:</p>'+
  CONFIG.PLANTILLAS_WA.map((p,i)=>{
    const txt=p.template
      .replace('{nombre}',c.cliente.split(' ')[0])
      .replace('{monto}',c.totalCuo.toFixed(2))
      .replace('{dias}',dias)
      .replace('{fecha}',hoyStr);
    return `<button class="btn-wa-tpl ${i===nivel?'active':''}" onclick='copiarWA(${JSON.stringify(txt)},${JSON.stringify(c.cliente)})'>${p.label}</button>`;
  }).join('');
}

function copiarWA(txt, cliente) {
  const nombre=cliente.split(' ')[0];
  const tel=D.prestamos.find(p=>p.cliente===cliente)?.telefono||'';
  if(navigator.clipboard) navigator.clipboard.writeText(txt).then(()=>toast('Mensaje copiado ✓','success'));
  if(tel) window.open(`https://wa.me/504${tel.replace(/-/g,'')}?text=${encodeURIComponent(txt)}`,'_blank');
  else toast('Mensaje copiado. Agrega el teléfono al cliente.','');
}

function abrirWA(nombreCliente) {
  const c=agrupar(D.prestamos).find(x=>x.cliente===nombreCliente);
  if(!c)return;
  const r=calcRiesgo(nombreCliente);
  const dias=diasDesdeUltimoPago(nombreCliente)??0;
  const nivel=r.score>=70?3:r.score>=40?2:r.score>=20?1:0;
  const p=CONFIG.PLANTILLAS_WA[nivel];
  const txt=p.template.replace('{nombre}',nombreCliente.split(' ')[0]).replace('{monto}',c.totalCuo.toFixed(2)).replace('{dias}',dias).replace('{fecha}',hoyStr);
  if(navigator.clipboard) navigator.clipboard.writeText(txt).then(()=>toast('Mensaje copiado','success'));
  toast('Plantilla copiada al portapapeles','success');
}

function selEstado(v) {
  estadoSel=v;
  document.querySelectorAll('.estado-btn').forEach(b=>{
    const sel=b.dataset.e===v, e=getEst(v);
    b.classList.toggle('sel',sel);
    b.style.background=sel?e.bg:'var(--bg3)';
    b.style.color=sel?e.color:'var(--text2)';
    b.style.borderColor=sel?e.color:'var(--border)';
  });
  document.getElementById('m-monto-box').style.display    = v==='pagado'?'block':'none';
  document.getElementById('m-medio-box').style.display    = v==='pagado'?'block':'none';
  document.getElementById('m-prom-date-box').style.display= v==='promesa'?'block':'none';
  document.getElementById('m-prom-monto-box').style.display=v==='promesa'?'block':'none';
  if(v==='pagado'&&clienteAct)  document.getElementById('m-monto').value=clienteAct.totalCuo.toFixed(2);
  if(v==='promesa'&&clienteAct) document.getElementById('m-prom-monto').value=clienteAct.totalCuo.toFixed(2);
  document.getElementById('m-save').disabled=false;
}

async function guardarGestion() {
  if(!estadoSel||!clienteAct) return;
  const mp = estadoSel==='pagado' ? parseFloat(document.getElementById('m-monto').value)||0 : 0;
  const mpr= estadoSel==='promesa'? parseFloat(document.getElementById('m-prom-monto').value)||0 : 0;
  const medio=document.getElementById('m-medio-pago').value||'efectivo';

  const g={
    cliente:clienteAct.cliente, estado:estadoSel,
    comentario:document.getElementById('m-comment').value,
    fechaPromesa:estadoSel==='promesa'?document.getElementById('m-prom-date').value:'',
    montoPagado:mp, montoPromesa:mpr, medioPago:medio,
    fecha:hoyStr, hora:new Date().toLocaleTimeString('es-HN'),
    gestor:USER?USER.nombre:'Gestor 1',
  };
  D.gestiones.push(g);

  const esCobro = estadoSel==='pagado' && mp>0;
  try { await API.guardarGestion(g); toast('Gestión guardada'+(mp>0?' — '+fL(mp):''),'success'); }
  catch(e){ toast('Guardado local',''); }

  // Celebración si es cobro
  if(esCobro) {
    cerrarModal();
    setTimeout(()=>celebrar(mp), 200);
    // Check logros y notificar nuevos
    const antes=GAME.calcLogros(D.gestiones.slice(0,-1),USER).desbloqueados;
    const despues=GAME.calcLogros(D.gestiones,USER).desbloqueados;
    const nuevo=despues.find(l=>!antes.includes(l));
    if(nuevo){const l=CONFIG.LOGROS.find(x=>x.id===nuevo);if(l)setTimeout(()=>toast(`${l.icon} ¡Logro desbloqueado! ${l.nombre} +${l.pts}pts`,'success'),3100);}
  } else {
    cerrarModal();
  }

  const at=document.querySelector('.menu-item.active'); switchTab(at?at.dataset.tab:'hoy');
}

function cerrarModal(e) {
  if(e&&e.target!==e.currentTarget) return;
  document.getElementById('modal').style.display='none';
  clienteAct=null; estadoSel='';
  if(timerInterval){clearInterval(timerInterval);timerInterval=null;}
  const el=document.getElementById('m-timer'); if(el)el.textContent='⏱ 00:00';
}

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => initLogin());
document.addEventListener('keydown', e => { if(e.key==='Escape'){cerrarModal();document.getElementById('resumen-inicial').style.display='none';} });
document.getElementById('login-pass').addEventListener('keydown', e => { if(e.key==='Enter') iniciarSesion(); });
