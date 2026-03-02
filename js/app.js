// ============================================
// APP.JS - Lógica Principal
// ============================================

// --- Estado global ---
let DATOS = {
  prestamos: [],
  pagos: [],
  gestiones: [],
  dashboard: null,
};

let estadoSeleccionado = '';
let clienteActual = null;

// --- Utilidades ---
const hoy = new Date();
const hoyStr = hoy.toISOString().split('T')[0];

function formatL(n) {
  return 'L ' + Number(n || 0).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getDiaSemanaHoy() {
  return ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'][hoy.getDay()];
}

function getDiaMesHoy() {
  return hoy.getDate();
}

function getCiclo() {
  const y = hoy.getFullYear(), m = hoy.getMonth(), d = hoy.getDate();
  const dc = CONFIG.DIA_CIERRE;
  const inicio = d <= dc ? new Date(y, m - 1, dc + 1) : new Date(y, m, dc + 1);
  const fin = d <= dc ? new Date(y, m, dc) : new Date(y, m + 1, dc);
  const dias = Math.max(0, Math.ceil((fin - hoy) / 86400000));
  return { inicio, fin, dias };
}

function getEstadoInfo(estado) {
  return CONFIG.ESTADOS.find(e => e.value === estado) || CONFIG.ESTADOS[6]; // pendiente
}

function getBorderClass(estado) {
  const map = { pagado: 'border-green', promesa: 'border-yellow', rechaza_pago: 'border-red', mensaje_enviado: 'border-blue', ilocalizable: 'border-purple', no_contesta: 'border-gray', pendiente: 'border-gray' };
  return map[estado] || 'border-gray';
}

function getUltimaGestion(cliente) {
  return DATOS.gestiones
    .filter(g => g.cliente === cliente)
    .sort((a, b) => `${b.fecha}${b.hora}`.localeCompare(`${a.fecha}${a.hora}`))[0];
}

function agruparPorCliente(prestamos) {
  const map = {};
  prestamos.forEach(p => {
    if (!map[p.cliente]) {
      map[p.cliente] = {
        cliente: p.cliente,
        telefono: p.telefono || '',
        cartera: p.cartera,
        diaPago: p.diaPago,
        prestamos: [],
        totalBal: 0,
        totalCuo: 0,
      };
    }
    map[p.cliente].prestamos.push(p);
    map[p.cliente].totalBal += p.balance;
    map[p.cliente].totalCuo += p.balanceCuotas;
  });
  return Object.values(map);
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 3000);
}

function showLoading(show) {
  document.getElementById('loading').style.display = show ? 'flex' : 'none';
}

// --- Sidebar & Navigation ---
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebar-overlay');
  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    sb.classList.toggle('open');
    ov.classList.toggle('show');
  } else {
    sb.classList.toggle('collapsed');
  }
}

function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
  
  document.getElementById('tab-' + tab).classList.add('active');
  document.querySelector(`.menu-item[data-tab="${tab}"]`).classList.add('active');

  // Cerrar sidebar en mobile
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('show');
  }

  // Renderizar contenido del tab
  switch(tab) {
    case 'dashboard': renderDashboard(); break;
    case 'cartera': renderCartera(); break;
    case 'hoy': renderGestionHoy(); break;
    case 'historial': renderHistorial(); break;
    case 'pagos': renderPagos(); break;
  }
}

// ============================================
// CARGA DE DATOS
// ============================================
async function cargarTodosDatos() {
  showLoading(true);
  
  try {
    // Intentar cargar desde API
    const [prestRes, pagosRes, gestRes] = await Promise.all([
      API.getPrestamos(),
      API.getPagos(),
      API.getGestiones(),
    ]);

    DATOS.prestamos = prestRes.data || [];
    DATOS.pagos = pagosRes.data || [];
    DATOS.gestiones = gestRes.data || [];
    
    showToast('✅ Datos cargados correctamente', 'success');
  } catch (err) {
    console.warn('No se pudo conectar con la API, usando datos de ejemplo:', err);
    cargarDatosEjemplo();
    showToast('⚠️ Usando datos de ejemplo - Configurá la URL en config.js', 'error');
  }

  showLoading(false);
  
  // Renderizar tab actual
  const activeTab = document.querySelector('.menu-item.active')?.dataset.tab || 'dashboard';
  switchTab(activeTab);
}

function cargarDatosEjemplo() {
  DATOS.prestamos = [
    { id:5, cliente:"Carmen Dalila Vasquez Ferrera", tipo:"PREST. MENSUAL", fecha:"2025-03-12", capital:15264, balance:13662.69, balanceCuotas:728.70, diaPago:"Día 17", cartera:"Zona 3" },
    { id:9, cliente:"Gladys Carolina Castillo Ramirez", tipo:"PREST. QUINCENAL", fecha:"2025-03-12", capital:6000, balance:6000, balanceCuotas:600, diaPago:"Día 15", cartera:"Zona 3" },
    { id:13, cliente:"Angelica Patricia Pineda Carbajal", tipo:"PREST. QUINCENAL", fecha:"2025-03-12", capital:12000, balance:12000, balanceCuotas:2840, diaPago:"Día 15", cartera:"Zona 3" },
    { id:15, cliente:"Daisy Rivera Valladares", tipo:"PREST. SEMANAL", fecha:"2025-03-12", capital:13400, balance:8500, balanceCuotas:1200, diaPago:"Día lunes", cartera:"Zona 3" },
    { id:19, cliente:"Keylin Roxana Mejia Garcia", tipo:"PREST. QUINCENAL", fecha:"2025-03-12", capital:12598, balance:12598, balanceCuotas:5292.43, diaPago:"Día 15", cartera:"Zona 3" },
    { id:24, cliente:"Mauricio Zamora Perdomo", tipo:"PREST. SEMANAL", fecha:"2025-03-12", capital:7958, balance:4200, balanceCuotas:850, diaPago:"Día miércoles", cartera:"Zona 3" },
    { id:25, cliente:"Mirian Maritza Flores Aguilar", tipo:"PREST. SEMANAL", fecha:"2025-03-12", capital:3500, balance:1800, balanceCuotas:400, diaPago:"Día miércoles", cartera:"Zona 3" },
    { id:26, cliente:"Olvin Enrique Castro Ortega", tipo:"PREST. SEMANAL", fecha:"2025-03-12", capital:5822, balance:4443.16, balanceCuotas:476.10, diaPago:"Día lunes", cartera:"Zona 3" },
    { id:28, cliente:"Suyapa Yadira Cardona Marquez", tipo:"PREST. QUINCENAL", fecha:"2025-03-12", capital:10000, balance:7500, balanceCuotas:1500, diaPago:"Día 15", cartera:"Zona 3" },
    { id:29, cliente:"Mario Emmanuel Lopez Ortez", tipo:"PREST. SEMANAL", fecha:"2025-03-12", capital:4500, balance:3200, balanceCuotas:520, diaPago:"Día martes", cartera:"Zona 3" },
    { id:30, cliente:"Delmy Cristina Gutierrez Caceres", tipo:"PREST. SEMANAL", fecha:"2025-03-12", capital:8000, balance:5600, balanceCuotas:1100, diaPago:"Día jueves", cartera:"Zona 3" },
  ];

  DATOS.pagos = [
    { id:1, cliente:"Carmen Dalila Vasquez Ferrera", tipo:"PREST. MENSUAL", valor:728.70, fecha:"2026-02-10", caja:"Bac", cartera:"Zona 3" },
    { id:2, cliente:"Gladys Carolina Castillo Ramirez", tipo:"PREST. QUINCENAL", valor:600, fecha:"2026-02-11", caja:"Bac", cartera:"Zona 3" },
    { id:3, cliente:"Angelica Patricia Pineda Carbajal", tipo:"PREST. QUINCENAL", valor:2840, fecha:"2026-02-12", caja:"Ficohsa", cartera:"Zona 3" },
    { id:4, cliente:"Keylin Roxana Mejia Garcia", tipo:"PREST. QUINCENAL", valor:5292.43, fecha:"2026-02-12", caja:"Banpais", cartera:"Zona 3" },
    { id:5, cliente:"Daisy Rivera Valladares", tipo:"PREST. SEMANAL", valor:1200, fecha:"2026-02-24", caja:"Bac", cartera:"Zona 3" },
    { id:6, cliente:"Olvin Enrique Castro Ortega", tipo:"PREST. SEMANAL", valor:476.10, fecha:"2026-02-24", caja:"Ficohsa", cartera:"Zona 3" },
    { id:7, cliente:"Mauricio Zamora Perdomo", tipo:"PREST. SEMANAL", valor:850, fecha:"2026-02-26", caja:"Bac", cartera:"Zona 3" },
  ];

  DATOS.gestiones = [
    { cliente:"Carmen Dalila Vasquez Ferrera", estado:"promesa", comentario:"Dice que paga el viernes", fechaPromesa:"2026-02-28", fecha:"2026-02-25", hora:"10:30:00", gestor:"Gestor 1" },
    { cliente:"Gladys Carolina Castillo Ramirez", estado:"mensaje_enviado", comentario:"Recordatorio WhatsApp", fechaPromesa:"", fecha:hoyStr, hora:"08:15:00", gestor:"Gestor 1" },
    { cliente:"Angelica Patricia Pineda Carbajal", estado:"pagado", comentario:"Pagó cuota en Ficohsa", fechaPromesa:"", fecha:hoyStr, hora:"09:45:00", gestor:"Gestor 1" },
    { cliente:"Keylin Roxana Mejia Garcia", estado:"no_contesta", comentario:"3 intentos de llamada", fechaPromesa:"", fecha:hoyStr, hora:"10:00:00", gestor:"Gestor 1" },
  ];
}

// ============================================
// DASHBOARD
// ============================================
function renderDashboard() {
  const activos = DATOS.prestamos.filter(p => (p.balance + p.balanceCuotas) >= CONFIG.MIN_BALANCE_ACTIVO);
  const ciclo = getCiclo();
  const totalCartera = activos.reduce((s, p) => s + p.balance, 0);
  const totalCuotas = activos.reduce((s, p) => s + p.balanceCuotas, 0);
  const totalRecup = DATOS.pagos.reduce((s, p) => s + p.valor, 0);
  const clientesU = [...new Set(activos.map(p => p.cliente))];
  const gHoy = DATOS.gestiones.filter(g => g.fecha === hoyStr);
  const contactados = [...new Set(gHoy.map(g => g.cliente))];
  const pagadosHoy = gHoy.filter(g => g.estado === 'pagado').length;

  // Info ciclo
  document.getElementById('ciclo-info').textContent = 
    `Ciclo: ${ciclo.inicio.toLocaleDateString('es-HN')} - ${ciclo.fin.toLocaleDateString('es-HN')}`;
  
  const dc = document.getElementById('dias-cierre');
  dc.textContent = `${ciclo.dias} días para cierre`;
  dc.className = 'badge-cierre ' + (ciclo.dias <= 3 ? 'danger' : ciclo.dias <= 7 ? 'warning' : 'normal');

  // Stats
  document.getElementById('stat-cartera').textContent = formatL(totalCartera);
  document.getElementById('stat-clientes').textContent = `${clientesU.length} clientes activos`;
  document.getElementById('stat-cuotas').textContent = formatL(totalCuotas);
  document.getElementById('stat-recuperado').textContent = formatL(totalRecup);
  document.getElementById('stat-pagos-count').textContent = `${DATOS.pagos.length} pagos`;
  document.getElementById('stat-gestiones').textContent = gHoy.length;
  document.getElementById('stat-contactados').textContent = `${contactados.length}/${clientesU.length} contactados`;

  // Progress bars
  const pbContainer = document.getElementById('progress-bars');
  pbContainer.innerHTML = '';
  const bars = [
    { label: 'Clientes Contactados Hoy', value: contactados.length, max: clientesU.length, color: '#3b82f6' },
    { label: 'Recuperado vs Pendiente', value: totalRecup, max: totalCuotas, color: '#16a34a' },
    { label: 'Efectividad de Cobro Hoy', value: pagadosHoy, max: gHoy.length || 1, color: '#8b5cf6' },
  ];
  bars.forEach(b => {
    const pct = b.max > 0 ? Math.min((b.value / b.max) * 100, 100) : 0;
    pbContainer.innerHTML += `
      <div class="progress-item">
        <div class="progress-header">
          <span class="progress-label">${b.label}</span>
          <span class="progress-pct">${pct.toFixed(1)}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${pct}%;background:${b.color}"></div>
        </div>
      </div>`;
  });

  // Estados hoy
  const estContainer = document.getElementById('estados-hoy');
  estContainer.innerHTML = '';
  CONFIG.ESTADOS.forEach(e => {
    const count = gHoy.filter(g => g.estado === e.value).length;
    estContainer.innerHTML += `
      <div class="estado-row">
        <div class="estado-left"><span>${e.icon}</span><span>${e.label}</span></div>
        <span class="estado-badge" style="background:${e.bg};color:${e.color}">${count}</span>
      </div>`;
  });

  // Promesas vencidas
  const promVenc = DATOS.gestiones.filter(g =>
    g.estado === 'promesa' && g.fechaPromesa && g.fechaPromesa <= hoyStr &&
    !DATOS.gestiones.some(g2 => g2.cliente === g.cliente && g2.estado === 'pagado' && g2.fecha >= g.fechaPromesa)
  );

  const pvContainer = document.getElementById('promesas-vencidas-container');
  if (promVenc.length > 0) {
    pvContainer.style.display = 'block';
    document.getElementById('promesas-count').textContent = promVenc.length;
    document.getElementById('promesas-lista').innerHTML = promVenc.slice(0, 8).map(g => `
      <div class="promesa-item">
        <span class="promesa-nombre">${g.cliente}</span>
        <span class="promesa-fecha">Prometió: ${g.fechaPromesa}</span>
      </div>`).join('');
  } else {
    pvContainer.style.display = 'none';
  }
}

// ============================================
// CARTERA
// ============================================
function renderCartera() {
  // Populate día del mes filter
  const dmSelect = document.getElementById('filtro-dia-mes');
  if (dmSelect.options.length <= 1) {
    for (let i = 1; i <= 31; i++) {
      dmSelect.innerHTML += `<option value="${i}">Día ${i}</option>`;
    }
  }
  filtrarCartera();
}

function filtrarCartera() {
  const fTexto = document.getElementById('filtro-texto').value.toLowerCase();
  const fDS = document.getElementById('filtro-dia-semana').value;
  const fDM = document.getElementById('filtro-dia-mes').value;
  const fEst = document.getElementById('filtro-estado').value;
  const fOrd = document.getElementById('filtro-orden').value;

  const activos = DATOS.prestamos.filter(p => (p.balance + p.balanceCuotas) >= CONFIG.MIN_BALANCE_ACTIVO);
  let clientes = agruparPorCliente(activos);

  // Filtros
  if (fTexto) clientes = clientes.filter(c => c.cliente.toLowerCase().includes(fTexto));
  if (fDS) {
    // Limpiar el otro filtro
    document.getElementById('filtro-dia-mes').value = '';
    clientes = clientes.filter(c => c.diaPago.toLowerCase().includes(fDS));
  }
  if (fDM) {
    document.getElementById('filtro-dia-semana').value = '';
    clientes = clientes.filter(c => {
      const m = c.diaPago.match(/Día (\d+)/);
      return m && parseInt(m[1]) === parseInt(fDM);
    });
  }
  if (fEst) {
    clientes = clientes.filter(c => {
      const ug = getUltimaGestion(c.cliente);
      if (fEst === 'pendiente') return !ug;
      return ug && ug.estado === fEst;
    });
  }

  // Ordenar
  switch(fOrd) {
    case 'balance_desc': clientes.sort((a, b) => b.totalBal - a.totalBal); break;
    case 'balance_asc': clientes.sort((a, b) => a.totalBal - b.totalBal); break;
    case 'cuotas_desc': clientes.sort((a, b) => b.totalCuo - a.totalCuo); break;
    case 'nombre': clientes.sort((a, b) => a.cliente.localeCompare(b.cliente)); break;
  }

  document.getElementById('cartera-count').textContent = `${clientes.length} clientes activos (Balance + Cuotas ≥ L5)`;

  const container = document.getElementById('cartera-lista');
  container.innerHTML = clientes.map(c => {
    const ug = getUltimaGestion(c.cliente);
    const est = ug ? getEstadoInfo(ug.estado) : getEstadoInfo('pendiente');
    const tel = c.telefono ? c.telefono.replace(/-/g, '') : '';

    return `
      <div class="list-item ${getBorderClass(ug?.estado || 'pendiente')}">
        <div class="item-info">
          <div class="item-name">${c.cliente}</div>
          <div class="item-detail">${c.diaPago} · ${c.cartera} · ${c.prestamos.length} prést.</div>
        </div>
        <div class="item-amount">
          <div class="item-balance">${formatL(c.totalBal)}</div>
          <div class="item-cuota">Cuota: ${formatL(c.totalCuo)}</div>
        </div>
        <span class="item-badge" style="background:${est.bg};color:${est.color}">${est.icon} ${est.label}</span>
        <div class="item-actions">
          <button class="btn-gestionar" onclick='abrirModal(${JSON.stringify(c).replace(/'/g, "\\'")})'>Gestionar</button>
          ${tel ? `<a class="btn-whatsapp" href="https://wa.me/504${tel}" target="_blank">💬</a>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ============================================
// GESTIÓN HOY
// ============================================
function renderGestionHoy() {
  const ds = getDiaSemanaHoy();
  const dm = getDiaMesHoy();

  document.getElementById('hoy-info').textContent =
    `${hoy.toLocaleDateString('es-HN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;

  const activos = DATOS.prestamos.filter(p => (p.balance + p.balanceCuotas) >= CONFIG.MIN_BALANCE_ACTIVO);
  
  // Clientes que les toca hoy
  const cHoy = {};
  activos.forEach(p => {
    const dp = p.diaPago.toLowerCase();
    const esHoy = dp.includes(ds) || dp === `día ${dm}`;
    if (esHoy) {
      if (!cHoy[p.cliente]) {
        cHoy[p.cliente] = { cliente: p.cliente, telefono: p.telefono || '', cartera: p.cartera, diaPago: p.diaPago, prestamos: [], totalBal: 0, totalCuo: 0 };
      }
      cHoy[p.cliente].prestamos.push(p);
      cHoy[p.cliente].totalBal += p.balance;
      cHoy[p.cliente].totalCuo += p.balanceCuotas;
    }
  });

  const lista = Object.values(cHoy);
  const gDeHoy = DATOS.gestiones.filter(g => g.fecha === hoyStr);
  const yaG = new Set(gDeHoy.map(g => g.cliente));
  const pend = lista.filter(c => !yaG.has(c.cliente));
  const comp = lista.filter(c => yaG.has(c.cliente));

  // Vacío
  document.getElementById('hoy-vacio').style.display = lista.length === 0 ? 'block' : 'none';

  // Pendientes
  const pendContainer = document.getElementById('hoy-pendientes');
  if (pend.length > 0) {
    pendContainer.innerHTML = `<h3 class="section-header pending">⏳ Pendientes de Gestionar (${pend.length})</h3>` +
      pend.map(c => `
        <div class="list-item hoy-item-pending" style="margin-bottom:6px">
          <div class="item-info">
            <div class="item-name">${c.cliente}</div>
            <div class="item-detail">${c.diaPago} · Cuota: ${formatL(c.totalCuo)}</div>
          </div>
          <div class="item-balance">${formatL(c.totalBal)}</div>
          <button class="btn-gestionar" onclick='abrirModal(${JSON.stringify(c).replace(/'/g, "\\'")})'>Gestionar</button>
        </div>`).join('');
  } else {
    pendContainer.innerHTML = '';
  }

  // Completados
  const compContainer = document.getElementById('hoy-completados');
  if (comp.length > 0) {
    compContainer.innerHTML = `<h3 class="section-header done">✅ Gestionados (${comp.length})</h3>` +
      comp.map(c => {
        const ug = gDeHoy.filter(g => g.cliente === c.cliente).sort((a, b) => (b.hora || '').localeCompare(a.hora || ''))[0];
        const est = ug ? getEstadoInfo(ug.estado) : getEstadoInfo('pendiente');
        return `
          <div class="list-item hoy-item-done ${getBorderClass(ug?.estado)}" style="margin-bottom:6px">
            <div class="item-info">
              <div class="item-name">${c.cliente}</div>
              <div class="item-detail">${ug?.comentario || 'Sin comentario'}</div>
            </div>
            <span class="item-badge" style="background:${est.bg};color:${est.color}">${est.icon} ${est.label}</span>
          </div>`;
      }).join('');
  } else {
    compContainer.innerHTML = '';
  }
}

// ============================================
// HISTORIAL
// ============================================
function renderHistorial() {
  document.getElementById('filtro-hist-fecha').value = hoyStr;
  filtrarHistorial();
}

function filtrarHistorial() {
  const fFecha = document.getElementById('filtro-hist-fecha').value;
  const fEst = document.getElementById('filtro-hist-estado').value;

  let fil = [...DATOS.gestiones].sort((a, b) => `${b.fecha}${b.hora}`.localeCompare(`${a.fecha}${a.hora}`));
  if (fFecha) fil = fil.filter(g => g.fecha === fFecha);
  if (fEst) fil = fil.filter(g => g.estado === fEst);

  document.getElementById('historial-count').textContent = `${fil.length} gestiones encontradas`;

  const container = document.getElementById('historial-lista');
  if (fil.length === 0) {
    container.innerHTML = '<div class="empty-state"><span class="empty-icon">📭</span><span>Sin gestiones para estos filtros</span></div>';
    return;
  }

  container.innerHTML = fil.map(g => {
    const est = getEstadoInfo(g.estado);
    return `
      <div class="list-item ${getBorderClass(g.estado)}">
        <div class="item-info">
          <div class="item-name">${g.cliente}</div>
          ${g.comentario ? `<div class="item-detail">${g.comentario}</div>` : ''}
          ${g.fechaPromesa ? `<div class="item-detail" style="color:#d97706">Promesa: ${g.fechaPromesa}</div>` : ''}
        </div>
        <span class="item-badge" style="background:${est.bg};color:${est.color}">${est.icon} ${est.label}</span>
        <span class="item-fecha">${g.fecha} ${g.hora || ''}</span>
      </div>`;
  }).join('');
}

function limpiarFiltrosHistorial() {
  document.getElementById('filtro-hist-fecha').value = '';
  document.getElementById('filtro-hist-estado').value = '';
  filtrarHistorial();
}

// ============================================
// PAGOS
// ============================================
function renderPagos() {
  filtrarPagos();
}

function filtrarPagos() {
  const fTexto = document.getElementById('filtro-pagos-texto').value.toLowerCase();
  
  let fil = [...DATOS.pagos].sort((a, b) => b.fecha.localeCompare(a.fecha));
  if (fTexto) fil = fil.filter(p => p.cliente.toLowerCase().includes(fTexto));
  
  const total = fil.reduce((s, p) => s + p.valor, 0);
  document.getElementById('pagos-total').textContent = `Total: ${formatL(total)}`;

  const container = document.getElementById('pagos-lista');
  container.innerHTML = fil.map(p => `
    <div class="list-item border-green">
      <div class="item-info">
        <div class="item-name">${p.cliente}</div>
        <div class="item-detail">${p.tipo} · ${p.caja || ''}</div>
      </div>
      <div class="item-valor">${formatL(p.valor)}</div>
      <span class="item-fecha">${p.fecha}</span>
    </div>`).join('');
}

// ============================================
// MODAL GESTIONAR
// ============================================
function abrirModal(cliente) {
  clienteActual = cliente;
  estadoSeleccionado = '';

  document.getElementById('modal-gestionar').style.display = 'flex';
  document.getElementById('modal-cliente-nombre').textContent = cliente.cliente;
  document.getElementById('modal-cliente-info').textContent = 
    `${cliente.diaPago} · Balance: ${formatL(cliente.totalBal)} · Cuota: ${formatL(cliente.totalCuo)}`;

  // Préstamos
  const pSection = document.getElementById('modal-prestamos-section');
  const pLista = document.getElementById('modal-prestamos-lista');
  if (cliente.prestamos && cliente.prestamos.length > 0) {
    pSection.style.display = 'block';
    pLista.innerHTML = cliente.prestamos.map(p => `
      <div class="prestamo-row">
        <span class="prestamo-tipo">${p.tipo}</span>
        <div>
          <span class="prestamo-monto">${formatL(p.balance)}</span>
          <span class="prestamo-cuota">Cuota: ${formatL(p.balanceCuotas)}</span>
        </div>
      </div>`).join('');
  } else {
    pSection.style.display = 'none';
  }

  // Estados
  const estContainer = document.getElementById('modal-estados');
  estContainer.innerHTML = CONFIG.ESTADOS.filter(e => e.value !== 'pendiente').map(e => `
    <button class="estado-btn" data-estado="${e.value}" 
      onclick="seleccionarEstado('${e.value}')"
      style="border-color:${e.color}">${e.icon} ${e.label}</button>`).join('');

  // Reset form
  document.getElementById('modal-comentario').value = '';
  document.getElementById('modal-fecha-promesa').value = '';
  document.getElementById('modal-fecha-promesa').min = hoyStr;
  document.getElementById('promesa-fecha-container').style.display = 'none';
  document.getElementById('btn-guardar-gestion').disabled = true;

  // Historial
  const hist = DATOS.gestiones
    .filter(g => g.cliente === cliente.cliente)
    .sort((a, b) => `${b.fecha}${b.hora}`.localeCompare(`${a.fecha}${a.hora}`));

  const hSection = document.getElementById('modal-historial-section');
  const hLista = document.getElementById('modal-historial-lista');
  if (hist.length > 0) {
    hSection.style.display = 'block';
    hLista.innerHTML = hist.slice(0, 10).map(g => {
      const e = getEstadoInfo(g.estado);
      return `
        <div class="hist-item">
          <div>
            <span class="item-badge" style="background:${e.bg};color:${e.color};font-size:10px;padding:1px 7px">${e.icon} ${e.label}</span>
            ${g.comentario ? `<div class="hist-comment">${g.comentario}</div>` : ''}
            ${g.fechaPromesa ? `<div class="hist-promesa">Promesa: ${g.fechaPromesa}</div>` : ''}
          </div>
          <div class="hist-date">${g.fecha}<br>${g.hora || ''}</div>
        </div>`;
    }).join('');
  } else {
    hSection.style.display = 'none';
  }
}

function seleccionarEstado(estado) {
  estadoSeleccionado = estado;
  
  document.querySelectorAll('.estado-btn').forEach(btn => {
    const isSelected = btn.dataset.estado === estado;
    const est = getEstadoInfo(estado);
    btn.classList.toggle('selected', isSelected);
    if (isSelected) {
      btn.style.background = est.bg;
      btn.style.color = est.color;
      btn.style.borderColor = est.color;
    } else {
      btn.style.background = '#fff';
      btn.style.color = '#475569';
      btn.style.borderColor = '#d1d5db';
    }
  });

  document.getElementById('promesa-fecha-container').style.display = estado === 'promesa' ? 'block' : 'none';
  document.getElementById('btn-guardar-gestion').disabled = false;
}

async function guardarGestionModal() {
  if (!estadoSeleccionado || !clienteActual) return;

  const gestion = {
    cliente: clienteActual.cliente,
    estado: estadoSeleccionado,
    comentario: document.getElementById('modal-comentario').value,
    fechaPromesa: estadoSeleccionado === 'promesa' ? document.getElementById('modal-fecha-promesa').value : '',
    fecha: hoyStr,
    hora: new Date().toLocaleTimeString('es-HN'),
    gestor: CONFIG.GESTOR_NOMBRE,
  };

  // Guardar localmente
  DATOS.gestiones.push(gestion);

  // Intentar guardar en API
  try {
    await API.guardarGestion(gestion);
    showToast('✅ Gestión guardada en Google Sheets', 'success');
  } catch (err) {
    showToast('💾 Guardado localmente (sin conexión a Sheets)', '');
  }

  cerrarModal();

  // Re-renderizar tab actual
  const activeTab = document.querySelector('.menu-item.active')?.dataset.tab || 'dashboard';
  switchTab(activeTab);
}

function cerrarModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('modal-gestionar').style.display = 'none';
  clienteActual = null;
  estadoSeleccionado = '';
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  cargarTodosDatos();
});

// Cerrar modal con Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cerrarModal();
});
