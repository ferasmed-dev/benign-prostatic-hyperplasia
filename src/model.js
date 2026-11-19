// Benign prostatic hyperplasia — 10-year course, pure model (no DOM).
// Two components of obstruction: static (adenoma volume, DHT-driven) and dynamic (α1A smooth-muscle tone).
// Obstruction → detrusor compensation → decompensation with residual urine (Guyon stages) → retention and
// upper-tract damage. Every drug and operation acts on its own lever. Values marked "Model" are teaching assumptions.

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const approach = (v, target, dt, tau) => v + (target - v) * Math.min(1, dt / tau);

export const GAUGES = {
  vol: { unit: 'g', dec: 0, normal: [15, 30], yMin: 0 },
  psa: { unit: 'ng/mL', dec: 1, normal: [0, 4], yMin: 0 },
  qmax: { unit: 'mL/s', dec: 1, normal: [15, 30], yMin: 0 },
  rpm: { unit: 'mL', dec: 0, normal: [0, 50], yMin: 0 },
  ipss: { unit: '0–35', dec: 0, normal: [0, 7], yMin: 0, yMax: 35 },
  ipssv: { unit: '0–20', dec: 0, normal: null, yMin: 0, yMax: 20 },
  ipssl: { unit: '0–15', dec: 0, normal: null, yMin: 0, yMax: 15 },
  nocturia: { unit: '', dec: 1, normal: [0, 1], yMin: 0 },
  cr: { unit: 'mg/dL', dec: 2, normal: [0.6, 1.2], yMin: 0 },
  na: { unit: 'mEq/L', dec: 0, normal: [135, 145] },
  guyon: { unit: '0–3', dec: 0, normal: [0, 0], yMin: 0, yMax: 3 },
};

/** PSA ≈ 0.07 ng/mL per gram of benign tissue (Model; PSA density ~0.07–0.1). */
export const psaOf = (vol) => 0.07 * vol;
/** Obstruction index (Model): static part from adenoma volume above 25 g + dynamic part from α1 tone. */
export const obstruction = (vol, tono, staticFactor = 1) => 0.012 * Math.max(0, vol - 25) * staticFactor + 0.45 * tono;
/** IPSS category. */
export const ipssClass = (s) => (s <= 7 ? 'leve' : s <= 19 ? 'moderado' : 'grave');

const R = (key, min, max, step, def, unit = '', dec = 0) => ({ key, min, max, step, def, unit, dec });
const Ch = (key, options, def) => ({ key, type: 'choice', options, def });
const PATIENT = [R('volumen', 20, 150, 5, 50, 'g'), R('crecimiento', 0, 6, 0.5, 3, '%', 1), R('tono', 0, 1, 0.05, 0.5, '', 2), R('llenado', 0, 1, 0.05, 0.3, '', 2)];
const INICIO = R('inicio', 0, 5, 0.5, 1, '', 1);

/* Treatment specs (each acts on one lever):
   kind 'drug' | 'surgery' | 'lifestyle'; alfa: α1 tone ×; ari: 5-ARI; llen: storage-symptom ×; noct: nocturia ×; ipssF: direct IPSS ×;
   rem: fraction of adenoma left after surgery; sf: static-obstruction factor (no tissue removed); tone: neck/dynamic factor after the procedure; range [lo, hi] g of indication; ae: adverse-event keys. */
const TX = {
  vigilancia: { kind: 'lifestyle', llen: 0.8, noct: 0.75, ae: [] },
  alfabloqueante: { kind: 'drug', alfa: 0.35, ipssF: 0.9, ae: ['hipotension', 'eyac_retrograda'] },
  inhibidor_5ar: { kind: 'drug', ari: true, ae: ['libido'] },
  combinacion: { kind: 'drug', alfa: 0.35, ari: true, ipssF: 0.9, ae: ['hipotension', 'eyac_retrograda', 'libido'] },
  antimuscarinico: { kind: 'drug', llen: 0.5, noct: 0.75, ae: [] },
  tadalafilo: { kind: 'drug', ipssF: 0.8, ae: ['cefalea'] },
  desmopresina: { kind: 'drug', noct: 0.45, na: -6, ae: ['hiponatremia'] },
  fitoterapia: { kind: 'drug', ipssF: 0.9, ae: [] },
  tcp: { kind: 'surgery', sf: 0.35, tone: 0.35, range: [0, 30], ae: ['eyac_preservada'] },
  rtup: { kind: 'surgery', rem: 0.3, range: [30, 80], ae: ['aneyaculacion', 'sangrado_leve'] },
  adenomectomia: { kind: 'surgery', rem: 0.15, range: [80, 999], ae: ['aneyaculacion', 'sangrado'] },
  fotovaporizacion: { kind: 'surgery', rem: 0.45, range: [0, 80], ae: ['aneyaculacion', 'sin_histologia'] },
  holmio: { kind: 'surgery', rem: 0.15, range: [0, 999], ae: ['aneyaculacion', 'iu_transitoria'] },
  minimamente_invasiva: { kind: 'surgery', sf: 0.45, tone: 0.7, range: [30, 80], ae: ['eyac_preservada'] },
};

const TILES = ['ipss', 'qmax', 'rpm', 'vol', 'psa'];
const mk = (key, extra = {}) => ({ key, loc: TX[key].kind, unit: 'years', tMax: 10, dt: 0.05, treat: true,
  params: [...PATIENT, ...(extra.params || []), INICIO], tiles: extra.tiles || TILES, charts: extra.charts || ['ipss', 'qmax'],
  steps: ['hiperplasia', 'dinamico', 'obstruccion', 'compensacion', 'descompensacion', 'complicacion', 'tto', 'efecto_adverso'] });

export const ENTITIES = [
  mk('vigilancia', { tiles: ['ipss', 'qmax', 'rpm', 'vol', 'cr'], charts: ['ipss', 'rpm'] }),
  mk('alfabloqueante'),
  mk('inhibidor_5ar', { charts: ['vol', 'psa'] }),
  mk('combinacion', { charts: ['ipss', 'vol'] }),
  mk('antimuscarinico', { params: [Ch('farmaco', ['antimuscarinico', 'mirabegron'], 'antimuscarinico')], tiles: ['ipssl', 'ipssv', 'nocturia', 'rpm'], charts: ['ipssl', 'rpm'] }),
  mk('tadalafilo'),
  mk('desmopresina', { tiles: ['nocturia', 'na', 'ipss', 'qmax'], charts: ['nocturia', 'na'] }),
  mk('fitoterapia'),
  mk('tcp', { tiles: ['ipss', 'qmax', 'rpm', 'vol'] }),
  mk('rtup'),
  mk('adenomectomia'),
  mk('fotovaporizacion'),
  mk('holmio'),
  mk('minimamente_invasiva', { tiles: ['ipss', 'qmax', 'rpm', 'vol'] }),
];

export function defaults(key) {
  const e = ENTITIES.find(x => x.key === key);
  return Object.fromEntries(e.params.map(p => [p.key, p.def]));
}

export function simulate(key, params, treated = false) {
  const e = ENTITIES.find(x => x.key === key);
  if (!e) throw new Error(`unknown entity ${key}`);
  const p = { ...defaults(key), ...params };
  const tx = TX[key];
  const ae = key === 'antimuscarinico' ? [p.farmaco === 'mirabegron' ? 'hta_mirabegron' : 'sequedad'] : tx.ae;
  const points = [], events = [], fired = new Set();
  const emit = (t, k, args = []) => { if (fired.has(k)) return; fired.add(k); events.push({ t, key: k, args }); };
  let vol = p.volumen, ari = 1, alfa = 1, dec = 0, cav = 0, sf = 1, na = 140, done = false;
  const n = Math.round(e.tMax / e.dt);
  for (let i = 0; i <= n; i++) {
    const t = +(i * e.dt).toFixed(6);
    const on = treated && t >= p.inicio;
    if (i > 0) {
      // adenoma growth (slowed ×0.3 by 5-ARI, Model); 5-ARI shrinks the gland ~25 % with a 3-month time constant
      const g = p.crecimiento / 100 * (on && tx.ari ? 0.3 : 1);
      vol += vol * g * e.dt;
      ari = approach(ari, on && tx.ari ? 0.75 : 1, e.dt, 0.25);
      // α-blockers act within days (τ ≈ 1 week)
      alfa = approach(alfa, on && tx.alfa ? tx.alfa : 1, e.dt, 0.02);
      na = approach(na, on && tx.na ? 140 + tx.na : 140, e.dt, 0.05);
    }
    if (on && tx.kind === 'surgery' && !done) {
      done = true;
      const [lo, hi] = tx.range;
      const fit = p.volumen >= lo && p.volumen <= hi;
      emit(t, fit ? 'cirugia' : 'fuera_indicacion', [Math.round(vol)]);
      if (tx.rem !== undefined) { cav = 1 - tx.rem; vol *= tx.rem; }
      if (tx.sf !== undefined) sf = fit ? tx.sf : Math.min(1, tx.sf * 1.8);
    }
    if (on && i > 0) for (const a of ae) emit(t, a);
    if (on && tx.kind !== 'surgery') emit(t, 'tto');
    const vEff = vol * ari;
    const surgeryTone = done && tx.rem !== undefined ? 0.3 : 1;      // stroma removed with the adenoma (Model)
    const tono = p.tono * alfa * surgeryTone * (done && tx.tone ? tx.tone : 1);   // bladder-neck incision / implants open the neck
    const ob = obstruction(vEff, tono, sf);
    // detrusor: compensates while obstruction is moderate, decompensates above 0.6 (Model), recovers partly after relief
    if (i > 0) dec = clamp(dec + (0.12 * Math.max(0, ob - 0.6) - (ob < 0.4 ? 0.06 : 0)) * e.dt, 0, 1);
    const qmax = clamp(22 - 14 * ob - 3 * dec, 2, 25);
    let rpm = 15 + 80 * Math.max(0, ob - 0.3) + 350 * dec;
    let llen = p.llenado * (on && tx.llen ? tx.llen : 1);
    if (on && key === 'antimuscarinico' && p.farmaco === 'antimuscarinico') rpm += 25 * Math.min(1, ob); // anticholinergic: slightly more residual (Model)
    rpm = Math.max(0, rpm);
    const guyon = ob < 0.4 ? 0 : rpm < 100 ? 1 : rpm < 300 ? 2 : 3;
    const cr = 0.9 + Math.max(0, rpm - 300) * 0.006;
    let ipssv = clamp(3 + 11 * ob + 4 * dec, 0, 20);
    let ipssl = clamp(2 + 9 * llen + 3 * ob, 0, 15);
    const f = on && tx.ipssF ? tx.ipssF : 1;
    ipssv *= f; ipssl *= f;
    const ipss = clamp(ipssv + ipssl, 0, 35);
    const nocturia = (0.5 + 2.5 * llen + 1 * ob) * (on && tx.noct ? tx.noct : 1);
    const psa = psaOf(vEff);
    // events
    if (ob >= 0.4) emit(t, 'obstruccion');
    if (guyon >= 2) emit(t, 'residuo', [Math.round(rpm)]);
    if (ob > 1.0 && dec > 0.3) emit(t, 'rao');
    if (rpm > 300) emit(t, 'rco');
    if (dec > 0.6) emit(t, 'diverticulos');
    if (cr > 1.3) emit(t, 'insuf_renal');
    if (na < 135.5) emit(t, 'hiponatremia_lab');
    const active = ['hiperplasia'];
    if (tono > 0.2) active.push('dinamico');
    if (ob >= 0.4) active.push('obstruccion');
    if (guyon === 1) active.push('compensacion');
    if (guyon >= 2) active.push('descompensacion');
    if (guyon >= 3 || cr > 1.3) active.push('complicacion');
    if (on) active.push('tto');
    if (on && ae.length) active.push('efecto_adverso');
    const g = { vol: vEff, psa, qmax, rpm, ipss, ipssv, ipssl, nocturia, cr, na, guyon, alfa: 1 - alfa, ari: 1 - ari, cav: done ? cav : 0, sf: 1 - sf, ob, dec };
    for (const k of Object.keys(g)) g[k] = Number.isFinite(g[k]) ? Math.max(0, g[k]) : 0;
    points.push({ t, g, active, lesion: clamp(ob / 1.5, 0, 1), badge: ipssClass(ipss) });
  }
  return { points, events };
}

export const PRESETS = {
  sintomas_leves: { entity: 'vigilancia', params: { volumen: 35, crecimiento: 2, tono: 0.3, llenado: 0.2, inicio: 0 } },
  progresion_sin_tratar: { entity: 'vigilancia', params: { volumen: 70, crecimiento: 5, tono: 0.6, llenado: 0.3, inicio: 0 } },
  alfa_prostata_pequena: { entity: 'alfabloqueante', params: { volumen: 35, crecimiento: 3, tono: 0.7, llenado: 0.3, inicio: 0.5 } },
  ari_prostata_grande: { entity: 'inhibidor_5ar', params: { volumen: 70, crecimiento: 4, tono: 0.4, llenado: 0.3, inicio: 0.5 } },
  combinado_alto_riesgo: { entity: 'combinacion', params: { volumen: 75, crecimiento: 5, tono: 0.6, llenado: 0.3, inicio: 0.5 } },
  predominio_llenado: { entity: 'antimuscarinico', params: { volumen: 35, crecimiento: 2, tono: 0.3, llenado: 0.8, inicio: 0.5, farmaco: 'mirabegron' } },
  stui_y_disfuncion_erectil: { entity: 'tadalafilo', params: { volumen: 40, crecimiento: 3, tono: 0.5, llenado: 0.4, inicio: 0.5 } },
  nocturia_predominante: { entity: 'desmopresina', params: { volumen: 35, crecimiento: 2, tono: 0.3, llenado: 0.7, inicio: 0.5 } },
  prostata_pequena_tcp: { entity: 'tcp', params: { volumen: 25, crecimiento: 2, tono: 0.8, llenado: 0.3, inicio: 1 } },
  rtup_60g: { entity: 'rtup', params: { volumen: 60, crecimiento: 4, tono: 0.6, llenado: 0.3, inicio: 2 } },
  adenomectomia_120g: { entity: 'adenomectomia', params: { volumen: 120, crecimiento: 3, tono: 0.5, llenado: 0.3, inicio: 1 } },
  laser_anticoagulado: { entity: 'fotovaporizacion', params: { volumen: 55, crecimiento: 3, tono: 0.5, llenado: 0.3, inicio: 1 } },
  holmio_100g: { entity: 'holmio', params: { volumen: 100, crecimiento: 3, tono: 0.5, llenado: 0.3, inicio: 1 } },
  preservar_eyaculacion: { entity: 'minimamente_invasiva', params: { volumen: 45, crecimiento: 3, tono: 0.5, llenado: 0.3, inicio: 1 } },
};
