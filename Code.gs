// ================================================================
// COBROS PRO v4 - BACKEND (Google Apps Script)
// Sheets: Prestamos | Pagos | Gestiones | Usuarios | Config
// ================================================================
const HOJA_PRESTAMOS = 'Prestamos';
const HOJA_PAGOS     = 'Pagos';
const HOJA_GESTIONES = 'Gestiones';
const HOJA_USUARIOS  = 'Usuarios';
const HOJA_CONFIG    = 'Config';

function doGet(e) {
  const a = e.parameter.action;
  if (!a) return HtmlService.createHtmlOutput('Cobros Pro API v4');
  try {
    let r;
    switch(a) {
      case 'getPrestamos':  r = getPrestamos(); break;
      case 'getPagos':      r = getPagos(e.parameter.fechaInicio, e.parameter.fechaFin); break;
      case 'getGestiones':  r = getGestiones(e.parameter.fechaInicio, e.parameter.fechaFin); break;
      case 'getDashboard':  r = getDashboard(); break;
      case 'getUsuarios':   r = getUsuarios(); break;
      case 'getMeta':       r = getMeta(); break;
      case 'getRanking':    r = getRanking(e.parameter.fechaInicio, e.parameter.fechaFin); break;
      default:              r = {error:'Acción inválida'};
    }
    return json(r);
  } catch(err) { return json({error: err.message}); }
}

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.action === 'guardarGestion')  return json(guardarGestion(d.gestion));
    if (d.action === 'guardarMeta')     return json(guardarMeta(d.meta));
    if (d.action === 'guardarUsuario')  return json(guardarUsuario(d.usuario));
    if (d.action === 'eliminarUsuario') return json(eliminarUsuario(d.id));
    return json({error:'Acción inválida'});
  } catch(err) { return json({error: err.message}); }
}

function json(d) {
  return ContentService.createTextOutput(JSON.stringify(d)).setMimeType(ContentService.MimeType.JSON);
}

// ── USUARIOS (Sheets) ──────────────────────────────────────────
// Columnas: ID | Nombre | Password | Rol | Avatar | Cartera
function getUsuarios() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName(HOJA_USUARIOS);
  if (!h) { crearHojaUsuarios(ss); return {success:true, data:[]}; }
  const d = h.getDataRange().getValues(), r = [];
  for (let i = 1; i < d.length; i++) {
    const f = d[i]; if (!f[0]) continue;
    r.push({ id:String(f[0]).trim(), nombre:String(f[1]).trim(), pass:String(f[2]).trim(),
              rol:String(f[3]).trim(), avatar:String(f[4]||'').trim(), cartera:String(f[5]||'').trim() });
  }
  return {success:true, data:r};
}

function guardarUsuario(u) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName(HOJA_USUARIOS);
  if (!h) h = crearHojaUsuarios(ss);
  const d = h.getDataRange().getValues();
  for (let i = 1; i < d.length; i++) {
    if (String(d[i][0]).trim() === String(u.id).trim()) {
      h.getRange(i+1,1,1,6).setValues([[u.id, u.nombre, u.pass, u.rol, u.avatar||u.nombre[0], u.cartera||'']]);
      return {success:true, message:'Usuario actualizado'};
    }
  }
  h.appendRow([u.id, u.nombre, u.pass, u.rol, u.avatar||u.nombre[0], u.cartera||'']);
  return {success:true, message:'Usuario creado'};
}

function eliminarUsuario(id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h  = ss.getSheetByName(HOJA_USUARIOS);
  if (!h) return {success:false, message:'Hoja no existe'};
  const d  = h.getDataRange().getValues();
  for (let i = 1; i < d.length; i++) {
    if (String(d[i][0]).trim() === String(id).trim()) { h.deleteRow(i+1); return {success:true}; }
  }
  return {success:false, message:'No encontrado'};
}

function crearHojaUsuarios(ss) {
  const h = ss.insertSheet(HOJA_USUARIOS);
  h.appendRow(['ID','Nombre','Password','Rol','Avatar','Cartera']);
  h.getRange(1,1,1,6).setFontWeight('bold').setBackground('#0f172a').setFontColor('#fff');
  [100,200,100,120,80,150].forEach((w,i) => h.setColumnWidth(i+1, w));
  h.setFrozenRows(1);
  h.appendRow(['admin','Administrador','1234','gerente','A','']);
  return h;
}

// ── CONFIG / META ──────────────────────────────────────────────
function getMeta() {
  const h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_CONFIG);
  if (!h) return {success:true, meta:0};
  const d = h.getDataRange().getValues();
  for (let i = 1; i < d.length; i++) {
    if (String(d[i][0]).toLowerCase() === 'meta_ciclo') return {success:true, meta:parseFloat(d[i][1])||0};
  }
  return {success:true, meta:0};
}

function guardarMeta(meta) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h    = ss.getSheetByName(HOJA_CONFIG);
  if (!h) {
    h = ss.insertSheet(HOJA_CONFIG);
    h.appendRow(['Clave','Valor']);
    h.getRange(1,1,1,2).setFontWeight('bold').setBackground('#0f172a').setFontColor('#fff');
  }
  const d = h.getDataRange().getValues();
  for (let i = 1; i < d.length; i++) {
    if (String(d[i][0]).toLowerCase() === 'meta_ciclo') { h.getRange(i+1,2).setValue(meta); return {success:true}; }
  }
  h.appendRow(['meta_ciclo', meta]);
  return {success:true};
}

// ── PRÉSTAMOS ──────────────────────────────────────────────────
function getPrestamos() {
  const h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_PRESTAMOS);
  const d = h.getDataRange().getValues(), r = [];
  for (let i = 1; i < d.length; i++) {
    const f = d[i], bal = parseFloat(f[5])||0, bc = parseFloat(f[6])||0;
    if ((bal+bc) < 5) continue;
    r.push({ id:f[0], cliente:String(f[1]).trim(), tipo:f[2], fecha:ff(f[3]),
              capital:parseFloat(f[4])||0, balance:bal, balanceCuotas:bc,
              diaPago:String(f[7]).trim(), cartera:String(f[8]||'').trim() });
  }
  return {success:true, data:r, total:r.length};
}

// ── PAGOS ──────────────────────────────────────────────────────
// Columnas: ID|Cliente|Tipo|Valor|Fecha|Capital|Intereses|Caja|Cartera|Usuario|MedioPago
function getPagos(fi, fn) {
  const h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_PAGOS);
  const d = h.getDataRange().getValues(), r = [];
  for (let i = 1; i < d.length; i++) {
    const f = d[i], fe = ff(f[4]);
    if (fi && fe < fi) continue;
    if (fn && fe > fn) continue;
    r.push({ id:f[0], cliente:String(f[1]).trim(), tipo:f[2], valor:parseFloat(f[3])||0, fecha:fe,
              capital:parseFloat(f[5])||0, intereses:parseFloat(f[6])||0, caja:String(f[7]||''),
              cartera:String(f[8]||''), usuario:String(f[9]||''), medioPago:String(f[10]||'efectivo') });
  }
  return {success:true, data:r, total:r.length};
}

// ── GESTIONES ─────────────────────────────────────────────────
function getGestiones(fi, fn) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h    = ss.getSheetByName(HOJA_GESTIONES);
  if (!h) { crearHoja(ss); return {success:true, data:[], total:0}; }
  const d  = h.getDataRange().getValues(), r = [];
  for (let i = 1; i < d.length; i++) {
    const f = d[i]; if (!f[0]) continue;
    const fe = ff(f[0]);
    if (fi && fe < fi) continue;
    if (fn && fe > fn) continue;
    r.push({ fecha:fe, hora:String(f[1]), cliente:String(f[2]).trim(), estado:f[3],
              comentario:f[4]||'', fechaPromesa:ff(f[5]),
              montoPagado:parseFloat(f[6])||0, montoPromesa:parseFloat(f[7])||0, gestor:f[8]||'' });
  }
  return {success:true, data:r, total:r.length};
}

function guardarGestion(g) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h    = ss.getSheetByName(HOJA_GESTIONES);
  if (!h)  h = crearHoja(ss);
  const a  = new Date();
  h.appendRow([
    g.fecha || Utilities.formatDate(a,'America/Tegucigalpa','yyyy-MM-dd'),
    g.hora  || Utilities.formatDate(a,'America/Tegucigalpa','HH:mm:ss'),
    g.cliente, g.estado, g.comentario||'', g.fechaPromesa||'',
    parseFloat(g.montoPagado)||0, parseFloat(g.montoPromesa)||0, g.gestor||''
  ]);
  const uf = h.getLastRow();
  const cl = {pagado:'#1a3a2a',promesa:'#3a2a0a',no_contesta:'#1a1a2a',
               mensaje_enviado:'#0a1a3a',rechaza_pago:'#3a0a0a',ilocalizable:'#2a0a3a'};
  if (cl[g.estado]) h.getRange(uf,1,1,9).setBackground(cl[g.estado]).setFontColor('#e2e8f0');
  if (parseFloat(g.montoPagado)  > 0) h.getRange(uf,7).setNumberFormat('#,##0.00');
  if (parseFloat(g.montoPromesa) > 0) h.getRange(uf,8).setNumberFormat('#,##0.00');
  return {success:true, message:'OK'};
}

// ── RANKING ───────────────────────────────────────────────────
function getRanking(fi, fn) {
  if (!fi || !fn) {
    const hoy=new Date(), y=hoy.getFullYear(), m=hoy.getMonth(), d=hoy.getDate(), dc=8;
    fi = d<=dc ? Utilities.formatDate(new Date(y,m-1,dc+1),'America/Tegucigalpa','yyyy-MM-dd')
               : Utilities.formatDate(new Date(y,m,dc+1),'America/Tegucigalpa','yyyy-MM-dd');
    fn = d<=dc ? Utilities.formatDate(new Date(y,m,dc),'America/Tegucigalpa','yyyy-MM-dd')
               : Utilities.formatDate(new Date(y,m+1,dc),'America/Tegucigalpa','yyyy-MM-dd');
  }
  const g = getGestiones(fi, fn).data;
  const rank = {};
  g.forEach(x => {
    if (!x.gestor) return;
    if (!rank[x.gestor]) rank[x.gestor] = {nombre:x.gestor, gestiones:0, pagos:0, cobrado:0, promesas:0};
    rank[x.gestor].gestiones++;
    if (x.estado==='pagado')  { rank[x.gestor].pagos++; rank[x.gestor].cobrado += x.montoPagado||0; }
    if (x.estado==='promesa')   rank[x.gestor].promesas++;
  });
  const r = Object.values(rank).sort((a,b) => b.cobrado - a.cobrado);
  r.forEach((x,i) => { x.posicion = i+1; x.efectividad = x.gestiones>0?((x.pagos/x.gestiones)*100).toFixed(1):'0.0'; });
  return {success:true, data:r};
}

// ── DASHBOARD ─────────────────────────────────────────────────
function getDashboard() {
  const p   = getPrestamos().data;
  const hoy = new Date();
  const y=hoy.getFullYear(), m=hoy.getMonth(), d=hoy.getDate(), dc=8;
  const is = d<=dc ? Utilities.formatDate(new Date(y,m-1,dc+1),'America/Tegucigalpa','yyyy-MM-dd')
                   : Utilities.formatDate(new Date(y,m,dc+1),'America/Tegucigalpa','yyyy-MM-dd');
  const fs = d<=dc ? Utilities.formatDate(new Date(y,m,dc),'America/Tegucigalpa','yyyy-MM-dd')
                   : Utilities.formatDate(new Date(y,m+1,dc),'America/Tegucigalpa','yyyy-MM-dd');
  const hs = Utilities.formatDate(hoy,'America/Tegucigalpa','yyyy-MM-dd');

  const pa = getPagos(is, fs).data;
  const gH = getGestiones(hs, hs).data;
  const gC = getGestiones(is, fs).data;

  const tc = p.reduce((s,x)=>s+x.balance,0);
  const tq = p.reduce((s,x)=>s+x.balanceCuotas,0);
  const tr = pa.reduce((s,x)=>s+x.valor,0);
  const cu = [...new Set(p.map(x=>x.cliente))];
  const co = [...new Set(gH.map(x=>x.cliente))];
  const eH = {}; gH.forEach(g => { eH[g.estado]=(eH[g.estado]||0)+1; });

  // Cobro diario 14 días
  const cdMap = {}; pa.forEach(pg => { cdMap[pg.fecha]=(cdMap[pg.fecha]||0)+pg.valor; });
  const cobroDiario = [];
  for (let i=13; i>=0; i--) {
    const dt=new Date(hoy); dt.setDate(dt.getDate()-i);
    const ds=Utilities.formatDate(dt,'America/Tegucigalpa','yyyy-MM-dd');
    cobroDiario.push({fecha:ds, monto:cdMap[ds]||0});
  }

  // Mora por antigüedad
  const mora = {al_dia:0, un_mes:0, dos_meses:0, tres_meses:0, mas_tres:0};
  p.forEach(pr => {
    if (!pr.fecha) { mora.al_dia++; return; }
    const dias = Math.floor((hoy - new Date(pr.fecha)) / 864e5);
    if      (dias < 30)  mora.al_dia++;
    else if (dias < 60)  mora.un_mes++;
    else if (dias < 90)  mora.dos_meses++;
    else if (dias < 180) mora.tres_meses++;
    else                 mora.mas_tres++;
  });

  // Métodos de pago
  const mpMap = {}; pa.forEach(pg => { const mp=pg.medioPago||'efectivo'; mpMap[mp]=(mpMap[mp]||0)+pg.valor; });

  // Análisis horario
  const hMap = {}; gH.filter(g=>g.estado==='pagado').forEach(g => {
    const hr=(g.hora||'00:00').split(':')[0]+'h'; hMap[hr]=(hMap[hr]||0)+1;
  });
  const mejorHora = Object.entries(hMap).sort((a,b)=>b[1]-a[1])[0];

  // Promesas vencidas
  const pv = gC.filter(g =>
    g.estado==='promesa' && g.fechaPromesa && g.fechaPromesa<=hs &&
    !gC.some(g2=>g2.cliente===g.cliente && g2.estado==='pagado' && g2.fecha>=g.fechaPromesa)
  );
  const fd   = d<=dc ? new Date(y,m,dc) : new Date(y,m+1,dc);
  const meta = getMeta().meta || tq;

  return {success:true, data:{
    ciclo:       {inicio:is, fin:fs, diasRestantes:Math.max(0,Math.ceil((fd-hoy)/864e5))},
    cartera:     {totalBalance:tc, totalCuotas:tq, clientesActivos:cu.length},
    recuperacion:{totalRecuperado:tr, cantidadPagos:pa.length, porcentaje:tq>0?(tr/tq*100).toFixed(2):0},
    gestionHoy:  {total:gH.length, contactados:co.length, porEstado:eH},
    promesasVencidas:pv.length, promesasDetalle:pv.slice(0,10),
    meta, cobroDiario, mora,
    desglose:   {capital:pa.reduce((s,x)=>s+(x.capital||0),0), intereses:pa.reduce((s,x)=>s+(x.intereses||0),0)},
    medioPago:   mpMap,
    mejorHora:   mejorHora ? {hora:mejorHora[0], cobros:mejorHora[1]} : null,
    rankingHoy:  getRanking(hs,hs).data
  }};
}

// ── UTILS ─────────────────────────────────────────────────────
function ff(f) {
  if (!f) return '';
  if (f instanceof Date) return Utilities.formatDate(f,'America/Tegucigalpa','yyyy-MM-dd');
  return String(f).substring(0,10);
}

function crearHoja(ss) {
  const h = ss.insertSheet(HOJA_GESTIONES);
  h.appendRow(['Fecha','Hora','Cliente','Estado','Comentario','Fecha Promesa','Monto Pagado','Monto Promesa','Gestor']);
  h.getRange(1,1,1,9).setFontWeight('bold').setBackground('#0f172a').setFontColor('#fff');
  [120,100,250,150,300,120,130,130,120].forEach((w,i) => h.setColumnWidth(i+1, w));
  h.setFrozenRows(1);
  return h;
}

// ── MENU ──────────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi().createMenu('📋 Cobros Pro')
    .addItem('📊 Resumen del Día',       'mostrarResumen')
    .addSeparator()
    .addItem('🔄 Crear Hoja Gestiones',  'menuCrearGestiones')
    .addItem('👥 Crear Hoja Usuarios',   'menuCrearUsuarios')
    .addItem('⚙️ Crear Hoja Config',     'menuCrearConfig')
    .addToUi();
}
function menuCrearGestiones(){const ss=SpreadsheetApp.getActiveSpreadsheet();if(ss.getSheetByName(HOJA_GESTIONES)){SpreadsheetApp.getUi().alert('Ya existe.');return;}crearHoja(ss);SpreadsheetApp.getUi().alert('✅ Hoja Gestiones creada.');}
function menuCrearUsuarios(){const ss=SpreadsheetApp.getActiveSpreadsheet();if(ss.getSheetByName(HOJA_USUARIOS)){SpreadsheetApp.getUi().alert('Ya existe.');return;}crearHojaUsuarios(ss);SpreadsheetApp.getUi().alert('✅ Hoja Usuarios creada.\nAdmin: admin / 1234');}
function menuCrearConfig(){const ss=SpreadsheetApp.getActiveSpreadsheet();if(ss.getSheetByName(HOJA_CONFIG)){SpreadsheetApp.getUi().alert('Ya existe.');return;}const h=ss.insertSheet(HOJA_CONFIG);h.appendRow(['Clave','Valor']);h.appendRow(['meta_ciclo',50000]);h.getRange(1,1,1,2).setFontWeight('bold').setBackground('#0f172a').setFontColor('#fff');SpreadsheetApp.getUi().alert('✅ Config creada. Ajusta meta_ciclo según tu meta.');}
function mostrarResumen(){const d=getDashboard().data;const meta=d.meta||0,rec=d.recuperacion.totalRecuperado,pct=meta>0?(rec/meta*100).toFixed(1):d.recuperacion.porcentaje;SpreadsheetApp.getUi().alert('📊 RESUMEN\n\n💼 Cartera: L '+d.cartera.totalBalance.toLocaleString()+'\n📅 Cuotas: L '+d.cartera.totalCuotas.toLocaleString()+'\n🎯 Meta: L '+meta.toLocaleString()+'\n💰 Recuperado: L '+rec.toLocaleString()+' ('+pct+'%)\n📞 Gestiones hoy: '+d.gestionHoy.total+'\n📆 Días cierre: '+d.ciclo.diasRestantes+'\n⚠️ Promesas vencidas: '+d.promesasVencidas);}
