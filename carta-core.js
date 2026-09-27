// Motor astrológico: posiciones tropicales geocéntricas (eclíptica verdadera de la fecha),
// nodo lunar verdadero (Meeus), Asc/MC y casas Plácidus.
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

  // Nodo lunar verdadero (Meeus, Astronomical Algorithms, cap. 47)
  function trueNode(date) {
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

  root.AstroCore = { positions, houses, houseOf, norm, trueNode, BODIES };
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
