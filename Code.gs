// ================================================================
// COBROS APP - BACKEND (Google Apps Script)
// ================================================================
// INSTRUCCIONES:
// 1. Abrí tu Google Sheet con las hojas Prestamos y Pagos
// 2. Ir a Extensiones > Apps Script
// 3. Pegar todo este código
// 4. Implementar > Nueva implementación > Aplicación web
// 5. Ejecutar como: Yo | Acceso: Cualquier persona
// 6. Copiar URL y pegar en js/config.js
// ================================================================

const HOJA_PRESTAMOS = 'Prestamos';
const HOJA_PAGOS = 'Pagos';
const HOJA_GESTIONES = 'Gestiones';

// ── GET (consultas) ──
function doGet(e) {
  const action = e.parameter.action;
  if (!action) return HtmlService.createHtmlOutput('API Cobros v1.0 - Activa');
  try {
    let r;
    switch(action) {
      case 'getPrestamos': r = getPrestamos(); break;
      case 'getPagos': r = getPagos(e.parameter.fechaInicio, e.parameter.fechaFin); break;
      case 'getGestiones': r = getGestiones(e.parameter.fechaInicio, e.parameter.fechaFin); break;
      case 'getDashboard': r = getDashboard(); break;
      default: r = { error: 'Acción no válida' };
    }
    return json(r);
  } catch(err) { return json({ error: err.message }); }
}

// ── POST (guardar) ──
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    switch(data.action) {
      case 'guardarGestion': return json(guardarGestion(data.gestion));
      default: return json({ error: 'Acción no válida' });
    }
  } catch(err) { return json({ error: err.message }); }
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// ── PRÉSTAMOS ──
// Filtra automáticamente: si Balance (col F) + Balance Cuotas (col G) < 5, no lo muestra
function getPrestamos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(HOJA_PRESTAMOS);
  const datos = hoja.getDataRange().getValues();
  const prestamos = [];
  for (let i = 1; i < datos.length; i++) {
    const f = datos[i];
    const balance = parseFloat(f[5]) || 0;       // Col F
    const balanceCuotas = parseFloat(f[6]) || 0;  // Col G
    if ((balance + balanceCuotas) < 5) continue;  // FILTRO CANCELADOS
    prestamos.push({
      id: f[0],
      cliente: String(f[1]).trim(),
      tipo: f[2],
      fecha: fmtF(f[3]),
      capital: parseFloat(f[4]) || 0,
      balance: balance,
      balanceCuotas: balanceCuotas,
      diaPago: String(f[7]).trim(),
      cartera: f[8]
    });
  }
  return { success: true, data: prestamos, total: prestamos.length };
}

// ── PAGOS ──
function getPagos(fechaInicio, fechaFin) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(HOJA_PAGOS);
  const datos = hoja.getDataRange().getValues();
  const pagos = [];
  for (let i = 1; i < datos.length; i++) {
    const f = datos[i];
    const fecha = fmtF(f[4]); // Col E: Fecha
    if (fechaInicio && fecha < fechaInicio) continue;
    if (fechaFin && fecha > fechaFin) continue;
    pagos.push({
      id: f[0],
      cliente: String(f[1]).trim(),
      tipo: f[2],
      valor: parseFloat(f[3]) || 0,
      fecha: fecha,
      registrado: fmtFH(f[5]),
      caja: f[6],
      cartera: f[7],
      usuario: f[8]
    });
  }
  return { success: true, data: pagos, total: pagos.length };
}

// ── GESTIONES ──
function getGestiones(fechaInicio, fechaFin) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(HOJA_GESTIONES);
  if (!hoja) { crearHojaGestiones(ss); return { success: true, data: [], total: 0 }; }
  const datos = hoja.getDataRange().getValues();
  const gestiones = [];
  for (let i = 1; i < datos.length; i++) {
    const f = datos[i];
    if (!f[0]) continue;
    const fecha = fmtF(f[0]);
    if (fechaInicio && fecha < fechaInicio) continue;
    if (fechaFin && fecha > fechaFin) continue;
    gestiones.push({
      fecha: fecha,
      hora: String(f[1]),
      cliente: String(f[2]).trim(),
      estado: f[3],
      comentario: f[4] || '',
      fechaPromesa: fmtF(f[5]),
      montoPagado: parseFloat(f[6]) || 0,
      montoPromesa: parseFloat(f[7]) || 0,
      gestor: f[8] || ''
    });
  }
  return { success: true, data: gestiones, total: gestiones.length };
}

// ── GUARDAR GESTIÓN ──
function guardarGestion(g) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(HOJA_GESTIONES);
  if (!hoja) hoja = crearHojaGestiones(ss);
  const ahora = new Date();
  const fila = [
    g.fecha || Utilities.formatDate(ahora, 'America/Tegucigalpa', 'yyyy-MM-dd'),
    g.hora || Utilities.formatDate(ahora, 'America/Tegucigalpa', 'HH:mm:ss'),
    g.cliente,
    g.estado,
    g.comentario || '',
    g.fechaPromesa || '',
    parseFloat(g.montoPagado) || 0,
    parseFloat(g.montoPromesa) || 0,
    g.gestor || 'Gestor 1'
  ];
  hoja.appendRow(fila);

  // Colorear según estado
  const colores = {
    'pagado': '#dcfce7',
    'promesa': '#fef3c7',
    'no_contesta': '#f3f4f6',
    'mensaje_enviado': '#dbeafe',
    'rechaza_pago': '#fee2e2',
    'ilocalizable': '#ede9fe'
  };
  const uf = hoja.getLastRow();
  if (colores[g.estado]) {
    hoja.getRange(uf, 1, 1, 9).setBackground(colores[g.estado]);
  }
  if (parseFloat(g.montoPagado) > 0) hoja.getRange(uf, 7).setNumberFormat('#,##0.00');
  if (parseFloat(g.montoPromesa) > 0) hoja.getRange(uf, 8).setNumberFormat('#,##0.00');
  return { success: true, message: 'Gestión guardada correctamente' };
}

// ── DASHBOARD ──
function getDashboard() {
  const prestamos = getPrestamos().data;
  const hoy = new Date();
  const y = hoy.getFullYear(), m = hoy.getMonth(), d = hoy.getDate();
  const dc = 8; // día de cierre

  const inicioStr = d <= dc
    ? Utilities.formatDate(new Date(y, m-1, dc+1), 'America/Tegucigalpa', 'yyyy-MM-dd')
    : Utilities.formatDate(new Date(y, m, dc+1), 'America/Tegucigalpa', 'yyyy-MM-dd');
  const finStr = d <= dc
    ? Utilities.formatDate(new Date(y, m, dc), 'America/Tegucigalpa', 'yyyy-MM-dd')
    : Utilities.formatDate(new Date(y, m+1, dc), 'America/Tegucigalpa', 'yyyy-MM-dd');
  const hoyStr = Utilities.formatDate(hoy, 'America/Tegucigalpa', 'yyyy-MM-dd');

  const pagos = getPagos(inicioStr, finStr).data;
  const gHoy = getGestiones(hoyStr, hoyStr).data;
  const gCiclo = getGestiones(inicioStr, finStr).data;

  const totalCartera = prestamos.reduce((s,p) => s + p.balance, 0);
  const totalCuotas = prestamos.reduce((s,p) => s + p.balanceCuotas, 0);
  const totalRecup = pagos.reduce((s,p) => s + p.valor, 0);
  const clientes = [...new Set(prestamos.map(p => p.cliente))];
  const contactados = [...new Set(gHoy.map(g => g.cliente))];

  const estadosHoy = {};
  gHoy.forEach(g => { estadosHoy[g.estado] = (estadosHoy[g.estado]||0) + 1; });

  const promVenc = gCiclo.filter(g =>
    g.estado === 'promesa' && g.fechaPromesa && g.fechaPromesa <= hoyStr &&
    !gCiclo.some(g2 => g2.cliente === g.cliente && g2.estado === 'pagado' && g2.fecha >= g.fechaPromesa)
  );

  const finDate = d <= dc ? new Date(y,m,dc) : new Date(y,m+1,dc);

  return {
    success: true,
    data: {
      ciclo: { inicio: inicioStr, fin: finStr, diasRestantes: Math.max(0, Math.ceil((finDate-hoy)/86400000)) },
      cartera: { totalBalance: totalCartera, totalCuotas: totalCuotas, clientesActivos: clientes.length },
      recuperacion: { totalRecuperado: totalRecup, cantidadPagos: pagos.length, porcentaje: totalCuotas > 0 ? (totalRecup/totalCuotas*100).toFixed(2) : 0 },
      gestionHoy: { total: gHoy.length, contactados: contactados.length, porEstado: estadosHoy },
      promesasVencidas: promVenc.length,
      promesasDetalle: promVenc.slice(0,10)
    }
  };
}

// ── UTILIDADES ──
function fmtF(f) {
  if (!f) return '';
  if (f instanceof Date) return Utilities.formatDate(f, 'America/Tegucigalpa', 'yyyy-MM-dd');
  return String(f).substring(0,10);
}
function fmtFH(f) {
  if (!f) return '';
  if (f instanceof Date) return Utilities.formatDate(f, 'America/Tegucigalpa', 'yyyy-MM-dd HH:mm:ss');
  return String(f);
}

function crearHojaGestiones(ss) {
  const h = ss.insertSheet(HOJA_GESTIONES);
  h.appendRow(['Fecha','Hora','Cliente','Estado','Comentario','Fecha Promesa','Monto Pagado','Monto Promesa','Gestor']);
  const r = h.getRange(1, 1, 1, 9);
  r.setFontWeight('bold');
  r.setBackground('#1e293b');
  r.setFontColor('#ffffff');
  h.setColumnWidth(1, 120);
  h.setColumnWidth(2, 100);
  h.setColumnWidth(3, 250);
  h.setColumnWidth(4, 150);
  h.setColumnWidth(5, 300);
  h.setColumnWidth(6, 120);
  h.setColumnWidth(7, 130);
  h.setColumnWidth(8, 130);
  h.setColumnWidth(9, 120);
  h.setFrozenRows(1);
  return h;
}

// ── MENÚ EN SHEETS ──
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📋 Cobros App')
    .addItem('📊 Ver Resumen del Día', 'mostrarResumen')
    .addItem('🔄 Crear Hoja Gestiones', 'menuCrearGestiones')
    .addToUi();
}

function menuCrearGestiones() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName(HOJA_GESTIONES)) {
    SpreadsheetApp.getUi().alert('La hoja "Gestiones" ya existe.');
    return;
  }
  crearHojaGestiones(ss);
  SpreadsheetApp.getUi().alert('✅ Hoja "Gestiones" creada exitosamente.');
}

function mostrarResumen() {
  const d = getDashboard().data;
  SpreadsheetApp.getUi().alert(
    '📊 RESUMEN DEL DÍA\n\n' +
    '💼 Cartera: L ' + d.cartera.totalBalance.toLocaleString() + '\n' +
    '📅 Cuotas Pendientes: L ' + d.cartera.totalCuotas.toLocaleString() + '\n' +
    '💰 Recuperado: L ' + d.recuperacion.totalRecuperado.toLocaleString() +
    ' (' + d.recuperacion.porcentaje + '%)\n' +
    '📞 Gestiones Hoy: ' + d.gestionHoy.total + '\n' +
    '👥 Contactados: ' + d.gestionHoy.contactados + '/' + d.cartera.clientesActivos + '\n' +
    '⚠️ Promesas Vencidas: ' + d.promesasVencidas + '\n' +
    '\n📆 Días para cierre: ' + d.ciclo.diasRestantes
  );
}
