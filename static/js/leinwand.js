'use strict';

// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  material: null,
  length: 0,
  width: 0,
  wood: 'classic_double',
  anzLang: 0,
  anzKurz: 0,
  supportLabel: 'Kein Zwischenstück',
  markup: 4.2,
  manualOverride: false,
};

let lastResult = null;   // most recent API response

// ── DOM helpers ───────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const WOOD_LABELS = {
  classic_single: 'Classic Einfach',
  classic_double: 'Classic Doppel',
  museo:          'Museo 45',
};

// ── Support presets ───────────────────────────────────────────────────────────

const SUPPORT_LARGE  = [
  { label: 'Keine',                 lang: 0, kurz: 0 },
  { label: 'Eins',                  lang: 0, kurz: 1 },
  { label: 'Zwei (Kreuz)',          lang: 1, kurz: 1 },
  { label: 'Zwei (Parallel)',       lang: 0, kurz: 2 },
  { label: 'Drei (Doppelkreuz)',    lang: 1, kurz: 2 },
  { label: 'Vier (Viererkreuz)',    lang: 2, kurz: 2 },
  { label: 'Anderes…',             lang: null, kurz: null },
];
const SUPPORT_MEDIUM = [
  { label: 'Keine',        lang: 0, kurz: 0 },
  { label: 'Eins',         lang: 0, kurz: 1 },
  { label: 'Zwei (Kreuz)', lang: 1, kurz: 1 },
  { label: 'Anderes…',    lang: null, kurz: null },
];

function autoSupport(length, width) {
  if (length < 70)                     return { lang: 0, kurz: 0, label: 'Kein Zwischenstück' };
  if (length < 80)                     return { lang: 0, kurz: 0, label: 'Kein Zwischenstück' };
  if (length < 210 && width < 80)      return { lang: 0, kurz: 1, label: 'Eins' };
  if (length < 210)                    return { lang: 1, kurz: 1, label: 'Zwei (Kreuz)' };
  if (width < 80)                      return { lang: 0, kurz: 2, label: 'Zwei (Parallel)' };
  if (width < 210)                     return { lang: 1, kurz: 2, label: 'Drei (Doppelkreuz)' };
  return                                      { lang: 2, kurz: 2, label: 'Vier (Viererkreuz)' };
}

// ── SVG canvas preview ────────────────────────────────────────────────────────

function buildSVG(length, width, anzLang, anzKurz, wood, fabric) {
  const W = 480, H = 300, PAD = 46;
  const scale = Math.min((W - PAD*2) / length, (H - PAD*2) / width);
  const cW = length * scale, cH = width * scale;
  const cX = PAD + ((W - PAD*2) - cW) / 2;
  const cY = PAD + ((H - PAD*2) - cH) / 2;
  const depthCm = wood === 'museo' ? 4.5 : wood === 'classic_double' ? 3.6 : 1.8;
  const framePx = Math.max(4, Math.min(depthCm * scale * 0.55, 18));
  const fill  = fabric === 'Leinen' ? '#DDD0A8' : '#F8EDD4';
  const frame = '#7A5530', strut = '#5A3D20';

  const lines = [];
  for (let i = 1; i <= anzKurz; i++) {
    const x = cX + cW * i / (anzKurz + 1);
    lines.push(`<line x1="${x.toFixed(1)}" y1="${(cY+framePx).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(cY+cH-framePx).toFixed(1)}" stroke="${strut}" stroke-width="2.5" stroke-dasharray="7,5" opacity=".7"/>`);
  }
  for (let i = 1; i <= anzLang; i++) {
    const y = cY + cH * i / (anzLang + 1);
    lines.push(`<line x1="${(cX+framePx).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(cX+cW-framePx).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${strut}" stroke-width="2.5" stroke-dasharray="7,5" opacity=".7"/>`);
  }
  const mX = cX + cW/2, mY = cY + cH/2;
  const aY = cY - 18, aX = cX - 22;
  const corners = [0,1].flatMap(xi => [0,1].map(yi =>
    `<rect x="${(cX+xi*cW-(xi?framePx:0)).toFixed(1)}" y="${(cY+yi*cH-(yi?framePx:0)).toFixed(1)}" width="${framePx.toFixed(1)}" height="${framePx.toFixed(1)}" fill="${frame}" opacity=".5"/>`
  ));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" style="max-height:280px;display:block">
  <defs>
    <marker id="ah" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M1,1L6,3.5L1,6Z" fill="#aaa"/></marker>
    <marker id="ah2" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto-start-reverse"><path d="M1,1L6,3.5L1,6Z" fill="#aaa"/></marker>
    <filter id="sh"><feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="#0003"/></filter>
  </defs>
  <line x1="${(cX+2).toFixed(1)}" y1="${aY}" x2="${(cX+cW-2).toFixed(1)}" y2="${aY}" stroke="#bbb" stroke-width="1" marker-start="url(#ah2)" marker-end="url(#ah)"/>
  <text x="${mX.toFixed(1)}" y="${(aY-5).toFixed(1)}" text-anchor="middle" fill="#999" font-size="12" font-family="system-ui">${length} cm</text>
  <line x1="${aX}" y1="${(cY+2).toFixed(1)}" x2="${aX}" y2="${(cY+cH-2).toFixed(1)}" stroke="#bbb" stroke-width="1" marker-start="url(#ah2)" marker-end="url(#ah)"/>
  <text x="${(aX-6).toFixed(1)}" y="${mY.toFixed(1)}" text-anchor="middle" fill="#999" font-size="12" font-family="system-ui" transform="rotate(-90,${(aX-6).toFixed(1)},${mY.toFixed(1)})">${width} cm</text>
  <rect x="${cX.toFixed(1)}" y="${cY.toFixed(1)}" width="${cW.toFixed(1)}" height="${cH.toFixed(1)}" fill="${fill}" rx="2" filter="url(#sh)"/>
  ${lines.join('\n  ')}
  <rect x="${cX.toFixed(1)}" y="${cY.toFixed(1)}" width="${cW.toFixed(1)}" height="${cH.toFixed(1)}" fill="none" stroke="${frame}" stroke-width="${framePx.toFixed(1)}" rx="2"/>
  ${corners.join('\n  ')}
  <text x="${(cX+cW-6).toFixed(1)}" y="${(cY+cH-6).toFixed(1)}" text-anchor="end" fill="${frame}" font-size="10" font-family="system-ui" opacity=".6">${WOOD_LABELS[wood]}</text>
</svg>`;
}

// ── Material buttons ──────────────────────────────────────────────────────────

document.querySelectorAll('.btn-material').forEach(btn =>
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-material').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.material = btn.dataset.val;
    checkLeinenWarning();
    updatePreview();
    triggerCalc();
  })
);

// ── Dimensions ────────────────────────────────────────────────────────────────

const debouncedInput = debounce(() => {
  normalizeDimensions();
  updateSupportAuto();
  updatePreview();
  triggerCalc();
}, 350);

$('inp-length').addEventListener('input', debouncedInput);
$('inp-width').addEventListener('input', debouncedInput);

function normalizeDimensions() {
  let l = parseFloat($('inp-length').value) || 0;
  let w = parseFloat($('inp-width').value) || 0;
  if (l > 0 && w > 0 && l < w) {
    [l, w] = [w, l];
    $('inp-length').value = l;
    $('inp-width').value  = w;
  }
  state.length = l;
  state.width  = w;
  const info = $('dim-info');
  info.innerHTML = (l > 0 && w > 0)
    ? `<i class="bi bi-info-circle me-1"></i>${l} × ${w} cm &nbsp;=&nbsp; <strong>${(l*w/10000).toFixed(2)} m²</strong>`
    : '';
  checkLeinenWarning();
}

function checkLeinenWarning() {
  $('alert-leinen').classList.toggle('d-none', !(state.material === 'Leinen' && state.width > 180));
}

// ── Preset buttons ────────────────────────────────────────────────────────────

document.querySelectorAll('.preset-btn').forEach(btn =>
  btn.addEventListener('click', () => {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const l = parseInt(btn.dataset.l), w = parseInt(btn.dataset.w);
    $('inp-length').value = Math.max(l, w);
    $('inp-width').value  = Math.min(l, w);
    normalizeDimensions();
    updateSupportAuto();
    updatePreview();
    triggerCalc();
  })
);

// ── Wood buttons ──────────────────────────────────────────────────────────────

document.querySelectorAll('.btn-wood').forEach(btn =>
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-wood').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.wood = btn.dataset.val;
    updatePreview();
    triggerCalc();
  })
);

// ── Support ───────────────────────────────────────────────────────────────────

let _lastSupportLen = -1;

function updateSupportAuto() {
  const { length, width } = state;
  if (!length || !width) return;
  const rec = autoSupport(length, width);
  if (!state.manualOverride) {
    state.anzLang      = rec.lang;
    state.anzKurz      = rec.kurz;
    state.supportLabel = rec.label;
  }
  $('support-auto-badge').textContent = rec.label;
  if (length !== _lastSupportLen) {
    _lastSupportLen = length;
    buildSupportRadios(length >= 210 ? SUPPORT_LARGE : SUPPORT_MEDIUM, rec);
  }
}

function buildSupportRadios(options, recommended) {
  const group = $('support-radio-group');
  group.innerHTML = '';
  options.forEach((opt, i) => {
    const isRec = recommended && opt.lang === recommended.lang && opt.kurz === recommended.kurz;
    const div = document.createElement('div');
    div.className = 'form-check';
    div.innerHTML = `
      <input class="form-check-input support-radio" type="radio" name="sup-m" id="sr-${i}" value="${i}">
      <label class="form-check-label" for="sr-${i}">
        ${opt.label}${isRec ? ' <span class="badge bg-success-subtle text-success ms-1 small">empfohlen</span>' : ''}
      </label>`;
    div.querySelector('.support-radio').addEventListener('change', () => {
      const isCustom = opt.lang === null;
      $('custom-support-inputs').classList.toggle('d-none', !isCustom);
      if (!isCustom) {
        state.anzLang = opt.lang; state.anzKurz = opt.kurz; state.supportLabel = opt.label;
        updatePreview(); triggerCalc();
      } else { readCustomSupport(); }
    });
    group.appendChild(div);
  });
}

$('support-override-toggle').addEventListener('change', e => {
  state.manualOverride = e.target.checked;
  $('support-manual').classList.toggle('d-none', !e.target.checked);
  if (!e.target.checked) { updateSupportAuto(); updatePreview(); triggerCalc(); }
});

['custom-kurz','custom-lang'].forEach(id =>
  $(id)?.addEventListener('input', () => { readCustomSupport(); updatePreview(); triggerCalc(); })
);
function readCustomSupport() {
  state.anzKurz = parseInt($('custom-kurz').value) || 0;
  state.anzLang = parseInt($('custom-lang').value) || 0;
  state.supportLabel = `${state.anzLang + state.anzKurz} Strebe(n)`;
}

// ── Markup slider ─────────────────────────────────────────────────────────────

$('markup-slider').addEventListener('input', e => {
  state.markup = parseFloat(e.target.value);
  $('markup-display').textContent = `× ${state.markup.toFixed(1)}`;
  triggerCalc();
});

// ── Preview ───────────────────────────────────────────────────────────────────

function updatePreview() {
  const box = $('canvas-preview');
  if (!state.length || !state.width) { box.innerHTML = '<span class="text-secondary small">Masse eingeben…</span>'; return; }
  box.innerHTML = buildSVG(state.length, state.width, state.anzLang, state.anzKurz, state.wood, state.material || 'Baumwolle');
}

// ── Main API call ─────────────────────────────────────────────────────────────

const triggerCalc = debounce(async () => {
  if (!state.material || !state.length || !state.width) return;
  $('result-loading').classList.remove('d-none');
  $('result-placeholder').classList.add('d-none');
  try {
    const res = await fetch('/api/calculate/canvas', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        length: state.length, width: state.width,
        fabric_type: state.material, wood_type: state.wood,
        anz_strebe_lang: state.anzLang, anz_strebe_kurz: state.anzKurz,
        markup_factor: state.markup,
      }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    lastResult = data;
    renderResult(data);
    $('result-error').classList.add('d-none');
    $('compare-panel').classList.add('d-none');
  } catch(e) {
    $('result-content').classList.add('d-none');
    $('result-error').textContent = 'Fehler: ' + e.message;
    $('result-error').classList.remove('d-none');
  } finally {
    $('result-loading').classList.add('d-none');
  }
}, 350);

function renderResult(data) {
  const tbody = $('result-tbody');
  tbody.innerHTML = '';
  data.rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="small">${row.produkt}</td><td class="small text-secondary">${row.stueckpreis}</td><td class="small text-secondary">${row.anzahl}</td><td class="text-end fw-semibold font-monospace">${row.betrag}</td>`;
    tbody.appendChild(tr);
  });
  $('res-material').textContent    = `${data.total_material} CHF`;
  $('res-markup-label').textContent = `× ${state.markup.toFixed(1)}`;
  $('res-verkauf').textContent      = data.verkaufspreis;

  // Show MwSt by default
  $('chk-mwst').checked = true;
  $('mwst-details').classList.remove('d-none');
  {
    const v      = parseFloat(data.verkaufspreis);
    const mwst   = Math.round(v * 0.081 * 20) / 20;
    const brutto = Math.round((v + mwst) * 20) / 20;
    $('res-mwst').textContent   = `${mwst.toFixed(2)} CHF`;
    $('res-brutto').textContent = `${brutto.toFixed(2)} CHF`;
  }

  // Show action buttons
  ['btn-add-order','btn-compare','btn-chart','btn-copy','btn-print-single'].forEach(id =>
    $(id).classList.remove('d-none'));

  $('result-content').classList.remove('d-none');

  // History & stats
  saveToHistory();
  logCalc();
  renderHistory();

  // Refresh chart if already visible
  if ($('chart-panel') && !$('chart-panel').classList.contains('d-none')) loadChartData();
}

// ── MwSt ─────────────────────────────────────────────────────────────────────

$('chk-mwst').addEventListener('change', () => {
  const on = $('chk-mwst').checked;
  $('mwst-details').classList.toggle('d-none', !on);
  if (on && lastResult) {
    const v = parseFloat(lastResult.verkaufspreis);
    const mwst  = Math.round(v * 0.081 * 20) / 20;
    const brutto = Math.round((v + mwst) * 20) / 20;
    $('res-mwst').textContent   = `${mwst.toFixed(2)} CHF`;
    $('res-brutto').textContent = `${brutto.toFixed(2)} CHF`;
  }
  ORDER.renderPanel(); // keep order total in sync if order is open
});

// ── Copy to clipboard ─────────────────────────────────────────────────────────

$('btn-copy').addEventListener('click', () => {
  if (!lastResult) return;
  const txt = `${state.length}×${state.width} cm — ${state.material}, ${WOOD_LABELS[state.wood]}, ${state.supportLabel} — ${lastResult.verkaufspreis} CHF`;
  navigator.clipboard.writeText(txt).then(() => {
    const btn = $('btn-copy');
    btn.innerHTML = '<i class="bi bi-check me-1"></i>Kopiert!';
    btn.classList.replace('btn-outline-secondary', 'btn-secondary');
    setTimeout(() => {
      btn.innerHTML = '<i class="bi bi-clipboard me-1"></i>Kopieren';
      btn.classList.replace('btn-secondary', 'btn-outline-secondary');
    }, 1800);
  });
});

// ── Print single invoice ──────────────────────────────────────────────────────

$('btn-print-single').addEventListener('click', () => generateInvoicePDF());

// ── Frame comparison ──────────────────────────────────────────────────────────

$('btn-compare').addEventListener('click', async () => {
  if (!state.material || !state.length || !state.width) return;
  const panel = $('compare-panel');
  // Toggle off if already open
  if (!panel.classList.contains('d-none')) { panel.classList.add('d-none'); return; }
  panel.classList.remove('d-none');
  $('compare-loading').classList.remove('d-none');
  $('compare-tbody').innerHTML = '';
  try {
    const res = await fetch('/api/compare/canvas', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        length: state.length, width: state.width,
        fabric_type: state.material, markup_factor: state.markup,
      }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    const tbody = $('compare-tbody');
    data.comparisons.forEach(c => {
      const isActive = c.wood_key === state.wood;
      const tr = document.createElement('tr');
      if (isActive) tr.className = 'table-primary';
      tr.innerHTML = `
        <td class="fw-semibold small">${c.wood_label}${isActive ? ' <span class="badge bg-primary ms-1">aktuell</span>' : ''}</td>
        <td class="text-end font-monospace small">${c.total_material} CHF</td>
        <td class="text-end font-monospace fw-bold">${c.verkaufspreis} CHF</td>`;
      tbody.appendChild(tr);
    });
  } catch(e) {
    $('compare-tbody').innerHTML = `<tr><td colspan="3" class="text-danger small">Fehler: ${e.message}</td></tr>`;
  } finally {
    $('compare-loading').classList.add('d-none');
  }
});

// ── Order panel ───────────────────────────────────────────────────────────────

$('btn-add-order').addEventListener('click', () => {
  if (!lastResult) return;
  ORDER.addItem({
    type:    'canvas',
    size:    `${state.length}×${state.width}`,
    fabric:  state.material,
    wood:    WOOD_LABELS[state.wood],
    support: state.supportLabel,
    verkauf: parseFloat(lastResult.verkaufspreis),
    mwst:    $('chk-mwst').checked,
  });
  // Flash feedback
  const btn = $('btn-add-order');
  btn.innerHTML = '<i class="bi bi-check me-1"></i>Hinzugefügt!';
  btn.classList.replace('btn-success', 'btn-secondary');
  setTimeout(() => {
    btn.innerHTML = '<i class="bi bi-plus-circle me-1"></i>Zur Bestellung';
    btn.classList.replace('btn-secondary', 'btn-success');
  }, 1500);
});

// ── History ───────────────────────────────────────────────────────────────────

function saveToHistory() {
  if (!lastResult) return;
  const entry = {
    ts:      new Date().toLocaleString('de-CH', {hour:'2-digit', minute:'2-digit'}),
    size:    `${state.length}×${state.width}`,
    fabric:  state.material,
    wood:    WOOD_LABELS[state.wood],
    support: state.supportLabel,
    markup:  state.markup,
    verkauf: lastResult.verkaufspreis,
    // Restore state
    _state: {
      material: state.material, length: state.length, width: state.width,
      wood: state.wood, anzLang: state.anzLang, anzKurz: state.anzKurz,
      markup: state.markup, supportLabel: state.supportLabel,
    },
  };
  let hist = JSON.parse(localStorage.getItem('wa_history') || '[]');
  hist.unshift(entry);
  if (hist.length > 50) hist = hist.slice(0, 50);
  localStorage.setItem('wa_history', JSON.stringify(hist));
}

function renderHistory() {
  const list = $('history-list');
  const hist = JSON.parse(localStorage.getItem('wa_history') || '[]');
  list.innerHTML = '';
  if (hist.length === 0) {
    list.innerHTML = '<span class="text-secondary small">Noch keine Berechnungen.</span>';
    return;
  }
  hist.forEach(entry => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline-secondary btn-sm history-chip';
    btn.innerHTML = `<span class="text-secondary x-small me-1">${entry.ts}</span> ${entry.size} cm · ${entry.fabric} · ${entry.wood} <strong>${entry.verkauf} CHF</strong>`;
    btn.addEventListener('click', () => restoreFromHistory(entry));
    list.appendChild(btn);
  });
}

function restoreFromHistory(entry) {
  const s = entry._state;
  // Restore material
  document.querySelectorAll('.btn-material').forEach(b => b.classList.toggle('active', b.dataset.val === s.material));
  state.material = s.material;
  // Restore dimensions
  $('inp-length').value = s.length; $('inp-width').value = s.width;
  // Restore wood
  document.querySelectorAll('.btn-wood').forEach(b => b.classList.toggle('active', b.dataset.val === s.wood));
  state.wood = s.wood;
  // Restore markup
  $('markup-slider').value = s.markup; $('markup-display').textContent = `× ${parseFloat(s.markup).toFixed(1)}`;
  // Restore support
  state.anzLang = s.anzLang; state.anzKurz = s.anzKurz; state.supportLabel = s.supportLabel;
  Object.assign(state, s);
  normalizeDimensions();
  updateSupportAuto();
  updatePreview();
  triggerCalc();
  window.scrollTo({top: 0, behavior: 'smooth'});
}

// ── Reset ─────────────────────────────────────────────────────────────────────

$('btn-reset').addEventListener('click', () => {
  document.querySelectorAll('.btn-material, .preset-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.btn-wood').forEach(b => b.classList.toggle('active', b.dataset.val === 'classic_double'));
  $('inp-length').value = ''; $('inp-width').value = '';
  $('support-override-toggle').checked = false;
  $('support-manual').classList.add('d-none');
  $('markup-slider').value = 4.2; $('markup-display').textContent = '× 4.2';
  $('alert-leinen').classList.add('d-none');
  $('dim-info').textContent = '';
  $('canvas-preview').innerHTML = '<span class="text-secondary small">Masse eingeben…</span>';
  $('result-placeholder').classList.remove('d-none');
  $('result-content').classList.add('d-none');
  $('result-error').classList.add('d-none');
  $('support-auto-badge').textContent = '— cm eingeben';
  $('compare-panel').classList.add('d-none');
  if ($('chart-panel')) $('chart-panel').classList.add('d-none');
  if (priceChart) { priceChart.destroy(); priceChart = null; }
  Object.assign(state, { material: null, length: 0, width: 0, wood: 'classic_double',
    anzLang: 0, anzKurz: 0, supportLabel: 'Kein Zwischenstück', markup: 4.2, manualOverride: false });
  _lastSupportLen = -1;
  lastResult = null;
});

// ── Calc log (for Statistik page) ────────────────────────────────────────────

function logCalc() {
  if (!lastResult) return;
  const entry = {
    ts:           Date.now(),
    size:         `${state.length}×${state.width}`,
    area_m2:      Math.round(state.length * state.width) / 10000,
    fabric:       state.material,
    wood:         state.wood,
    markup:       state.markup,
    material_cost: parseFloat(lastResult.total_material),
    verkaufspreis: parseFloat(lastResult.verkaufspreis),
  };
  let log = JSON.parse(localStorage.getItem('wa_calc_log') || '[]');
  log.unshift(entry);
  if (log.length > 200) log = log.slice(0, 200);
  localStorage.setItem('wa_calc_log', JSON.stringify(log));
}

// ── PDF invoice (jsPDF) ───────────────────────────────────────────────────────

function generateInvoicePDF() {
  if (!window.jspdf) { alert('PDF-Bibliothek noch nicht geladen — bitte kurz warten.'); return; }
  if (!lastResult) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const W = 210, ML = 15, MR = 15;
  let Y = ORDER.drawPDFHeader(doc, W, ML, MR);

  // Title
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(30);
  doc.text(`Leinwand ${state.length}×${state.width} cm`, ML, Y); Y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100);
  doc.text(`${state.material}  ·  ${WOOD_LABELS[state.wood]}  ·  ${state.supportLabel}`, ML, Y); Y += 8;

  // Calc table
  const tableBody = lastResult.rows.map(r => [r.produkt, r.stueckpreis, r.anzahl, r.betrag + ' CHF']);
  doc.autoTable({
    startY: Y,
    head: [['Posten', 'Einheitspreis', 'Menge', 'CHF']],
    body: tableBody,
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [35, 35, 35], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: ML, right: MR },
  });
  Y = doc.lastAutoTable.finalY + 6;

  // Summary
  const cR = W - MR, cL = cR - 68;
  doc.setDrawColor(210); doc.line(cL - 4, Y, cR, Y); Y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120);
  doc.text('Materialpreis', cL, Y);
  doc.text(`CHF ${lastResult.total_material}`, cR, Y, { align: 'right' }); Y += 5.5;
  doc.text(`Aufschlag ×${state.markup.toFixed(1)}`, cL, Y); Y += 5.5;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(20);
  doc.text('Verkaufspreis', cL, Y);
  doc.text(`CHF ${lastResult.verkaufspreis}`, cR, Y, { align: 'right' }); Y += 7;

  if ($('chk-mwst').checked) {
    const v = parseFloat(lastResult.verkaufspreis);
    const mwst   = Math.round(v * 0.081 * 20) / 20;
    const brutto = Math.round((v + mwst)  * 20) / 20;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120);
    doc.text('MwSt 8.1%', cL, Y);
    doc.text(`CHF ${mwst.toFixed(2)}`, cR, Y, { align: 'right' }); Y += 5.5;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(20);
    doc.text('Total (inkl. MwSt)', cL, Y);
    doc.text(`CHF ${brutto.toFixed(2)}`, cR, Y, { align: 'right' });
  }

  ORDER.drawPDFFooter(doc, W, ML, MR);

  const today = new Date().toLocaleDateString('de-CH');
  doc.save(`Offerte_${state.length}x${state.width}_${state.material}_${today.replace(/\./g, '-')}.pdf`);
}

// ── Price curve chart ─────────────────────────────────────────────────────────

let priceChart = null;

async function loadChartData() {
  if (!lastResult) return;
  $('chart-loading').classList.remove('d-none');
  try {
    const res  = await fetch(`/api/chart-data?fabric=${encodeURIComponent(state.material)}&wood=${state.wood}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    const pts    = data.points;
    const curX   = Math.round(state.length * state.width) / 10000;
    const curY   = parseFloat(lastResult.verkaufspreis);

    const ctx = $('price-chart').getContext('2d');
    if (priceChart) priceChart.destroy();

    priceChart = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: `Standardformate (${state.material}, ${WOOD_LABELS[state.wood]})`,
            data: pts.map(p => ({ x: p.area_m2, y: p.price, label: p.label })),
            backgroundColor: 'rgba(13,110,253,0.55)',
            borderColor:     'rgba(13,110,253,0.85)',
            pointRadius: 5, pointHoverRadius: 7,
            showLine: true, borderWidth: 1.5, tension: 0.25,
          },
          {
            label: `Aktuelle Leinwand ${state.length}×${state.width} cm`,
            data: [{ x: curX, y: curY, label: `${state.length}×${state.width} cm` }],
            backgroundColor: 'rgba(220,53,69,0.9)',
            borderColor:     'rgba(220,53,69,1)',
            pointRadius: 10, pointHoverRadius: 12,
            pointStyle: 'circle',
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 14 } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const d = ctx.raw;
                return `${d.label || ''}: CHF ${d.y.toFixed(2)} (${d.x.toFixed(3)} m²)`;
              },
            },
          },
        },
        scales: {
          x: { title: { display: true, text: 'Fläche (m²)', font: { size: 11 } }, ticks: { font: { size: 10 } } },
          y: { title: { display: true, text: 'Verkaufspreis (CHF)', font: { size: 11 } }, ticks: { font: { size: 10 } } },
        },
      },
    });
  } catch (e) {
    $('price-chart').insertAdjacentHTML('beforebegin',
      `<div class="text-danger small py-1">Fehler: ${e.message}</div>`);
  } finally {
    $('chart-loading').classList.add('d-none');
  }
}

$('btn-chart') && $('btn-chart').addEventListener('click', () => {
  const panel = $('chart-panel');
  if (!panel.classList.contains('d-none')) {
    panel.classList.add('d-none');
    return;
  }
  panel.classList.remove('d-none');
  loadChartData();
});

// ── Init ──────────────────────────────────────────────────────────────────────

renderHistory();
