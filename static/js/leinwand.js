'use strict';

// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  material: null,      // "Baumwolle" | "Leinen"
  length: 0,
  width: 0,
  wood: 'classic_double',
  anzLang: 0,
  anzKurz: 0,
  markup: 4.2,
  manualOverride: false,
};

// ── DOM helpers ───────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// ── Support presets ───────────────────────────────────────────────────────────

const SUPPORT_OPTIONS_LARGE = [
  { label: 'Keine',                  lang: 0, kurz: 0 },
  { label: 'Eins',                   lang: 0, kurz: 1 },
  { label: 'Zwei (Kreuz)',           lang: 1, kurz: 1 },
  { label: 'Zwei (Parallel)',        lang: 0, kurz: 2 },
  { label: 'Drei (Doppelkreuz)',     lang: 1, kurz: 2 },
  { label: 'Vier (Viererkreuz)',     lang: 2, kurz: 2 },
  { label: 'Anderes…',              lang: null, kurz: null },
];
const SUPPORT_OPTIONS_MEDIUM = [
  { label: 'Keine',        lang: 0, kurz: 0 },
  { label: 'Eins',         lang: 0, kurz: 1 },
  { label: 'Zwei (Kreuz)', lang: 1, kurz: 1 },
  { label: 'Anderes…',    lang: null, kurz: null },
];

function autoSupport(length, width) {
  if (length < 70)                                         return { lang: 0, kurz: 0, label: 'Kein Zwischenstück' };
  if (length < 80)                                         return { lang: 0, kurz: 0, label: 'Kein Zwischenstück (empfohlen)' };
  if (length < 210 && width < 80)                         return { lang: 0, kurz: 1, label: 'Eins' };
  if (length < 210 && width >= 80)                        return { lang: 1, kurz: 1, label: 'Zwei (Kreuz)' };
  if (length >= 210 && width < 80)                        return { lang: 0, kurz: 2, label: 'Zwei (Parallel)' };
  if (length >= 210 && width >= 80 && width < 210)        return { lang: 1, kurz: 2, label: 'Drei (Doppelkreuz)' };
  if (length >= 210 && width >= 210)                      return { lang: 2, kurz: 2, label: 'Vier (Viererkreuz)' };
  return { lang: 0, kurz: 0, label: 'Kein Zwischenstück' };
}

// ── Canvas SVG ────────────────────────────────────────────────────────────────

function buildSVG(length, width, anzLang, anzKurz, wood, fabric) {
  const W = 480, H = 300, PAD = 46;
  const availW = W - PAD * 2, availH = H - PAD * 2;
  const scale = Math.min(availW / length, availH / width);
  const cW = length * scale, cH = width * scale;
  const cX = PAD + (availW - cW) / 2;
  const cY = PAD + (availH - cH) / 2;

  const depthCm = wood === 'museo' ? 4.5 : wood === 'classic_double' ? 3.6 : 1.8;
  const framePx = Math.max(4, Math.min(depthCm * scale * 0.55, 18));

  const fabricFill  = fabric === 'Leinen' ? '#DDD0A8' : '#F8EDD4';
  const frameColor  = '#7A5530';
  const strutColor  = '#5A3D20';

  const lines = [];
  for (let i = 1; i <= anzKurz; i++) {
    const x = cX + (cW * i) / (anzKurz + 1);
    lines.push(`<line x1="${x.toFixed(1)}" y1="${(cY+framePx).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(cY+cH-framePx).toFixed(1)}" stroke="${strutColor}" stroke-width="2.5" stroke-dasharray="7,5" opacity="0.7"/>`);
  }
  for (let i = 1; i <= anzLang; i++) {
    const y = cY + (cH * i) / (anzLang + 1);
    lines.push(`<line x1="${(cX+framePx).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(cX+cW-framePx).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${strutColor}" stroke-width="2.5" stroke-dasharray="7,5" opacity="0.7"/>`);
  }

  const midX = cX + cW / 2, midY = cY + cH / 2;
  const arrowY = cY - 18, arrowX = cX - 22;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" style="max-height:280px;display:block">
  <defs>
    <marker id="ah" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#aaa"/>
    </marker>
    <marker id="ah2" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto-start-reverse">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#aaa"/>
    </marker>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="#0003"/>
    </filter>
  </defs>
  <!-- Dimension arrows -->
  <line x1="${(cX+2).toFixed(1)}" y1="${arrowY}" x2="${(cX+cW-2).toFixed(1)}" y2="${arrowY}" stroke="#bbb" stroke-width="1" marker-start="url(#ah2)" marker-end="url(#ah)"/>
  <text x="${midX.toFixed(1)}" y="${(arrowY-5).toFixed(1)}" text-anchor="middle" fill="#999" font-size="12" font-family="system-ui,sans-serif">${length} cm</text>
  <line x1="${arrowX}" y1="${(cY+2).toFixed(1)}" x2="${arrowX}" y2="${(cY+cH-2).toFixed(1)}" stroke="#bbb" stroke-width="1" marker-start="url(#ah2)" marker-end="url(#ah)"/>
  <text x="${(arrowX-6).toFixed(1)}" y="${midY.toFixed(1)}" text-anchor="middle" fill="#999" font-size="12" font-family="system-ui,sans-serif" transform="rotate(-90,${(arrowX-6).toFixed(1)},${midY.toFixed(1)})">${width} cm</text>
  <!-- Canvas background -->
  <rect x="${cX.toFixed(1)}" y="${cY.toFixed(1)}" width="${cW.toFixed(1)}" height="${cH.toFixed(1)}" fill="${fabricFill}" rx="2" filter="url(#shadow)"/>
  <!-- Strut lines -->
  ${lines.join('\n  ')}
  <!-- Frame border -->
  <rect x="${cX.toFixed(1)}" y="${cY.toFixed(1)}" width="${cW.toFixed(1)}" height="${cH.toFixed(1)}" fill="none" stroke="${frameColor}" stroke-width="${framePx.toFixed(1)}" rx="2"/>
  <!-- Corner joints -->
  ${[0,1].flatMap(xi => [0,1].map(yi => {
    const jx = (cX + xi*cW - (xi?framePx:0)).toFixed(1);
    const jy = (cY + yi*cH - (yi?framePx:0)).toFixed(1);
    return `<rect x="${jx}" y="${jy}" width="${framePx.toFixed(1)}" height="${framePx.toFixed(1)}" fill="${frameColor}" opacity="0.5"/>`;
  })).join('\n  ')}
  <!-- Frame type label -->
  <text x="${(cX+cW-6).toFixed(1)}" y="${(cY+cH-6).toFixed(1)}" text-anchor="end" fill="${frameColor}" font-size="10" font-family="system-ui,sans-serif" opacity="0.6">${wood==='museo'?'Museo 45':wood==='classic_double'?'Classic Doppel':'Classic Einfach'}</text>
</svg>`;
}

// ── Material buttons ──────────────────────────────────────────────────────────

document.querySelectorAll('.btn-material').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-material').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.material = btn.dataset.val;
    checkLeinenWarning();
    updatePreview();
    triggerCalc();
  });
});

// ── Dimension inputs ──────────────────────────────────────────────────────────

const debouncedCalc = debounce(() => {
  normalizeDimensions();
  updateSupportAuto();
  updatePreview();
  triggerCalc();
}, 350);

$('inp-length').addEventListener('input', debouncedCalc);
$('inp-width').addEventListener('input', debouncedCalc);

function normalizeDimensions() {
  let l = parseFloat($('inp-length').value) || 0;
  let w = parseFloat($('inp-width').value) || 0;
  if (l > 0 && w > 0 && l < w) { [l, w] = [w, l]; }
  state.length = l;
  state.width  = w;

  const info = $('dim-info');
  if (l > 0 && w > 0) {
    const area = (l * w / 10000).toFixed(2);
    info.innerHTML = `<i class="bi bi-info-circle me-1"></i>${l} × ${w} cm &nbsp;=&nbsp; <strong>${area} m²</strong>`;
    if (l !== (parseFloat($('inp-length').value)||0)) {
      $('inp-length').value = l;
      $('inp-width').value  = w;
    }
  } else {
    info.textContent = '';
  }
  checkLeinenWarning();
}

function checkLeinenWarning() {
  const show = state.material === 'Leinen' && state.width > 180;
  $('alert-leinen').classList.toggle('d-none', !show);
}

// ── Preset size buttons ───────────────────────────────────────────────────────

document.querySelectorAll('.preset-btn').forEach(btn => {
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
  });
});

// ── Wood buttons ──────────────────────────────────────────────────────────────

document.querySelectorAll('.btn-wood').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-wood').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.wood = btn.dataset.val;
    updatePreview();
    triggerCalc();
  });
});

// ── Support logic ─────────────────────────────────────────────────────────────

let _lastSupportLength = -1;

function updateSupportAuto() {
  const { length, width } = state;
  if (!length || !width) return;

  const rec = autoSupport(length, width);

  if (!state.manualOverride) {
    state.anzLang = rec.lang;
    state.anzKurz = rec.kurz;
  }

  // Update badge
  const badge = $('support-auto-badge');
  badge.textContent = rec.label;

  // Rebuild manual radio group only when length changes (changes which options are available)
  if (length !== _lastSupportLength) {
    _lastSupportLength = length;
    buildSupportRadios(length >= 210 ? SUPPORT_OPTIONS_LARGE : SUPPORT_OPTIONS_MEDIUM, rec);
  }
}

function buildSupportRadios(options, recommended) {
  const group = $('support-radio-group');
  group.innerHTML = '';
  options.forEach((opt, i) => {
    const isRec = recommended && opt.lang === recommended.lang && opt.kurz === recommended.kurz;
    const isCustom = opt.lang === null;
    const isCurrent = !isCustom && opt.lang === state.anzLang && opt.kurz === state.anzKurz;
    const div = document.createElement('div');
    div.className = 'form-check';
    div.innerHTML = `
      <input class="form-check-input support-radio" type="radio" name="support-manual" id="sr-${i}" value="${i}" ${isCurrent ? 'checked' : ''}>
      <label class="form-check-label" for="sr-${i}">
        ${opt.label}${isRec ? ' <span class="badge bg-success-subtle text-success ms-1 small">empfohlen</span>' : ''}
      </label>`;
    group.appendChild(div);

    div.querySelector('.support-radio').addEventListener('change', () => {
      if (isCustom) {
        $('custom-support-inputs').classList.remove('d-none');
        readCustomSupport();
      } else {
        $('custom-support-inputs').classList.add('d-none');
        state.anzLang = opt.lang;
        state.anzKurz = opt.kurz;
        updatePreview();
        triggerCalc();
      }
    });
  });
}

document.getElementById('support-override-toggle').addEventListener('change', e => {
  state.manualOverride = e.target.checked;
  $('support-manual').classList.toggle('d-none', !e.target.checked);
  if (!e.target.checked) {
    updateSupportAuto();
    updatePreview();
    triggerCalc();
  }
});

['custom-kurz', 'custom-lang'].forEach(id => {
  $(id)?.addEventListener('input', () => { readCustomSupport(); updatePreview(); triggerCalc(); });
});

function readCustomSupport() {
  state.anzKurz = parseInt($('custom-kurz').value) || 0;
  state.anzLang  = parseInt($('custom-lang').value) || 0;
}

// ── Markup slider ─────────────────────────────────────────────────────────────

$('markup-slider').addEventListener('input', e => {
  state.markup = parseFloat(e.target.value);
  $('markup-display').textContent = `× ${state.markup.toFixed(1)}`;
  triggerCalc();
});

// ── Canvas SVG preview ────────────────────────────────────────────────────────

function updatePreview() {
  const box = $('canvas-preview');
  if (!state.length || !state.width) {
    box.innerHTML = '<span class="text-secondary small">Masse eingeben…</span>';
    return;
  }
  box.innerHTML = buildSVG(
    state.length, state.width,
    state.anzLang, state.anzKurz,
    state.wood,
    state.material || 'Baumwolle'
  );
}

// ── API call ──────────────────────────────────────────────────────────────────

const triggerCalc = debounce(async () => {
  if (!state.material || !state.length || !state.width) return;

  $('result-loading').classList.remove('d-none');
  $('result-placeholder').classList.add('d-none');

  try {
    const res = await fetch('/api/calculate/canvas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        length:         state.length,
        width:          state.width,
        fabric_type:    state.material,
        wood_type:      state.wood,
        anz_strebe_lang: state.anzLang,
        anz_strebe_kurz: state.anzKurz,
        markup_factor:  state.markup,
      }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    renderResult(data);
    $('result-error').classList.add('d-none');
  } catch (e) {
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
    tr.innerHTML = `
      <td class="small">${row.produkt}</td>
      <td class="small text-secondary">${row.stueckpreis}</td>
      <td class="small text-secondary">${row.anzahl}</td>
      <td class="text-end fw-semibold font-monospace">${row.betrag}</td>`;
    tbody.appendChild(tr);
  });

  $('res-material').textContent    = `${data.total_material} CHF`;
  $('res-markup-label').textContent = `× ${state.markup.toFixed(1)}`;
  $('res-verkauf').textContent      = data.verkaufspreis;

  $('result-content').classList.remove('d-none');
}

// ── Reset ─────────────────────────────────────────────────────────────────────

$('btn-reset').addEventListener('click', () => {
  document.querySelectorAll('.btn-material, .preset-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.btn-wood').forEach(b => {
    b.classList.toggle('active', b.dataset.val === 'classic_double');
  });
  $('inp-length').value = '';
  $('inp-width').value  = '';
  $('support-override-toggle').checked = false;
  $('support-manual').classList.add('d-none');
  $('markup-slider').value = 4.2;
  $('markup-display').textContent = '× 4.2';
  $('alert-leinen').classList.add('d-none');
  $('dim-info').textContent = '';
  $('canvas-preview').innerHTML = '<span class="text-secondary small">Masse eingeben…</span>';
  $('result-placeholder').classList.remove('d-none');
  $('result-content').classList.add('d-none');
  $('result-error').classList.add('d-none');
  $('support-auto-badge').textContent = '— cm eingeben';

  Object.assign(state, { material: null, length: 0, width: 0, wood: 'classic_double',
    anzLang: 0, anzKurz: 0, markup: 4.2, manualOverride: false });
  _lastSupportLength = -1;
});
