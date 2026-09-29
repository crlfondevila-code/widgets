// Motor astrológico: posiciones tropicales geocéntricas (eclíptica verdadera de la fecha),
// nodo lunar verdadero (Meeus), Asc/MC y casas Plácidus. Con carta-efem.js cargado, también
// Quirón, Ceres, Palas, Juno y Vesta; además Lilith media, nodo sur, Parte de la Fortuna y Vértice.
(function (root) {
  const A = root.Astronomy;
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const norm = x => ((x % 360) + 360) % 360;
  const sinD = x => Math.sin(x * D2R), cosD = x => Math.cos(x * D2R), tanD = x => Math.tan(x * D2R);
  const atan2D = (y, x) => norm(Math.atan2(y, x) * R2D);

  const BODIES = [
    { key: 'sun', body: 'Sun' }, { key: 'moon', body: 'Moon' }, { key: 'mercury', body: 'Mercury' },
    { key: 'venus', body: 'Venus' }, { key: 'mars', body: 'Mars' }, { key: 'jupiter', body: 'Jupiter' },
    { key: 'saturn', body: 'Saturn' }, { key: 'uranus', body: 'Uranus' }, { key: 'neptune', body: 'Neptune' },
    { key: 'pluto', body: 'Pluto' }, { key: 'node', body: null }
  ];

  function bodyLon(key, body, date) {
    if (key === 'sun') return norm(A.SunPosition(date).elon);
    if (key === 'moon') return norm(A.EclipticGeoMoon(date).lon);
    if (key === 'node') return trueNode(date);
    return norm(A.Ecliptic(A.GeoVector(body, date, true)).elon);
  }

  // Nodo lunar verdadero = nodo osculador (como Swiss Ephemeris): el plano que forman la posición y la velocidad
  // geocéntricas de la Luna, en la eclíptica verdadera de la fecha. Si falta la función, fórmula de Meeus.
  function trueNode(date) {
    if (A.GeoMoonState && A.Rotation_EQJ_ECT) {
      const t = A.MakeTime(date), s = A.GeoMoonState(t), R = A.Rotation_EQJ_ECT(t);
      const r = A.RotateVector(R, new A.Vector(s.x, s.y, s.z, t)), v = A.RotateVector(R, new A.Vector(s.vx, s.vy, s.vz, t));
      return atan2D(r.y * v.z - r.z * v.y, -(r.z * v.x - r.x * v.z));
    }
    return meeusNode(date);
  }
  // Nodo verdadero aproximado (Meeus, Astronomical Algorithms, cap. 47)
  function meeusNode(date) {
    const t = A.MakeTime(date);
    const T = t.tt / 36525; // siglos julianos desde J2000 (TT)
    const D = norm(297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + T * T * T / 545868 - T ** 4 / 113065000);
    const M = norm(357.5291092 + 35999.0502909 * T - 0.0001536 * T * T + T * T * T / 24490000);
    const Mp = norm(134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + T * T * T / 69699 - T ** 4 / 14712000);
    const F = norm(93.2720950 + 483202.0175233 * T - 0.0036539 * T * T - T * T * T / 3526000 + T ** 4 / 863310000);
    const mean = 125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + T * T * T / 467441 - T ** 4 / 60616000;
    const corr = -1.4979 * sinD(2 * (D - F)) - 0.1500 * sinD(M) - 0.1226 * sinD(2 * D) + 0.1176 * sinD(2 * F) - 0.0801 * sinD(2 * (Mp - F));
    return norm(mean + corr);
  }

  function positions(date) {
    const out = {};
    const later = new Date(date.getTime() + 6 * 3600 * 1000);
    for (const b of BODIES) {
      const lon = bodyLon(b.key, b.body, date);
      let speed = bodyLon(b.key, b.body, later) - lon;
      if (speed > 180) speed -= 360; if (speed < -180) speed += 360;
      out[b.key] = { lon, speed: speed * 4, retro: b.key !== 'node' && b.key !== 'sun' && b.key !== 'moon' && speed < 0 };
    }
    return out;
  }

  // Asc, MC y casas Plácidus
  function houses(date, lat, lonEast) {
    const t = A.MakeTime(date);
    const eps = A.e_tilt(t).tobl;
    const ramc = norm(A.SiderealTime(date) * 15 + lonEast);
    const mc = atan2D(sinD(ramc), cosD(ramc) * cosD(eps));
    const asc = atan2D(cosD(ramc), -(sinD(ramc) * cosD(eps) + tanD(lat) * sinD(eps)));
    const lonFromRA = ra => atan2D(sinD(ra), cosD(ra) * cosD(eps));
    const decOf = l => Math.asin(sinD(eps) * sinD(l)) * R2D;
    const ad = dec => { const v = tanD(lat) * tanD(dec); return Math.asin(Math.max(-1, Math.min(1, v))) * R2D; };
    function cusp(kind, f) {
      let ra = kind === 'day' ? ramc + 30 * (f * 3) : ramc + 180 - 30 * (f * 3);
      for (let i = 0; i < 60; i++) {
        const l = lonFromRA(norm(ra));
        const a = ad(decOf(l));
        const next = kind === 'day' ? ramc + f * (90 + a) : ramc + 180 - f * (90 - a);
        if (Math.abs(next - ra) < 1e-7) { ra = next; break; }
        ra = next;
      }
      return lonFromRA(norm(ra));
    }
    const c = new Array(13);
    c[1] = asc; c[10] = mc;
    c[11] = cusp('day', 1 / 3); c[12] = cusp('day', 2 / 3);
    c[2] = cusp('night', 2 / 3); c[3] = cusp('night', 1 / 3);
    c[4] = norm(mc + 180); c[5] = norm(c[11] + 180); c[6] = norm(c[12] + 180);
    c[7] = norm(asc + 180); c[8] = norm(c[2] + 180); c[9] = norm(c[3] + 180);
    return { asc, mc, cusps: c, ramc, eps };
  }

  function houseOf(lon, cusps) {
    for (let h = 1; h <= 12; h++) {
      const a = cusps[h], b = cusps[h === 12 ? 1 : h + 1];
      const span = norm(b - a), d = norm(lon - a);
      if (d < span) return h;
    }
    return 12;
  }

  // ---------- Puntos extra: Quirón, asteroides, Lilith, nodo sur, Parte de la Fortuna y Vértice ----------
  // Quirón y asteroides: elementos osculadores de carta-efem.js (Swiss Ephemeris), propagados con Kepler desde
  // la época más cercana; posición aparente geocéntrica (tiempo de luz y aberración) en la eclíptica verdadera de la fecha.
  const GM = 0.01720209895 * 0.01720209895;      // UA³/día²
  const C_AUD = 173.1446326846693;                // velocidad de la luz en UA/día
  const EFEM_KEYS = ['chiron', 'ceres', 'pallas', 'juno', 'vesta'];
  let ECL2EQJ = null;

  function helioEcl(key, tt) {                    // tt: días TT desde J2000
    const E = root.CartaEfem, b = E && E.bodies[key];
    if (!b) return null;
    const k = Math.round((tt - E.t0) / b.step);
    if (k < 0 || k >= b.n) return null;          // fuera de 1900-2100
    const o = k * 6, el = b.el;
    const a = el[o], e = el[o + 1], i = el[o + 2] * D2R, Om = el[o + 3] * D2R, w = el[o + 4] * D2R;
    const M = el[o + 5] * D2R + Math.sqrt(GM / (a * a * a)) * (tt - (E.t0 + k * b.step));
    let Ea = M;
    for (let it = 0; it < 30; it++) { const d = (Ea - e * Math.sin(Ea) - M) / (1 - e * Math.cos(Ea)); Ea -= d; if (Math.abs(d) < 1e-12) break; }
    const xp = a * (Math.cos(Ea) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(Ea);
    const cO = Math.cos(Om), sO = Math.sin(Om), cw = Math.cos(w), sw = Math.sin(w), ci = Math.cos(i), si = Math.sin(i);
    return [
      (cO * cw - sO * sw * ci) * xp + (-cO * sw - sO * cw * ci) * yp,
      (sO * cw + cO * sw * ci) * xp + (-sO * sw + cO * cw * ci) * yp,
      (sw * si) * xp + (cw * si) * yp
    ];
  }
  function efemLon(key, date) {
    const t = A.MakeTime(date);
    if (!ECL2EQJ) ECL2EQJ = A.Rotation_ECL_EQJ();
    let tau = 0, g = null;
    for (let it = 0; it < 3; it++) {              // tiempo de luz; la Tierra también se retrasa (aberración)
      const h = helioEcl(key, t.tt - tau); if (!h) return null;
      const tb = t.AddDays(-tau);
      const b = A.RotateVector(ECL2EQJ, new A.Vector(h[0], h[1], h[2], tb));
      const earth = A.HelioVector('Earth', tb);
      g = new A.Vector(b.x - earth.x, b.y - earth.y, b.z - earth.z, t);
      tau = Math.hypot(g.x, g.y, g.z) / C_AUD;
    }
    return norm(A.Ecliptic(g).elon);
  }

  // Lilith (Luna negra media): apogeo medio de la órbita lunar (perigeo medio de ELP + 180°), proyectado desde
  // el plano de la órbita (5,145°) a la eclíptica y con nutación, como Swiss Ephemeris (diferencia < 2″)
  function meanLilith(date) {
    const t = A.MakeTime(date), T = t.tt / 36525;
    const apogee = 83.3532465 + 4069.0137287 * T - 0.0103200 * T * T - T * T * T / 80053 + T ** 4 / 18999000 + 180;
    const node = 125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + T * T * T / 467441 - T ** 4 / 60616000;
    const u = apogee - node;
    return norm(node + atan2D(cosD(5.1453964) * sinD(u), cosD(u)) + A.e_tilt(t).dpsi / 3600);
  }

  const EXTRA = [
    { key: 'chiron', fn: d => efemLon('chiron', d), retro: true }, { key: 'lilith', fn: meanLilith, retro: false },
    { key: 'ceres', fn: d => efemLon('ceres', d), retro: true }, { key: 'pallas', fn: d => efemLon('pallas', d), retro: true },
    { key: 'juno', fn: d => efemLon('juno', d), retro: true }, { key: 'vesta', fn: d => efemLon('vesta', d), retro: true },
    { key: 'snode', fn: d => norm(trueNode(d) + 180), retro: false }
  ];
  // Devuelve { chiron, lilith, ceres, pallas, juno, vesta, snode } (los que se puedan calcular) con lon, speed y retro
  function extraPositions(date, keys) {
    const out = {}, later = new Date(date.getTime() + 6 * 3600 * 1000);
    for (const x of EXTRA) {
      if (keys && !keys.includes(x.key)) continue;
      const lon = x.fn(date); if (lon == null) continue;
      const l2 = x.fn(later); let speed = l2 == null ? 0 : l2 - lon;
      if (speed > 180) speed -= 360; if (speed < -180) speed += 360;
      out[x.key] = { lon, speed: speed * 4, retro: x.retro && speed < 0 };
    }
    return out;
  }

  // Vértice: el «ascendente» del RAMC opuesto para la colatitud (como Swiss Ephemeris)
  function vertex(H, lat) {
    const ramc = norm(H.ramc + 180), eps = H.eps, f = lat >= 0 ? 90 - lat : -90 - lat;
    let vx = atan2D(cosD(ramc), -(sinD(ramc) * cosD(eps) + tanD(f) * sinD(eps)));
    // entre los trópicos se deja siempre en el lado oeste (como Swiss Ephemeris)
    if (Math.abs(lat) <= eps && norm(vx - H.mc + 180) - 180 > 0) vx = norm(vx + 180);
    return vx;
  }
  // Parte de la Fortuna: de día Asc + Luna − Sol; de noche (Sol bajo el horizonte, casas 1-6) Asc + Sol − Luna
  function fortune(asc, sun, moon, cusps) {
    const night = houseOf(sun, cusps) <= 6;
    return { lon: norm(night ? asc + sun - moon : asc + moon - sun), night };
  }

  root.AstroCore = { positions, houses, houseOf, norm, trueNode, BODIES, extraPositions, meanLilith, vertex, fortune, efemLon, meeusNode };
})(typeof window !== 'undefined' ? window : globalThis);

// Datos de nacimiento: van en el enlace, después de la almohadilla (#), y nunca en este archivo.
// Ejemplo: carta-rueda.html#fecha=1990-05-17&hora=08:30&utc=2&lat=41.39&lon=2.17&lugar=Barcelona&nombre=Ana
// Lo que va detrás de # no se envía a ningún servidor: solo lo lee tu navegador.
(function (root) {
  function get() {
    const h = new URLSearchParams((root.location && root.location.hash || '').replace(/^#/, ''));
    const fecha = h.get('fecha'), hora = h.get('hora') || '12:00';
    const lat = parseFloat(h.get('lat')), lon = parseFloat(h.get('lon'));
    const utc = parseFloat((h.get('utc') || '0').replace(',', '.'));
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{1,2}:\d{2}$/.test(hora) || isNaN(lat) || isNaN(lon) || isNaN(utc)) return null;
    const [y, m, d] = fecha.split('-').map(Number), [hh, mm] = hora.split(':').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, hh, mm) - utc * 3600000);
    return { date, lat, lon, utc, fecha, hora, lugar: h.get('lugar') || '', nombre: h.get('nombre') || '' };
  }

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function dms(v, pos, neg) { const a = Math.abs(v), d = Math.floor(a), m = Math.round((a - d) * 60); return `${d}°${String(m).padStart(2, '0')}′ ${v >= 0 ? pos : neg}`; }
  function describe(b) {
    const [y, m, d] = b.fecha.split('-').map(Number);
    const off = (b.utc >= 0 ? '+' : '−') + String(Math.abs(b.utc)).replace('.', ',');
    return `${d} de ${MESES[m - 1]} de ${y} · ${b.hora} (UTC${off})${b.lugar ? ' · ' + b.lugar : ''}, ${dms(b.lat, 'N', 'S')} ${dms(b.lon, 'E', 'O')}`;
  }

  // Formulario para crear el enlace cuando no hay datos
  function showSetup(container) {
    const box = document.createElement('div');
    box.setAttribute('style', 'max-width:420px;margin:16px auto;padding:16px;border:1px solid var(--rule,#ccc);border-radius:10px;background:var(--surface,#fff);color:var(--ink,#222);font:14px/1.45 system-ui,sans-serif');
    box.innerHTML = `
      <p style="margin:0 0 4px;font-weight:600">Faltan los datos de nacimiento</p>
      <p style="margin:0 0 12px;color:var(--muted,#666);font-size:13px">Rellénalos y se creará un enlace con ellos. Los datos viajan solo dentro del enlace: no se guardan en ningún servidor.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <label style="grid-column:1/-1">Nombre (opcional)<input id="cb-nombre" type="text" style="width:100%"></label>
        <label>Fecha<input id="cb-fecha" type="date" style="width:100%"></label>
        <label>Hora local<input id="cb-hora" type="time" style="width:100%"></label>
        <label>Diferencia con UTC<input id="cb-utc" type="number" step="0.5" value="1" style="width:100%"></label>
        <label>Lugar (opcional)<input id="cb-lugar" type="text" style="width:100%"></label>
        <label>Latitud<input id="cb-lat" type="number" step="0.0001" placeholder="41.3874" style="width:100%"></label>
        <label>Longitud (E +, O −)<input id="cb-lon" type="number" step="0.0001" placeholder="2.1686" style="width:100%"></label>
      </div>
      <p style="margin:8px 0 0;color:var(--muted,#666);font-size:12px">En España: UTC+1 en horario de invierno y UTC+2 en el de verano (desde 1974).</p>
      <button id="cb-go" type="button" style="margin-top:12px">Crear el enlace</button>
      <p id="cb-msg" style="margin:8px 0 0;font-size:12.5px;color:var(--tens,#b33)"></p>`;
    box.querySelectorAll('label').forEach(l => { l.style.cssText = 'display:grid;gap:3px;font-size:12.5px;color:var(--muted,#666)'; });
    box.querySelectorAll('input').forEach(i => { i.style.cssText = 'width:100%;padding:6px 8px;border:1px solid var(--rule,#ccc);border-radius:6px;background:var(--bg,#fff);color:var(--ink,#222);font:14px system-ui,sans-serif'; });
    container.replaceChildren(box);
    box.querySelector('#cb-go').addEventListener('click', () => {
      const v = id => box.querySelector('#cb-' + id).value.trim();
      if (!v('fecha') || !v('hora') || v('lat') === '' || v('lon') === '') { box.querySelector('#cb-msg').textContent = 'Faltan fecha, hora, latitud o longitud.'; return; }
      const p = new URLSearchParams({ fecha: v('fecha'), hora: v('hora'), utc: v('utc') || '0', lat: v('lat'), lon: v('lon') });
      if (v('lugar')) p.set('lugar', v('lugar'));
      if (v('nombre')) p.set('nombre', v('nombre'));
      root.location.hash = p.toString();
    });
  }

  root.addEventListener && root.addEventListener('hashchange', () => root.location.reload());
  root.CartaBirth = { get, describe, showSetup };
})(typeof window !== 'undefined' ? window : globalThis);
