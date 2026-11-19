// Schematic: bladder (size = residual urine, wall = detrusor hypertrophy, diverticulum when decompensated),
// prostate with a fixed peripheral zone and a growing transition zone (hollow after surgery), the prostatic
// urethra narrowing with obstruction, α1 receptors fading under α-blockade, and both kidneys dilating when
// chronic retention damages the upper tract.
export function drawSchematic(box, e, pt, tr) {
  const g = pt.g;
  const cx = 200;
  const rb = 44 + Math.min(26, g.rpm / 14);
  const by = 14 + rb;
  const comp = Math.min(1, Math.max(0, (g.ob - 0.3) / 0.6));
  const wall = 2 + 7 * comp * (1 - 0.6 * g.dec);
  const rz = Math.min(52, 26 * Math.cbrt(g.vol / 25));
  const ryOut = rz * 0.6 + 18;
  const py = by + rb + ryOut - 12;
  const lumen = Math.max(2, 10 - 7 * Math.min(1, g.ob / 1.2));
  const hydro = Math.min(1, Math.max(0, (g.cr - 0.95) / 0.8));
  // kidneys either side of the bladder; the pelvis dilates with hydronephrosis
  const kid = (x, flip) => `
    <g transform="translate(${x} 14) scale(${flip ? -0.62 : 0.62} 0.62)">
      <path d="M0 0 q-34 0 -34 46 q0 46 34 46 q12 0 12 -18 q-10 -8 -10 -28 q0 -20 10 -28 q0 -18 -12 -18z" fill="var(--tissue)" stroke="${hydro > 0.05 ? 'var(--hot)' : 'var(--tissue-line)'}" stroke-width="${hydro > 0.05 ? 3 : 2}"/>
      <ellipse cx="-2" cy="46" rx="${4 + 14 * hydro}" ry="${6 + 22 * hydro}" fill="var(--cyst)" stroke="var(--tissue-line)"/>
    </g>
    <path d="M${x} ${14 + 0.62 * 60} C ${x} ${by}, ${x} ${by}, ${flip ? cx + rb * 0.9 : cx - rb * 0.9} ${by + 6}" fill="none" stroke="var(--tissue-line)" stroke-width="${1.5 + 3 * hydro}"/>`;
  const dots = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * 2 * Math.PI;
    return `<circle cx="${cx + Math.cos(a) * (rz + 10)}" cy="${py + Math.sin(a) * (rz * 0.6 + 8)}" r="3.2" fill="var(--s2)" opacity="${(1 - g.alfa) * 0.9 + 0.08}"/>`;
  }).join('');
  const cav = g.cav > 0.05;
  box.innerHTML = `
<svg viewBox="0 0 700 260" role="img" aria-label="${tr('schem.aria')}">
  ${kid(cx - 130, false)}${kid(cx + 130, true)}
  <text x="430" y="198" style="font-size:11px" class="${hydro > 0.05 ? 'lbl-on' : ''}">${tr('schem.rinon')} · Cr ${g.cr.toFixed(2)}</text>
  <circle cx="${cx}" cy="${by}" r="${rb}" fill="var(--cyst)" stroke="var(--tissue-line)" stroke-width="${wall}"/>
  ${comp > 0.2 ? `<circle cx="${cx}" cy="${by}" r="${rb - wall - 3}" fill="none" stroke="var(--tissue-line)" stroke-dasharray="3 5" opacity="0.7"/>` : ''}
  ${g.dec > 0.6 ? `<circle cx="${cx - rb - 8}" cy="${by + 10}" r="12" fill="var(--cyst)" stroke="var(--hot)" stroke-width="1.5"/>` : ''}
  <text x="${cx}" y="${by - 4}" text-anchor="middle" style="font-size:12px;font-weight:700;fill:var(--ink)">${tr('schem.vejiga')}</text>
  <text x="${cx}" y="${by + 12}" text-anchor="middle" style="font-size:11px">${Math.round(g.rpm)} mL</text>
  <ellipse cx="${cx}" cy="${py}" rx="${rz + 24}" ry="${ryOut}" fill="var(--tissue)" stroke="var(--tissue-line)" stroke-width="1.5"/>
  <ellipse cx="${cx}" cy="${py}" rx="${rz}" ry="${rz * 0.6}" fill="${cav ? 'var(--surface)' : 'var(--hot-bg)'}" stroke="var(--hot)" stroke-width="2" stroke-dasharray="${cav ? '5 4' : ''}"/>
  ${dots}
  <rect x="${cx - lumen / 2}" y="${by + rb - 2}" width="${lumen}" height="${Math.min(258, py + ryOut + 14) - (by + rb - 2)}" fill="var(--s1)" opacity="0.55"/>
  <text x="${cx + rz + 34}" y="${py - 6}" style="font-size:11px" class="lbl-on">${cav ? tr('schem.cavidad') : tr('schem.transicional')} · ${Math.round(g.vol)} g</text>
  <text x="${cx + rz + 34}" y="${py + 10}" style="font-size:11px">${tr('schem.periferica')}</text>
  <text x="${cx - rz - 34}" y="${py + 4}" text-anchor="end" style="font-size:11px">${tr('schem.uretra')}</text>
  ${g.alfa > 0.3 ? `<text x="${cx - rz - 34}" y="${py - 14}" text-anchor="end" style="font-size:11px;fill:var(--s1);font-weight:700">${tr('schem.alfa')}</text>` : ''}
  ${g.ari > 0.05 ? `<text x="${cx - rz - 34}" y="${py + 22}" text-anchor="end" style="font-size:11px;fill:var(--s1);font-weight:700">${tr('schem.ari')}</text>` : ''}
  <text x="430" y="218" style="font-size:13px;font-weight:700;fill:var(--ink)">${tr('schem.guyon')} ${Math.round(g.guyon)} · IPSS ${Math.round(g.ipss)}</text>
  <text x="430" y="238" style="font-size:12px">Qmax ${g.qmax.toFixed(1)} mL/s · PSA ${g.psa.toFixed(1)} ng/mL</text>
</svg>`;
}
