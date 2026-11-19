import test from 'node:test';
import assert from 'node:assert/strict';
import { ENTITIES, GAUGES, PRESETS, simulate, defaults, psaOf, obstruction, ipssClass } from '../src/model.js';
import { STR } from '../src/i18n.js';

const last = r => r.points[r.points.length - 1];
const at = (r, t) => r.points.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
const min = (r, g) => Math.min(...r.points.map(p => p.g[g]));
const max = (r, g) => Math.max(...r.points.map(p => p.g[g]));
const evs = r => r.events.map(e => e.key);

/* ---------- generic: every entity ---------- */
for (const e of ENTITIES) {
  test(`${e.key}: well-formed output (defaults, extremes, both arms)`, () => {
    const variants = [defaults(e.key)];
    for (const p of e.params.filter(q => q.type !== 'choice')) {
      variants.push({ ...defaults(e.key), [p.key]: p.min }, { ...defaults(e.key), [p.key]: p.max });
    }
    for (const p of e.params.filter(q => q.type === 'choice')) for (const o of p.options) variants.push({ ...defaults(e.key), [p.key]: o });
    for (const v of variants) for (const tr of [false, true]) {
      const r = simulate(e.key, v, tr);
      assert.equal(r.points.length, Math.round(e.tMax / e.dt) + 1);
      for (let i = 1; i < r.points.length; i++) assert.ok(r.points[i].t > r.points[i - 1].t);
      for (const pt of r.points) {
        for (const g of [...e.tiles, ...e.charts]) {
          assert.ok(Number.isFinite(pt.g[g]) && pt.g[g] >= 0, `${e.key} ${g}=${pt.g[g]}`);
          assert.ok(GAUGES[g], `gauge ${g} defined`);
        }
        for (const a of pt.active) assert.ok(e.steps.includes(a), `${e.key} unknown step ${a}`);
        assert.ok(pt.lesion >= 0 && pt.lesion <= 1);
      }
      for (const ev of r.events) assert.ok(ev.t >= 0 && ev.t <= e.tMax);
    }
  });
}

test('pure: same input → same output, params not mutated', () => {
  for (const e of ENTITIES) {
    const p = defaults(e.key); const copy = JSON.stringify(p);
    assert.deepEqual(simulate(e.key, p, true), simulate(e.key, p, true));
    assert.equal(JSON.stringify(p), copy);
  }
});

test('IPSS classes 0–7 / 8–19 / 20–35; PSA rises with volume; obstruction has a static and a dynamic part', () => {
  assert.deepEqual([ipssClass(7), ipssClass(8), ipssClass(19), ipssClass(20)], ['leve', 'moderado', 'moderado', 'grave']);
  assert.ok(psaOf(80) > psaOf(30));
  assert.ok(obstruction(25, 0.5) > 0 && obstruction(80, 0) > obstruction(40, 0));
});

test('i18n: every key used by the model exists in ES and EN', () => {
  for (const lang of ['es', 'en']) {
    const S = STR[lang];
    for (const e of ENTITIES) {
      const E = S.ent[e.key];
      for (const f of ['name', 'what', 'params', 'sees', 'tto']) assert.ok(E[f], `${lang} ${e.key}.${f}`);
      for (const st of e.steps) assert.ok(E.steps[st], `${lang} step ${e.key}.${st}`);
      for (const p of e.params) {
        assert.ok(S.params[p.key], `${lang} param ${p.key}`);
        if (p.type === 'choice') for (const o of p.options) assert.ok(S.choice[p.key][o], `${lang} choice ${p.key}.${o}`);
      }
      for (const g of [...e.tiles, ...e.charts]) assert.ok(S.gauges[g], `${lang} gauge ${g}`);
      assert.ok(S.units[e.unit]);
      for (const tr of [false, true]) {
        const r = simulate(e.key, defaults(e.key), tr);
        for (const ev of r.events) assert.equal(typeof S.ev[ev.key], 'function', `${lang} event ${ev.key}`);
        for (const pt of r.points) if (pt.badge) assert.ok(S.badge[pt.badge], `${lang} badge ${pt.badge}`);
      }
    }
    for (const k of Object.keys(PRESETS)) assert.ok(S.presets[k], `${lang} preset ${k}`);
  }
});

/* ---------- presets ---------- */
test('presets reference valid entities and parameters', () => {
  for (const [k, pr] of Object.entries(PRESETS)) {
    const e = ENTITIES.find(x => x.key === pr.entity);
    assert.ok(e, k);
    for (const pk of Object.keys(pr.params)) assert.ok(e.params.some(p => p.key === pk), `${k}.${pk}`);
    for (const ev of [...simulate(pr.entity, pr.params, false).events, ...simulate(pr.entity, pr.params, true).events]) {
      assert.equal(typeof STR.es.ev[ev.key], 'function', `${k} event ${ev.key}`);
    }
  }
});

/* ---------- mechanisms ---------- */
const run = (k, p = {}, tr = false) => simulate(k, p, tr);
const L = (r) => last(r).g;
const ev = (r, k) => r.events.find(e => e.key === k);

test('natural history: a growing gland moves through the Guyon stages (compensation → residual → distension) to retention and renal damage', () => {
  const r = run('vigilancia', PRESETS.combinado_alto_riesgo.params);
  const stages = r.points.map(p => p.g.guyon);
  assert.ok(stages[0] === 1 && Math.max(...stages) === 3);
  for (let i = 1; i < stages.length; i++) assert.ok(stages[i] >= stages[i - 1], 'stages do not go back untreated');
  assert.ok(ev(r, 'rao') && ev(r, 'rco') && L(r).qmax < 5);
  assert.ok(ev(run('vigilancia', { ...PRESETS.adenomectomia_120g.params }), 'insuf_renal'));
});

test('IPSS does not track prostate size: a small gland with storage symptoms scores higher than a larger quiet one', () => {
  const small = L(run('vigilancia', { volumen: 30, crecimiento: 0, tono: 0.3, llenado: 0.9 }));
  const big = L(run('vigilancia', { volumen: 55, crecimiento: 0, tono: 0.3, llenado: 0.05 }));
  assert.ok(big.vol > small.vol && small.ipss > big.ipss);
});

test('α-blocker: acts within days on the dynamic component, does not change PSA or size', () => {
  const p = PRESETS.alfa_prostata_pequena.params;
  const u = run('alfabloqueante', p), t = run('alfabloqueante', p, true);
  const i = t.points.findIndex(x => x.t >= p.inicio + 0.1);
  assert.ok(t.points[i].g.qmax > u.points[i].g.qmax + 2, 'Qmax improves within ~5 weeks');
  assert.ok(Math.abs(L(t).psa - L(u).psa) < 1e-9 && Math.abs(L(t).vol - L(u).vol) < 1e-9);
  assert.ok(ev(t, 'eyac_retrograda'));
});

test('5-ARI: shrinks the gland ~25 % over months, halves PSA growth, slows progression; effect is slow', () => {
  const p = PRESETS.ari_prostata_grande.params;
  const u = run('inhibidor_5ar', p), t = run('inhibidor_5ar', p, true);
  const at1m = t.points.find(x => x.t >= p.inicio + 0.1).g.vol, at1y = t.points.find(x => x.t >= p.inicio + 1).g.vol;
  assert.ok(at1y < at1m, 'keeps shrinking after the first month');
  assert.ok(L(t).vol < L(u).vol * 0.7 && L(t).psa < L(u).psa && L(t).guyon < L(u).guyon && !ev(t, 'rao'));
});

test('combination therapy prevents retention in a large growing gland', () => {
  const p = PRESETS.combinado_alto_riesgo.params;
  assert.ok(ev(run('combinacion', p), 'rao') && !ev(run('combinacion', p, true), 'rao'));
  assert.ok(L(run('combinacion', p, true)).ipss < L(run('alfabloqueante', p, true)).ipss);
});

test('antimuscarinic / mirabegron improve storage symptoms; desmopressin cuts nocturia but lowers sodium', () => {
  const a = run('antimuscarinico', PRESETS.predominio_llenado.params, true), u = run('antimuscarinico', PRESETS.predominio_llenado.params);
  assert.ok(L(a).ipssl < L(u).ipssl * 0.7 && L(a).ipssv === L(u).ipssv);
  const d = run('desmopresina', PRESETS.nocturia_predominante.params, true);
  assert.ok(L(d).nocturia < L(run('desmopresina', PRESETS.nocturia_predominante.params)).nocturia * 0.6 && L(d).na < 136);
});

test('surgery by gland size: TCP < 30 g, TURP 30–80 g, open adenomectomy > 80 g; outside the range → warning', () => {
  assert.ok(ev(run('tcp', PRESETS.prostata_pequena_tcp.params, true), 'cirugia'));
  assert.ok(ev(run('rtup', PRESETS.rtup_60g.params, true), 'cirugia'));
  assert.ok(ev(run('adenomectomia', PRESETS.adenomectomia_120g.params, true), 'cirugia'));
  assert.ok(ev(run('rtup', { volumen: 120 }, true), 'fuera_indicacion'));
  assert.ok(ev(run('tcp', { volumen: 60 }, true), 'fuera_indicacion'));
  assert.ok(ev(run('holmio', { volumen: 140 }, true), 'cirugia'), 'holmium enucleation fits any size');
  for (const k of ['rtup', 'adenomectomia', 'holmio', 'fotovaporizacion']) {
    const t = L(run(k, PRESETS.rtup_60g.params, true)), u = L(run(k, PRESETS.rtup_60g.params));
    assert.ok(t.qmax > 18 && t.ipss < 12 && t.psa < u.psa, k);
  }
  assert.ok(ev(run('tcp', {}, true), 'eyac_preservada') && ev(run('rtup', {}, true), 'aneyaculacion'));
});

test('surgery relieves the detrusor: residual urine falls and the Guyon stage drops to 0', () => {
  const t = run('adenomectomia', PRESETS.adenomectomia_120g.params, true);
  assert.ok(t.points[0].g.guyon >= 2 && L(t).guyon === 0 && L(t).rpm < 30);
});
