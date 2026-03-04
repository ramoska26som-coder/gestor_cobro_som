// ============================================
// GAMIFICACIÓN v4 - Cobros Pro
// Sistema de XP, niveles, logros y streaks
// ============================================
const GAMI = {
  KEY_XP:     'cobros_xp',
  KEY_LOGROS: 'cobros_logros',
  KEY_STREAK: 'cobros_streak',
  KEY_LAST:   'cobros_last_cobro',
  KEY_TODAY:  'cobros_today_stats',
  KEY_META:   'cobros_meta',

  // ── Persistencia ──
  getXP()    { return parseInt(localStorage.getItem(this.KEY_XP) || '0'); },
  setXP(v)   { localStorage.setItem(this.KEY_XP, v); },
  addXP(n)   { const xp = this.getXP() + n; this.setXP(xp); return xp; },

  getLogros() { try { return JSON.parse(localStorage.getItem(this.KEY_LOGROS) || '{}'); } catch { return {}; } },
  setLogros(o){ localStorage.setItem(this.KEY_LOGROS, JSON.stringify(o)); },

  getStreak() { return parseInt(localStorage.getItem(this.KEY_STREAK) || '0'); },
  getLastCobro(){ return localStorage.getItem(this.KEY_LAST) || ''; },

  getMeta()   { return parseInt(localStorage.getItem(this.KEY_META) || CONFIG.META_CICLO); },
  setMeta(v)  { localStorage.setItem(this.KEY_META, v); CONFIG.META_CICLO = v; },

  getTodayStats() {
    try {
      const s = JSON.parse(localStorage.getItem(this.KEY_TODAY) || '{}');
      if (s.fecha !== HOYSTR) return { fecha: HOYSTR, gestiones: 0, cobros: 0, logrosDados: {} };
      return s;
    } catch { return { fecha: HOYSTR, gestiones: 0, cobros: 0, logrosDados: {} }; }
  },
  saveTodayStats(s) { localStorage.setItem(this.KEY_TODAY, JSON.stringify(s)); },

  // ── Nivel ──
  getNivel(xp) {
    const niveles = CONFIG.NIVELES;
    for (let i = niveles.length - 1; i >= 0; i--) {
      if (xp >= niveles[i].min) return { ...niveles[i], idx: i };
    }
    return { ...niveles[0], idx: 0 };
  },

  getProgresoNivel(xp) {
    const n = this.getNivel(xp);
    const next = CONFIG.NIVELES[n.idx + 1];
    if (!next) return { pct: 100, actual: xp, falta: 0 };
    const base = n.min, rango = next.min - base;
    return { pct: Math.min(((xp - base) / rango) * 100, 100), actual: xp - base, falta: next.min - xp };
  },

  // ── Streak ──
  actualizarStreak(tuvoCobro) {
    const hoy = HOYSTR;
    const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
    const ayerStr = ayer.toISOString().split('T')[0];
    const ultimo = this.getLastCobro();
    let streak = this.getStreak();

    if (tuvoCobro) {
      if (ultimo === ayerStr) streak++;
      else if (ultimo !== hoy) streak = 1;
      localStorage.setItem(this.KEY_STREAK, streak);
      localStorage.setItem(this.KEY_LAST, hoy);
    }
    return streak;
  },

  // ── Logros ──
  checkLogros(contexto) {
    const { gestHoy, cobrosHoy, montoCobrado, totalClientes, clientesHoy, horaActual, tiempoGestion, streakActual, metaAlcanzada } = contexto;
    const earned = this.getLogros();
    const stats = this.getTodayStats();
    const nuevos = [];

    const check = (id, condicion) => {
      const logro = CONFIG.LOGROS.find(l => l.id === id);
      if (!logro || !condicion) return;
      const yaHoy = stats.logrosDados?.[id];
      if (yaHoy) return;
      nuevos.push(logro);
      earned[id] = (earned[id] || 0) + 1;
      if (!stats.logrosDados) stats.logrosDados = {};
      stats.logrosDados[id] = true;
      this.addXP(logro.xp);
    };

    check('primera_gestion', gestHoy === 1);
    check('primer_cobro',    cobrosHoy === 1);
    check('cinco_gest',      gestHoy === 5);
    check('diez_gest',       gestHoy === 10);
    check('todos_contact',   clientesHoy > 0 && gestHoy >= clientesHoy);
    check('meta_cumplida',   metaAlcanzada);
    check('cobro_grande',    montoCobrado >= 5000);
    check('racha_3',         streakActual >= 3 && streakActual % 3 === 0);
    check('racha_7',         streakActual >= 7 && streakActual % 7 === 0);
    check('madrugador',      gestHoy === 1 && horaActual && parseInt(horaActual.split(':')[0]) < 8);
    check('velocista',       tiempoGestion !== undefined && tiempoGestion < 60);

    stats.gestiones = gestHoy;
    stats.cobros    = cobrosHoy;
    this.setLogros(earned);
    this.saveTodayStats(stats);
    return nuevos;
  },

  // ── Render barra gamificación ──
  renderBar() {
    const xp = this.getXP();
    const nivel = this.getNivel(xp);
    const prog = this.getProgresoNivel(xp);
    const streak = this.getStreak();
    const el = document.getElementById('gami-bar');
    if (!el) return;
    el.innerHTML = `
      <div class="gami-inner">
        <div class="gami-nivel">
          <span class="gami-icon">${nivel.icon}</span>
          <div class="gami-info">
            <span class="gami-name">${nivel.nombre}</span>
            <div class="gami-track"><div class="gami-fill" style="width:${prog.pct}%;background:${nivel.color}"></div></div>
          </div>
          <span class="gami-xp">${xp} XP</span>
        </div>
        ${streak > 0 ? `<div class="gami-streak">🔥 ${streak}d</div>` : ''}
      </div>`;
  },

  // ── Mostrar logro ganado ──
  mostrarLogro(logro) {
    const el = document.createElement('div');
    el.className = 'logro-toast';
    el.innerHTML = `<span class="logro-icon">${logro.icon}</span><div><strong>${logro.nombre}</strong><br><small>${logro.desc}</small><br><small style="color:var(--yellow)">+${logro.xp} XP</small></div>`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('show'), 50);
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 500); }, 3500);
  },

  // ── Celebración de cobro ──
  celebrar(monto) {
    const overlay = document.getElementById('celebracion');
    if (!overlay) return;
    document.getElementById('cel-monto').textContent = 'L ' + Number(monto).toLocaleString('es-HN', {minimumFractionDigits:2, maximumFractionDigits:2});
    overlay.style.display = 'flex';
    this._confetti();
    setTimeout(() => overlay.style.display = 'none', 3000);
  },

  _confetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles = Array.from({length: 80}, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 8 + 4,
      d: Math.random() * 80 + 10,
      color: ['#22c55e','#f59e0b','#3b82f6','#a855f7','#ef4444','#f97316'][Math.floor(Math.random()*6)],
      tilt: Math.random() * 10 - 10,
      tiltAngle: 0, tiltSpeed: Math.random() * 0.1 + 0.05,
    }));
    let frame = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.tiltAngle += p.tiltSpeed;
        p.y += (Math.cos(frame / 10 + p.d) + 3 + p.r / 2) / 2;
        p.tilt = Math.sin(p.tiltAngle) * 15;
        ctx.beginPath(); ctx.fillStyle = p.color;
        ctx.ellipse(p.x + p.tilt, p.y, p.r / 2, p.r, 0, 0, 2 * Math.PI);
        ctx.fill();
      });
      frame++;
      if (frame < 120) requestAnimationFrame(animate);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    animate();
  },

  // ── Resumen de logros para perfil ──
  getResumenLogros() {
    const earned = this.getLogros();
    return CONFIG.LOGROS.map(l => ({
      ...l, veces: earned[l.id] || 0, ganado: (earned[l.id] || 0) > 0
    }));
  },
};
