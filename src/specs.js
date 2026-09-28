// Spec rows: a side-by-side "before → now" comparison with the previous phone.
// Bars are linear against the larger of the two values, so the jump reads at a glance
// (16 GB vs 256 GB really does look sixteen times longer).

const ROWS = [
  { key: 'processor', label: 'Processor', value: (p) => p.specs.processor?.coresGhz ?? null, text: (p) => p.specs.processor?.label ?? null, note: 'cores × clock speed' },
  { key: 'camera', label: 'Main camera', value: (p) => p.specs.cameraMp ?? null, text: (p) => p.specs.cameraLabel ?? null },
  { key: 'ram', label: 'RAM', value: (p) => p.specs.ramMb ?? null, text: (p) => (p.specs.ramMb ? fmtMb(p.specs.ramMb) : null) },
  { key: 'battery', label: 'Battery', value: (p) => p.specs.batteryMah ?? null, text: (p) => (p.specs.batteryMah ? `${p.specs.batteryMah.toLocaleString('en')} mAh` : null) },
  {
    key: 'storage', label: 'Storage', value: (p) => p.specs.storageMb ?? null,
    text: (p) => (p.specs.storageMb ? fmtMb(p.specs.storageMb) + (p.specs.cardMb ? ` <small>+ ${fmtMb(p.specs.cardMb)} card</small>` : '') : null),
  },
];

export function fmtMb(mb) {
  if (mb == null) return '—';
  if (mb >= 1024) return `${+(mb / 1024).toFixed(mb % 1024 ? 1 : 0)} GB`;
  return `${mb} MB`;
}

function fmtX(r) {
  if (r >= 10) return `${Math.round(r)}×`;
  return `${+r.toFixed(r >= 1 ? 1 : 2)}×`;
}

function line(p, row, width, cls) {
  const t = row.text(p);
  return `
    <div class="cmp ${cls}">
      <div class="cmp-top"><span class="who">${p.name}</span><span class="val">${t ?? '<span class="na">not published</span>'}</span></div>
      <div class="track"><b style="width:${t == null ? 0 : Math.max(width, 3)}%"></b></div>
    </div>`;
}

/** Build HTML for the spec rows of `phone`, given all personal phones in order. */
export function specRowsHtml(phone, all) {
  const i = all.findIndex((p) => p.id === phone.id);
  const prev = i > 0 ? all[i - 1] : null;
  return ROWS.map((row) => {
    const v = row.value(phone);
    const pv = prev ? row.value(prev) : null;
    const max = Math.max(v ?? 0, pv ?? 0) || 1;
    let jump = '';
    if (v != null && pv != null) {
      const r = v / pv;
      jump = r >= 1.05
        ? `<span class="jump up" title="vs ${prev.name}">▲ ${fmtX(r)}</span>`
        : r <= 0.95
          ? `<span class="jump down" title="vs ${prev.name}">▼ ${fmtX(r)}</span>`
          : `<span class="jump same" title="vs ${prev.name}">same</span>`;
    }
    return `
      <div class="spec-row" data-spec="${row.key}">
        <div class="spec-head"><span class="spec-label">${row.label}${row.note ? ` <em>${row.note}</em>` : ''}</span>${jump}</div>
        ${prev ? line(prev, row, pv != null ? (pv / max) * 100 : 0, 'prev') : ''}
        ${line(phone, row, v != null ? (v / max) * 100 : 0, 'cur')}
      </div>`;
  }).join('');
}

export const SPEC_KEYS = ROWS.map((r) => r.key);
