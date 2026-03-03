// ============================================
// APP v3 - Cobros Pro
// ============================================
let D = { prestamos: [], pagos: [], gestiones: [] };
let USER = null, estadoSel = '', clienteAct = null;
const hoy = new Date(), hoyStr = hoy.toISOString().split('T')[0];

// ── Utilidades ──
const fL = n => 'L ' + Number(n||0).toLocaleString('es-HN',{minimumFractionDigits:2,maximumFractionDigits:2});
const diaSem = () => ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'][hoy.getDay()];
const diaMes = () => hoy.getDate();
function getCiclo() {
  const y=hoy.getFullYear(),m=hoy.getMonth(),d=hoy.getDate(),dc=CONFIG.DIA_CIERRE;
  const ini = d<=dc ? new Date(y,m-1,dc+1) : new Date(y,m,dc+1);
  const fin = d<=dc ? new Date(y,m,dc) : new Date(y,m+1,dc);
  return { ini, fin, dias: Math.max(0,Math.ceil((fin-hoy)/864e5)), totalDias: Math.ceil((fin-ini)/864e5) };
}
const getEst = v => CONFIG.ESTADOS.find(e=>e.value===v) || CONFIG.ESTADOS[6];
const blClass = v => ({pagado:'bl-green',promesa:'bl-yellow',rechaza_pago:'bl-red',mensaje_enviado:'bl-blue',ilocalizable:'bl-purple'}[v]||'bl-gray');
const ultGest = c => D.gestiones.filter(g=>g.cliente===c).sort((a,b)=>(b.fecha+b.hora).localeCompare(a.fecha+a.hora))[0];
function agrupar(ps) {
  const m={};
  ps.forEach(p => {
    if(!m[p.cliente]) m[p.cliente]={cliente:p.cliente,telefono:p.telefono||'',cartera:p.cartera,diaPago:p.diaPago,prestamos:[],totalBal:0,totalCuo:0};
    m[p.cliente].prestamos.push(p); m[p.cliente].totalBal+=p.balance; m[p.cliente].totalCuo+=p.balanceCuotas;
  });
  return Object.values(m);
}
function toast(msg,type=''){const t=document.getElementById('toast');t.textContent=msg;t.className='toast '+(type==='success'?'ok':type==='error'?'err':'');t.style.display='block';setTimeout(()=>t.style.display='none',3500)}

// ══════════════════════════════════════
// LOGIN / SESIÓN
// ══════════════════════════════════════
function initLogin() {
  const sel = document.getElementById('login-usuario');
  sel.innerHTML = '<option value="">Seleccionar usuario...</option>';
  CONFIG.USUARIOS.forEach(u => {
    sel.innerHTML += '<option value="'+u.id+'">'+u.nombre+' ('+CONFIG.ROLES[u.rol].label+')</option>';
  });
  // Check session
  const saved = sessionStorage.getItem('cobros_user');
  if (saved) { USER = JSON.parse(saved); mostrarApp(); }
}

function iniciarSesion() {
  const uid = document.getElementById('login-usuario').value;
  const pass = document.getElementById('login-pass').value;
  const err = document.getElementById('login-error');
  if (!uid) { err.textContent = 'Seleccioná un usuario'; return; }
  const u = CONFIG.USUARIOS.find(x => x.id === uid);
  if (!u) { err.textContent = 'Usuario no encontrado'; return; }
  if (u.pass !== pass) { err.textContent = 'Contraseña incorrecta'; return; }
  USER = u;
  sessionStorage.setItem('cobros_user', JSON.stringify(u));
  err.textContent = '';
  mostrarApp();
}

function cerrarSesion() {
  USER = null;
  sessionStorage.removeItem('cobros_user');
  document.getElementById('app-container').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-pass').value = '';
}

function mostrarApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-container').style.display = 'flex';

  // User info
  document.getElementById('user-avatar').textContent = USER.avatar || USER.nombre[0];
  document.getElementById('user-name').textContent = USER.nombre;
  document.getElementById('user-role-label').textContent = CONFIG.ROLES[USER.rol].label;
  document.getElementById('sidebar-user-role').textContent = CONFIG.ROLES[USER.rol].label;

  // Build menu based on role
  const perms = CONFIG.ROLES[USER.rol];
  const menu = document.getElementById('sidebar-menu');
  menu.innerHTML = '';
  CONFIG.TABS.filter(t => perms.tabs.includes(t.id)).forEach(t => {
    menu.innerHTML += '<button class="menu-item'+(t.id==='dashboard'?' active':'')+'" data-tab="'+t.id+'" onclick="switchTab(\''+t.id+'\')"><span class="menu-icon">'+t.icon+'</span><span class="menu-label">'+t.label+'</span></button>';
  });
  // Add refresh
  menu.innerHTML += '<button class="menu-item" onclick="cargarTodosDatos()" style="margin-top:8px;opacity:.7"><span class="menu-icon">🔄</span><span class="menu-label">Actualizar</span></button>';

  // Populate filter selects
  populateFilters();
  cargarTodosDatos();
}

function populateFilters() {
  // Día del mes
  const dm = document.getElementById('f-dm');
  if (dm && dm.options.length <= 1) {
    for(let i=1;i<=31;i++) dm.innerHTML+='<option value="'+i+'">Día '+i+'</option>';
  }
  // Estados en filtros
  ['f-est','fh-est'].forEach(id => {
    const s=document.getElementById(id);
    if(s && s.options.length<=1) CONFIG.ESTADOS.forEach(e => s.innerHTML+='<option value="'+e.value+'">'+e.icon+' '+e.label+'</option>');
  });
}

// ══════════════════════════════════════
// SIDEBAR / TABS
// ══════════════════════════════════════
function toggleSidebar() {
  const sb=document.getElementById('sidebar'),ov=document.getElementById('sidebar-overlay');
  if(window.innerWidth<=768){sb.classList.toggle('open');ov.classList.toggle('show')}
  else sb.classList.toggle('mini');
}
function switchTab(id) {
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.menu-item').forEach(m=>m.classList.remove('active'));
  const tab=document.getElementById('tab-'+id);
  if(tab) tab.classList.add('active');
  const mi=document.querySelector('.menu-item[data-tab="'+id+'"]');
  if(mi) mi.classList.add('active');
  if(window.innerWidth<=768){document.getElementById('sidebar').classList.remove('open');document.getElementById('sidebar-overlay').classList.remove('show')}
  switch(id){case 'dashboard':renderDash();break;case 'cartera':filtrarCartera();break;case 'hoy':renderHoy();break;case 'historial':renderHist();break;case 'pagos':filtrarPagos();break;case 'usuarios':renderUsers();break}
}

// ══════════════════════════════════════
// CARGA DE DATOS
// ══════════════════════════════════════
async function cargarTodosDatos() {
  document.getElementById('loading').style.display='flex';
  try {
    const [pr,pa,ge] = await Promise.all([API.getPrestamos(),API.getPagos(),API.getGestiones()]);
    D.prestamos=pr.data||[];D.pagos=pa.data||[];D.gestiones=ge.data||[];
    toast('Datos sincronizados','success');
  } catch(e) {
    if (e.message === 'URL_NO_CONFIGURADA') {
      cargarEjemplo();
      toast('Modo demo — Configurá la URL en config.js','error');
    } else {
      cargarEjemplo();
      toast('Sin conexión — Datos de ejemplo','error');
    }
  }
  document.getElementById('loading').style.display='none';
  const at=document.querySelector('.menu-item.active');
  switchTab(at?at.dataset.tab:'dashboard');
}

function cargarEjemplo() {
  D.prestamos=[
    {id:5,cliente:"Carmen Dalila Vasquez Ferrera",tipo:"PREST. MENSUAL",capital:15264,balance:13662.69,balanceCuotas:728.70,diaPago:"Día 17",cartera:"Zona 3"},
    {id:9,cliente:"Gladys Carolina Castillo Ramirez",tipo:"PREST. QUINCENAL",capital:6000,balance:6000,balanceCuotas:600,diaPago:"Día 15",cartera:"Zona 3"},
    {id:13,cliente:"Angelica Patricia Pineda Carbajal",tipo:"PREST. QUINCENAL",capital:12000,balance:12000,balanceCuotas:2840,diaPago:"Día 15",cartera:"Zona 3"},
    {id:15,cliente:"Daisy Rivera Valladares",tipo:"PREST. SEMANAL",capital:13400,balance:8500,balanceCuotas:1200,diaPago:"Día lunes",cartera:"Zona 3"},
    {id:19,cliente:"Keylin Roxana Mejia Garcia",tipo:"PREST. QUINCENAL",capital:12598,balance:12598,balanceCuotas:5292.43,diaPago:"Día 15",cartera:"Zona 3"},
    {id:24,cliente:"Mauricio Zamora Perdomo",tipo:"PREST. SEMANAL",capital:7958,balance:4200,balanceCuotas:850,diaPago:"Día miércoles",cartera:"Zona 3"},
    {id:25,cliente:"Mirian Maritza Flores Aguilar",tipo:"PREST. SEMANAL",capital:3500,balance:1800,balanceCuotas:400,diaPago:"Día miércoles",cartera:"Zona 3"},
    {id:26,cliente:"Olvin Enrique Castro Ortega",tipo:"PREST. SEMANAL",capital:5822,balance:4443.16,balanceCuotas:476.10,diaPago:"Día lunes",cartera:"Zona 3"},
    {id:28,cliente:"Suyapa Yadira Cardona Marquez",tipo:"PREST. QUINCENAL",capital:10000,balance:7500,balanceCuotas:1500,diaPago:"Día 15",cartera:"Zona 3"},
    {id:29,cliente:"Mario Emmanuel Lopez Ortez",tipo:"PREST. SEMANAL",capital:4500,balance:3200,balanceCuotas:520,diaPago:"Día martes",cartera:"Zona 3"},
    {id:30,cliente:"Delmy Cristina Gutierrez Caceres",tipo:"PREST. SEMANAL",capital:8000,balance:5600,balanceCuotas:1100,diaPago:"Día jueves",cartera:"Zona 3"},
  ];
  D.pagos=[
    {cliente:"Carmen Dalila Vasquez Ferrera",tipo:"PREST. MENSUAL",valor:728.70,fecha:"2026-02-10",caja:"Bac"},
    {cliente:"Gladys Carolina Castillo Ramirez",tipo:"PREST. QUINCENAL",valor:600,fecha:"2026-02-11",caja:"Bac"},
    {cliente:"Angelica Patricia Pineda Carbajal",tipo:"PREST. QUINCENAL",valor:2840,fecha:"2026-02-12",caja:"Ficohsa"},
    {cliente:"Keylin Roxana Mejia Garcia",tipo:"PREST. QUINCENAL",valor:5292.43,fecha:"2026-02-12",caja:"Banpais"},
    {cliente:"Daisy Rivera Valladares",tipo:"PREST. SEMANAL",valor:1200,fecha:"2026-02-24",caja:"Bac"},
    {cliente:"Olvin Enrique Castro Ortega",tipo:"PREST. SEMANAL",valor:476.10,fecha:"2026-02-24",caja:"Ficohsa"},
    {cliente:"Mauricio Zamora Perdomo",tipo:"PREST. SEMANAL",valor:850,fecha:hoyStr,caja:"Bac"},
    {cliente:"Mirian Maritza Flores Aguilar",tipo:"PREST. SEMANAL",valor:400,fecha:hoyStr,caja:"Ficohsa"},
  ];
  D.gestiones=[
    {cliente:"Carmen Dalila Vasquez Ferrera",estado:"promesa",comentario:"Paga el viernes",fechaPromesa:"2026-02-28",montoPagado:0,montoPromesa:728.70,fecha:"2026-02-25",hora:"10:30",gestor:"Gestor 1"},
    {cliente:"Gladys Carolina Castillo Ramirez",estado:"mensaje_enviado",comentario:"WhatsApp enviado",fechaPromesa:"",montoPagado:0,montoPromesa:0,fecha:hoyStr,hora:"08:15",gestor:"Gestor 1"},
    {cliente:"Angelica Patricia Pineda Carbajal",estado:"pagado",comentario:"Pagó en Ficohsa",fechaPromesa:"",montoPagado:2840,montoPromesa:0,fecha:hoyStr,hora:"09:45",gestor:"Gestor 1"},
    {cliente:"Mauricio Zamora Perdomo",estado:"pagado",comentario:"Pagó cuota completa",fechaPromesa:"",montoPagado:850,montoPromesa:0,fecha:hoyStr,hora:"11:20",gestor:"Gestor 2"},
  ];
}

// ══════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════
function renderDash() {
  const act = D.prestamos.filter(p=>(p.balance+p.balanceCuotas)>=CONFIG.MIN_BALANCE);
  const c = getCiclo();
  const totCar = act.reduce((s,p)=>s+p.balance,0);
  const totCuo = act.reduce((s,p)=>s+p.balanceCuotas,0);
  const totRec = D.pagos.reduce((s,p)=>s+p.valor,0);
  const cliU = [...new Set(act.map(p=>p.cliente))];
  const gH = D.gestiones.filter(g=>g.fecha===hoyStr);
  const cont = [...new Set(gH.map(g=>g.cliente))];
  const pagH = gH.filter(g=>g.estado==='pagado');

  // Cobrado hoy
  const pagosHoy = D.pagos.filter(p=>p.fecha===hoyStr);
  const mPagosHoy = pagosHoy.reduce((s,p)=>s+p.valor,0);
  const mGestHoy = pagH.reduce((s,g)=>s+(parseFloat(g.montoPagado)||0),0);
  const cobHoy = mPagosHoy + mGestHoy;

  // % cobro
  const pct = totCuo>0?(totRec/totCuo*100):0;

  // Proyección
  const diasT = c.totalDias||1, diasP = diasT-c.dias;
  const promD = diasP>0?totRec/diasP:0;
  const proy = totRec+(promD*c.dias);
  const pctProy = totCuo>0?(proy/totCuo*100):0;

  // Falta para meta
  const falta = Math.max(0, totCuo - totRec);
  const faltaDiario = c.dias > 0 ? falta / c.dias : falta;

  // Render
  document.getElementById('ciclo-info').textContent = 'Ciclo: '+c.ini.toLocaleDateString('es-HN')+' - '+c.fin.toLocaleDateString('es-HN');
  const dc=document.getElementById('dias-cierre');
  dc.textContent=c.dias+' días para cierre';
  dc.className='badge-cierre '+(c.dias<=3?'danger':c.dias<=7?'warning':'ok');

  document.getElementById('s-cobrado-hoy').textContent=fL(cobHoy);
  document.getElementById('s-cobros-count').textContent=(pagosHoy.length+pagH.length)+' cobros hoy';
  document.getElementById('s-pct').textContent=pct.toFixed(1)+'%';
  document.getElementById('s-pct-det').textContent=fL(totRec)+' de '+fL(totCuo);
  document.getElementById('s-proyeccion').textContent=fL(proy);
  document.getElementById('s-proy-pct').textContent=pctProy.toFixed(1)+'% de la meta';
  document.getElementById('s-falta-meta').textContent=fL(falta);
  document.getElementById('s-falta-det').textContent=c.dias>0?fL(faltaDiario)+'/día para llegar':'Ciclo cerrado';

  document.getElementById('s-cartera').textContent=fL(totCar);
  document.getElementById('s-clientes').textContent=cliU.length+' clientes';
  document.getElementById('s-cuotas').textContent=fL(totCuo);
  document.getElementById('s-recup').textContent=fL(totRec);
  document.getElementById('s-recup-count').textContent=D.pagos.length+' pagos';
  document.getElementById('s-gest').textContent=gH.length;
  document.getElementById('s-contact').textContent=cont.length+'/'+cliU.length+' contactados';

  // Progress
  const pb=document.getElementById('progress-bars');pb.innerHTML='';
  [{l:'% Cobro del Ciclo',v:totRec,mx:totCuo,cl:'#22c55e'},{l:'Proyección vs Meta',v:proy,mx:totCuo,cl:'#a855f7'},{l:'Contactados Hoy',v:cont.length,mx:cliU.length,cl:'#3b82f6'},{l:'Efectividad Hoy',v:pagH.length,mx:gH.length||1,cl:'#f59e0b'}].forEach(b=>{
    const p=b.mx>0?Math.min(b.v/b.mx*100,100):0;
    pb.innerHTML+='<div class="prog"><div class="prog-head"><span class="prog-lbl">'+b.l+'</span><span class="prog-pct">'+p.toFixed(1)+'%</span></div><div class="prog-track"><div class="prog-fill" style="width:'+p+'%;background:'+b.cl+'"></div></div></div>';
  });

  // Estados
  const eh=document.getElementById('estados-hoy');eh.innerHTML='';
  CONFIG.ESTADOS.forEach(e=>{
    const n=gH.filter(g=>g.estado===e.value).length;
    const m=gH.filter(g=>g.estado===e.value&&g.montoPagado).reduce((s,g)=>s+(parseFloat(g.montoPagado)||0),0);
    eh.innerHTML+='<div class="erow"><div class="erow-l"><span>'+e.icon+'</span><span>'+e.label+'</span></div><div style="display:flex;align-items:center;gap:8px">'+(m>0?'<span style="font-size:11px;color:var(--green);font-weight:600">'+fL(m)+'</span>':'')+'<span class="ebadge" style="background:'+e.bg+';color:'+e.color+'">'+n+'</span></div></div>';
  });

  // Promesas vencidas
  const pv=D.gestiones.filter(g=>g.estado==='promesa'&&g.fechaPromesa&&g.fechaPromesa<=hoyStr&&!D.gestiones.some(g2=>g2.cliente===g.cliente&&g2.estado==='pagado'&&g2.fecha>=g.fechaPromesa));
  const pvBox=document.getElementById('promesas-box');
  if(pv.length>0){pvBox.style.display='block';document.getElementById('prom-count').textContent=pv.length;document.getElementById('prom-list').innerHTML=pv.slice(0,8).map(g=>'<div class="pi"><span class="pi-n">'+g.cliente+'</span><span class="pi-f">'+g.fechaPromesa+(g.montoPromesa?' — '+fL(g.montoPromesa):'')+'</span></div>').join('')}
  else pvBox.style.display='none';
}

// ══════════════════════════════════════
// CARTERA
// ══════════════════════════════════════
function filtrarCartera() {
  const ft=document.getElementById('f-texto')?.value.toLowerCase()||'';
  const fds=document.getElementById('f-ds')?.value||'';
  const fdm=document.getElementById('f-dm')?.value||'';
  const fe=document.getElementById('f-est')?.value||'';
  const fo=document.getElementById('f-ord')?.value||'balance_desc';

  let cls=agrupar(D.prestamos.filter(p=>(p.balance+p.balanceCuotas)>=CONFIG.MIN_BALANCE));
  if(ft) cls=cls.filter(c=>c.cliente.toLowerCase().includes(ft));
  if(fds) cls=cls.filter(c=>c.diaPago.toLowerCase().includes(fds));
  if(fdm) cls=cls.filter(c=>{const m=c.diaPago.match(/Día (\d+)/);return m&&parseInt(m[1])===parseInt(fdm)});
  if(fe) cls=cls.filter(c=>{const u=ultGest(c.cliente);if(fe==='pendiente') return !u;return u&&u.estado===fe});

  switch(fo){case 'balance_desc':cls.sort((a,b)=>b.totalBal-a.totalBal);break;case 'balance_asc':cls.sort((a,b)=>a.totalBal-b.totalBal);break;case 'cuotas_desc':cls.sort((a,b)=>b.totalCuo-a.totalCuo);break;case 'nombre':cls.sort((a,b)=>a.cliente.localeCompare(b.cliente));break}

  document.getElementById('c-count').textContent=cls.length+' clientes activos';
  document.getElementById('c-list').innerHTML=cls.map(c=>{
    const u=ultGest(c.cliente),e=u?getEst(u.estado):getEst('pendiente'),tel=c.telefono?c.telefono.replace(/-/g,''):'';
    return '<div class="li '+blClass(u?.estado||'pendiente')+'"><div class="li-info"><div class="li-name">'+c.cliente+'</div><div class="li-det">'+c.diaPago+' · '+c.cartera+' · '+c.prestamos.length+' prést.</div></div><div class="li-amt"><div class="li-bal">'+fL(c.totalBal)+'</div><div class="li-cuo">Cuota: '+fL(c.totalCuo)+'</div></div><span class="li-badge" style="background:'+e.bg+';color:'+e.color+'">'+e.icon+' '+e.label+'</span><div class="li-acts"><button class="btn-gest" onclick=\'abrirModal('+JSON.stringify(c).replace(/'/g,"\\'")+')\'">Gestionar</button>'+(tel?'<a class="btn-wa" href="https://wa.me/504'+tel+'" target="_blank">💬</a>':'')+'</div></div>';
  }).join('');
}

// ══════════════════════════════════════
// GESTIÓN HOY
// ══════════════════════════════════════
function renderHoy() {
  const ds=diaSem(),dm=diaMes();
  document.getElementById('hoy-info').textContent=hoy.toLocaleDateString('es-HN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const act=D.prestamos.filter(p=>(p.balance+p.balanceCuotas)>=CONFIG.MIN_BALANCE);
  const ch={};
  act.forEach(p=>{const dp=p.diaPago.toLowerCase();if(dp.includes(ds)||dp==='día '+dm){if(!ch[p.cliente])ch[p.cliente]={cliente:p.cliente,telefono:p.telefono||'',cartera:p.cartera,diaPago:p.diaPago,prestamos:[],totalBal:0,totalCuo:0};ch[p.cliente].prestamos.push(p);ch[p.cliente].totalBal+=p.balance;ch[p.cliente].totalCuo+=p.balanceCuotas}});
  const lista=Object.values(ch);
  const gDH=D.gestiones.filter(g=>g.fecha===hoyStr);
  const yaG=new Set(gDH.map(g=>g.cliente));
  const pend=lista.filter(c=>!yaG.has(c.cliente)),comp=lista.filter(c=>yaG.has(c.cliente));

  document.getElementById('hoy-empty').style.display=lista.length===0?'block':'none';
  document.getElementById('hoy-pend').innerHTML=pend.length?'<h3 class="sh sh-r">⏳ Pendientes ('+pend.length+')</h3>'+pend.map(c=>'<div class="li li-pend" style="margin-bottom:6px"><div class="li-info"><div class="li-name">'+c.cliente+'</div><div class="li-det">'+c.diaPago+' · Cuota: '+fL(c.totalCuo)+'</div></div><div class="li-bal">'+fL(c.totalBal)+'</div><button class="btn-gest" onclick=\'abrirModal('+JSON.stringify(c).replace(/'/g,"\\'")+')\'">Gestionar</button></div>').join(''):'';
  document.getElementById('hoy-done').innerHTML=comp.length?'<h3 class="sh sh-g">✅ Gestionados ('+comp.length+')</h3>'+comp.map(c=>{const u=gDH.filter(g=>g.cliente===c.cliente).sort((a,b)=>(b.hora||'').localeCompare(a.hora||''))[0];const e=u?getEst(u.estado):getEst('pendiente');const mTxt=u&&u.montoPagado>0?' — '+fL(u.montoPagado):'';return '<div class="li li-done '+blClass(u?.estado)+'" style="margin-bottom:6px"><div class="li-info"><div class="li-name">'+c.cliente+'</div><div class="li-det">'+(u?.comentario||'')+mTxt+'</div></div><span class="li-badge" style="background:'+e.bg+';color:'+e.color+'">'+e.icon+' '+e.label+'</span></div>'}).join(''):'';
}

// ══════════════════════════════════════
// HISTORIAL
// ══════════════════════════════════════
function renderHist(){document.getElementById('fh-date').value=hoyStr;filtrarHistorial()}
function filtrarHistorial() {
  const ff=document.getElementById('fh-date').value,fe=document.getElementById('fh-est').value;
  let g=[...D.gestiones].sort((a,b)=>(b.fecha+b.hora).localeCompare(a.fecha+a.hora));
  // Filtro por rol: gestores solo ven sus gestiones
  if(USER && USER.rol==='gestor' && !CONFIG.ROLES[USER.rol].canSeeAllGestiones) g=g.filter(x=>x.gestor===USER.nombre);
  if(ff) g=g.filter(x=>x.fecha===ff);
  if(fe) g=g.filter(x=>x.estado===fe);
  document.getElementById('h-count').textContent=g.length+' gestiones';
  if(!g.length){document.getElementById('h-list').innerHTML='<div class="empty"><span class="empty-icon">📭</span><span>Sin resultados</span></div>';return}
  document.getElementById('h-list').innerHTML=g.map(x=>{const e=getEst(x.estado);const mTxt=x.montoPagado>0?' — '+fL(x.montoPagado):'';return '<div class="li '+blClass(x.estado)+'"><div class="li-info"><div class="li-name">'+x.cliente+'</div>'+(x.comentario?'<div class="li-det">'+x.comentario+mTxt+'</div>':'')+(x.fechaPromesa?'<div class="li-det" style="color:var(--yellow)">Promesa: '+x.fechaPromesa+(x.montoPromesa?' — '+fL(x.montoPromesa):'')+'</div>':'')+'<div class="li-det" style="color:var(--text3)">Gestor: '+(x.gestor||'—')+'</div></div><span class="li-badge" style="background:'+e.bg+';color:'+e.color+'">'+e.icon+' '+e.label+'</span><span class="li-date">'+x.fecha+' '+( x.hora||'')+'</span></div>'}).join('');
}
function limpiarFiltrosHist(){document.getElementById('fh-date').value='';document.getElementById('fh-est').value='';filtrarHistorial()}

// ══════════════════════════════════════
// PAGOS
// ══════════════════════════════════════
function filtrarPagos() {
  const ft=document.getElementById('fp-txt')?.value.toLowerCase()||'';
  let p=[...D.pagos].sort((a,b)=>b.fecha.localeCompare(a.fecha));
  if(ft) p=p.filter(x=>x.cliente.toLowerCase().includes(ft));
  document.getElementById('p-total').textContent='Total: '+fL(p.reduce((s,x)=>s+x.valor,0));
  document.getElementById('p-list').innerHTML=p.map(x=>'<div class="li bl-green"><div class="li-info"><div class="li-name">'+x.cliente+'</div><div class="li-det">'+x.tipo+' · '+(x.caja||'')+'</div></div><div class="li-val">'+fL(x.valor)+'</div><span class="li-date">'+x.fecha+'</span></div>').join('');
}

// ══════════════════════════════════════
// USUARIOS (solo gerente)
// ══════════════════════════════════════
function renderUsers() {
  if(!USER || USER.rol !== 'gerente'){document.getElementById('users-list').innerHTML='<div class="empty"><span class="empty-icon">🔒</span><span>Sin permisos</span></div>';return}
  document.getElementById('users-list').innerHTML=CONFIG.USUARIOS.map(u=>{
    const r=CONFIG.ROLES[u.rol];
    return '<div class="li bl-blue"><div class="li-info"><div class="li-name">'+u.nombre+'</div><div class="li-det">ID: '+u.id+' · Rol: '+r.label+'</div></div><span class="li-badge" style="background:var(--blue-g);color:var(--blue)">'+r.label+'</span></div>';
  }).join('');
}

// ══════════════════════════════════════
// MODAL GESTIONAR
// ══════════════════════════════════════
function abrirModal(c) {
  clienteAct=c;estadoSel='';
  document.getElementById('modal').style.display='flex';
  document.getElementById('m-nombre').textContent=c.cliente;
  document.getElementById('m-info').textContent=c.diaPago+' · Balance: '+fL(c.totalBal)+' · Cuota: '+fL(c.totalCuo);

  // Préstamos
  const ps=document.getElementById('m-prest-sec'),pl=document.getElementById('m-prest');
  if(c.prestamos&&c.prestamos.length){ps.style.display='block';pl.innerHTML=c.prestamos.map(p=>'<div class="prow"><span class="p-tipo">'+p.tipo+'</span><div><span class="p-monto">'+fL(p.balance)+'</span><span class="p-cuo">Cuota: '+fL(p.balanceCuotas)+'</span></div></div>').join('')}else ps.style.display='none';

  // Estados
  document.getElementById('m-estados').innerHTML=CONFIG.ESTADOS.filter(e=>e.value!=='pendiente').map(e=>'<button class="estado-btn" data-e="'+e.value+'" onclick="selEstado(\''+e.value+'\')" style="border-color:'+e.color+'">'+e.icon+' '+e.label+'</button>').join('');

  // Reset
  document.getElementById('m-comment').value='';
  document.getElementById('m-monto').value='';
  document.getElementById('m-prom-date').value='';
  document.getElementById('m-prom-date').min=hoyStr;
  document.getElementById('m-prom-monto').value='';
  document.getElementById('m-monto-box').style.display='none';
  document.getElementById('m-prom-date-box').style.display='none';
  document.getElementById('m-prom-monto-box').style.display='none';
  document.getElementById('m-save').disabled=true;

  // Historial
  const h=D.gestiones.filter(g=>g.cliente===c.cliente).sort((a,b)=>(b.fecha+b.hora).localeCompare(a.fecha+a.hora));
  const hs=document.getElementById('m-hist-sec'),hl=document.getElementById('m-hist');
  if(h.length){hs.style.display='block';hl.innerHTML=h.slice(0,10).map(g=>{const e=getEst(g.estado);const mt=g.montoPagado>0?' — '+fL(g.montoPagado):(g.montoPromesa>0?' — Prom: '+fL(g.montoPromesa):'');return '<div class="hist-i"><div><span class="li-badge" style="background:'+e.bg+';color:'+e.color+';font-size:10px;padding:1px 7px">'+e.icon+' '+e.label+mt+'</span>'+(g.comentario?'<div class="hist-c">'+g.comentario+'</div>':'')+(g.fechaPromesa?'<div class="hist-p">Promesa: '+g.fechaPromesa+'</div>':'')+'<div class="hist-c" style="font-style:italic">'+( g.gestor||'')+'</div></div><div class="hist-d">'+g.fecha+'<br>'+(g.hora||'')+'</div></div>'}).join('')}else hs.style.display='none';
}

function selEstado(v) {
  estadoSel=v;
  document.querySelectorAll('.estado-btn').forEach(b=>{
    const sel=b.dataset.e===v,e=getEst(v);
    b.classList.toggle('sel',sel);
    if(sel){b.style.background=e.bg;b.style.color=e.color;b.style.borderColor=e.color}
    else{b.style.background='var(--bg3)';b.style.color='var(--text2)';b.style.borderColor='var(--border)'}
  });
  document.getElementById('m-monto-box').style.display=v==='pagado'?'block':'none';
  document.getElementById('m-prom-date-box').style.display=v==='promesa'?'block':'none';
  document.getElementById('m-prom-monto-box').style.display=v==='promesa'?'block':'none';
  if(v==='pagado'&&clienteAct) document.getElementById('m-monto').value=clienteAct.totalCuo.toFixed(2);
  if(v==='promesa'&&clienteAct) document.getElementById('m-prom-monto').value=clienteAct.totalCuo.toFixed(2);
  document.getElementById('m-save').disabled=false;
}

async function guardarGestion() {
  if(!estadoSel||!clienteAct) return;
  const mp=estadoSel==='pagado'?parseFloat(document.getElementById('m-monto').value)||0:0;
  const mpr=estadoSel==='promesa'?parseFloat(document.getElementById('m-prom-monto').value)||0:0;

  const g={
    cliente:clienteAct.cliente,estado:estadoSel,
    comentario:document.getElementById('m-comment').value,
    fechaPromesa:estadoSel==='promesa'?document.getElementById('m-prom-date').value:'',
    montoPagado:mp,montoPromesa:mpr,
    fecha:hoyStr,hora:new Date().toLocaleTimeString('es-HN'),
    gestor:USER?USER.nombre:'Gestor 1',
  };
  D.gestiones.push(g);
  try{await API.guardarGestion(g);toast('Gestión guardada'+(mp>0?' — '+fL(mp):''),'success')}catch(e){toast('Guardado local','');}
  cerrarModal();
  const at=document.querySelector('.menu-item.active');switchTab(at?at.dataset.tab:'dashboard');
}

function cerrarModal(e){if(e&&e.target!==e.currentTarget)return;document.getElementById('modal').style.display='none';clienteAct=null;estadoSel=''}

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════
document.addEventListener('DOMContentLoaded',()=>initLogin());
document.addEventListener('keydown',e=>{if(e.key==='Escape')cerrarModal()});
document.getElementById('login-pass').addEventListener('keydown',e=>{if(e.key==='Enter')iniciarSesion()});
