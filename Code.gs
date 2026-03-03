// ================================================================
// COBROS PRO v3 - BACKEND (Google Apps Script)
// Hoja Gestiones: Fecha|Hora|Cliente|Estado|Comentario|FechaPromesa|MontoPagado|MontoPromesa|Gestor
// ================================================================
const HOJA_PRESTAMOS = 'Prestamos';
const HOJA_PAGOS = 'Pagos';
const HOJA_GESTIONES = 'Gestiones';

function doGet(e) {
  const a = e.parameter.action;
  if (!a) return HtmlService.createHtmlOutput('Cobros Pro API v3');
  try {
    let r;
    switch(a) {
      case 'getPrestamos': r=getPrestamos(); break;
      case 'getPagos': r=getPagos(e.parameter.fechaInicio,e.parameter.fechaFin); break;
      case 'getGestiones': r=getGestiones(e.parameter.fechaInicio,e.parameter.fechaFin); break;
      case 'getDashboard': r=getDashboard(); break;
      default: r={error:'Acción inválida'};
    }
    return json(r);
  } catch(err) { return json({error:err.message}); }
}

function doPost(e) {
  try {
    const d=JSON.parse(e.postData.contents);
    if(d.action==='guardarGestion') return json(guardarGestion(d.gestion));
    return json({error:'Acción inválida'});
  } catch(err) { return json({error:err.message}); }
}

function json(d){return ContentService.createTextOutput(JSON.stringify(d)).setMimeType(ContentService.MimeType.JSON)}

// ── PRÉSTAMOS (filtra Balance F + Cuotas G < 5) ──
function getPrestamos() {
  const h=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_PRESTAMOS);
  const d=h.getDataRange().getValues(),r=[];
  for(let i=1;i<d.length;i++){
    const f=d[i],bal=parseFloat(f[5])||0,bc=parseFloat(f[6])||0;
    if((bal+bc)<5) continue;
    r.push({id:f[0],cliente:String(f[1]).trim(),tipo:f[2],fecha:ff(f[3]),capital:parseFloat(f[4])||0,balance:bal,balanceCuotas:bc,diaPago:String(f[7]).trim(),cartera:f[8]});
  }
  return {success:true,data:r,total:r.length};
}

// ── PAGOS ──
function getPagos(fi,fn) {
  const h=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_PAGOS);
  const d=h.getDataRange().getValues(),r=[];
  for(let i=1;i<d.length;i++){
    const f=d[i],fe=ff(f[4]);
    if(fi&&fe<fi) continue; if(fn&&fe>fn) continue;
    r.push({id:f[0],cliente:String(f[1]).trim(),tipo:f[2],valor:parseFloat(f[3])||0,fecha:fe,caja:f[6],cartera:f[7],usuario:f[8]});
  }
  return {success:true,data:r,total:r.length};
}

// ── GESTIONES (9 columnas) ──
function getGestiones(fi,fn) {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  let h=ss.getSheetByName(HOJA_GESTIONES);
  if(!h){crearHoja(ss);return {success:true,data:[],total:0}}
  const d=h.getDataRange().getValues(),r=[];
  for(let i=1;i<d.length;i++){
    const f=d[i]; if(!f[0]) continue;
    const fe=ff(f[0]);
    if(fi&&fe<fi) continue; if(fn&&fe>fn) continue;
    r.push({fecha:fe,hora:String(f[1]),cliente:String(f[2]).trim(),estado:f[3],comentario:f[4]||'',fechaPromesa:ff(f[5]),montoPagado:parseFloat(f[6])||0,montoPromesa:parseFloat(f[7])||0,gestor:f[8]||''});
  }
  return {success:true,data:r,total:r.length};
}

// ── GUARDAR GESTIÓN ──
function guardarGestion(g) {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  let h=ss.getSheetByName(HOJA_GESTIONES);
  if(!h) h=crearHoja(ss);
  const a=new Date();
  h.appendRow([
    g.fecha||Utilities.formatDate(a,'America/Tegucigalpa','yyyy-MM-dd'),
    g.hora||Utilities.formatDate(a,'America/Tegucigalpa','HH:mm:ss'),
    g.cliente, g.estado, g.comentario||'', g.fechaPromesa||'',
    parseFloat(g.montoPagado)||0, parseFloat(g.montoPromesa)||0,
    g.gestor||''
  ]);
  const uf=h.getLastRow();
  const cl={'pagado':'#1a3a2a','promesa':'#3a2a0a','no_contesta':'#1a1a2a','mensaje_enviado':'#0a1a3a','rechaza_pago':'#3a0a0a','ilocalizable':'#2a0a3a'};
  if(cl[g.estado]) h.getRange(uf,1,1,9).setBackground(cl[g.estado]).setFontColor('#e2e8f0');
  if(parseFloat(g.montoPagado)>0) h.getRange(uf,7).setNumberFormat('#,##0.00');
  if(parseFloat(g.montoPromesa)>0) h.getRange(uf,8).setNumberFormat('#,##0.00');
  return {success:true,message:'OK'};
}

// ── DASHBOARD ──
function getDashboard() {
  const p=getPrestamos().data,hoy=new Date();
  const y=hoy.getFullYear(),m=hoy.getMonth(),d=hoy.getDate(),dc=8;
  const is=d<=dc?Utilities.formatDate(new Date(y,m-1,dc+1),'America/Tegucigalpa','yyyy-MM-dd'):Utilities.formatDate(new Date(y,m,dc+1),'America/Tegucigalpa','yyyy-MM-dd');
  const fs=d<=dc?Utilities.formatDate(new Date(y,m,dc),'America/Tegucigalpa','yyyy-MM-dd'):Utilities.formatDate(new Date(y,m+1,dc),'America/Tegucigalpa','yyyy-MM-dd');
  const hs=Utilities.formatDate(hoy,'America/Tegucigalpa','yyyy-MM-dd');
  const pa=getPagos(is,fs).data,gH=getGestiones(hs,hs).data,gC=getGestiones(is,fs).data;
  const tc=p.reduce((s,x)=>s+x.balance,0),tq=p.reduce((s,x)=>s+x.balanceCuotas,0),tr=pa.reduce((s,x)=>s+x.valor,0);
  const cu=[...new Set(p.map(x=>x.cliente))],co=[...new Set(gH.map(x=>x.cliente))];
  const eH={};gH.forEach(g=>{eH[g.estado]=(eH[g.estado]||0)+1});
  const pv=gC.filter(g=>g.estado==='promesa'&&g.fechaPromesa&&g.fechaPromesa<=hs&&!gC.some(g2=>g2.cliente===g.cliente&&g2.estado==='pagado'&&g2.fecha>=g.fechaPromesa));
  const fd=d<=dc?new Date(y,m,dc):new Date(y,m+1,dc);
  return {success:true,data:{ciclo:{inicio:is,fin:fs,diasRestantes:Math.max(0,Math.ceil((fd-hoy)/864e5))},cartera:{totalBalance:tc,totalCuotas:tq,clientesActivos:cu.length},recuperacion:{totalRecuperado:tr,cantidadPagos:pa.length,porcentaje:tq>0?(tr/tq*100).toFixed(2):0},gestionHoy:{total:gH.length,contactados:co.length,porEstado:eH},promesasVencidas:pv.length,promesasDetalle:pv.slice(0,10)}};
}

// ── UTILS ──
function ff(f){if(!f)return'';if(f instanceof Date)return Utilities.formatDate(f,'America/Tegucigalpa','yyyy-MM-dd');return String(f).substring(0,10)}

function crearHoja(ss) {
  const h=ss.insertSheet(HOJA_GESTIONES);
  h.appendRow(['Fecha','Hora','Cliente','Estado','Comentario','Fecha Promesa','Monto Pagado','Monto Promesa','Gestor']);
  h.getRange(1,1,1,9).setFontWeight('bold').setBackground('#0f172a').setFontColor('#fff');
  [120,100,250,150,300,120,130,130,120].forEach((w,i)=>h.setColumnWidth(i+1,w));
  h.setFrozenRows(1);
  return h;
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('📋 Cobros Pro')
    .addItem('📊 Resumen','mostrarResumen')
    .addItem('🔄 Crear Hoja Gestiones','menuCrear')
    .addToUi();
}
function menuCrear(){const ss=SpreadsheetApp.getActiveSpreadsheet();if(ss.getSheetByName(HOJA_GESTIONES)){SpreadsheetApp.getUi().alert('Ya existe');return}crearHoja(ss);SpreadsheetApp.getUi().alert('Creada')}
function mostrarResumen(){const d=getDashboard().data;SpreadsheetApp.getUi().alert('📊 RESUMEN\n\n💼 Cartera: L '+d.cartera.totalBalance.toLocaleString()+'\n📅 Cuotas: L '+d.cartera.totalCuotas.toLocaleString()+'\n💰 Recuperado: L '+d.recuperacion.totalRecuperado.toLocaleString()+'\n📞 Gestiones: '+d.gestionHoy.total+'\n📆 Días: '+d.ciclo.diasRestantes)}
