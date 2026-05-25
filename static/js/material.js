// Material price calculator logic

let fabricRowCounters = {};
let frameRowCounters  = {};

// ── Toggle show/hide on checkbox ──────────────────────────────────────────────

document.querySelectorAll('.item-toggle').forEach(chk => {
  chk.addEventListener('change', () => {
    const target = document.getElementById(chk.dataset.target);
    if (chk.checked) {
      target.classList.remove('d-none');
      // Auto-add first row if empty
      const fabricContainer = target.querySelector('.fabric-rows');
      const frameContainer  = target.querySelector('.frame-rows');
      if (fabricContainer && fabricContainer.children.length === 0) {
        addFabricRow(fabricContainer.dataset.fabric, fabricContainer.dataset.key);
      }
      if (frameContainer && frameContainer.children.length === 0) {
        addFrameRow(frameContainer.dataset.key, frameContainer.closest('[id]').id.replace('-rows','').replace(/-/g,' '));
      }
    } else {
      target.classList.add('d-none');
    }
  });
});

// ── Fabric rows (Stoffe) ──────────────────────────────────────────────────────

document.querySelectorAll('.add-fabric-row').forEach(btn => {
  btn.addEventListener('click', () => addFabricRow(btn.dataset.fabric, btn.dataset.key));
});

function addFabricRow(fabric, key) {
  if (!fabricRowCounters[fabric]) fabricRowCounters[fabric] = 0;
  const i = fabricRowCounters[fabric]++;
  const container = document.querySelector(`.fabric-rows[data-fabric="${fabric}"]`);
  const div = document.createElement('div');
  div.className = 'fabric-row border rounded p-2 mb-2 bg-light';
  div.dataset.fabric = fabric;
  div.dataset.key = key;
  div.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-1">
      <span class="small fw-semibold text-secondary">${capitalize(fabric)}-Stoff #${i + 1}</span>
      <button type="button" class="btn-close btn-sm remove-row" aria-label="Entfernen"></button>
    </div>
    <div class="row g-2">
      <div class="col-6">
        <label class="form-label small mb-0">Breite [cm]</label>
        <input type="number" class="form-control form-control-sm fabric-breite" min="0" value="0">
      </div>
      <div class="col-6">
        <label class="form-label small mb-0">Länge [cm]</label>
        <input type="number" class="form-control form-control-sm fabric-laenge" min="0" value="0">
      </div>
    </div>`;
  div.querySelector('.remove-row').addEventListener('click', () => div.remove());
  container.appendChild(div);
}

// ── Frame rows (Rahmen) ───────────────────────────────────────────────────────

document.querySelectorAll('.add-frame-row').forEach(btn => {
  btn.addEventListener('click', () => addFrameRow(btn.dataset.key, btn.dataset.label));
});

function addFrameRow(key, label) {
  if (!frameRowCounters[key]) frameRowCounters[key] = 0;
  const i = frameRowCounters[key]++;
  const container = document.querySelector(`.frame-rows[data-key="${key}"]`);
  const div = document.createElement('div');
  div.className = 'frame-row border rounded p-2 mb-2 bg-light';
  div.dataset.key = key;
  div.dataset.label = label;
  div.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-1">
      <span class="small fw-semibold text-secondary">${label} #${i + 1}</span>
      <button type="button" class="btn-close btn-sm remove-row" aria-label="Entfernen"></button>
    </div>
    <div class="row g-2">
      <div class="col-6">
        <label class="form-label small mb-0">Länge [cm]</label>
        <input type="number" class="form-control form-control-sm frame-laenge" min="0" value="0">
      </div>
      <div class="col-6">
        <label class="form-label small mb-0">Anzahl</label>
        <input type="number" class="form-control form-control-sm frame-anzahl" min="0" value="1">
      </div>
    </div>`;
  div.querySelector('.remove-row').addEventListener('click', () => div.remove());
  container.appendChild(div);
}

// ── Collect items ─────────────────────────────────────────────────────────────

function collectItems() {
  const items = [];

  // Fabric rows
  document.querySelectorAll('.fabric-row').forEach((row, idx) => {
    const fabric = row.dataset.fabric;
    const key    = row.dataset.key;
    const breite = parseFloat(row.querySelector('.fabric-breite').value) || 0;
    const laenge = parseFloat(row.querySelector('.fabric-laenge').value) || 0;
    const qm = (breite * laenge) / 10000;
    if (qm > 0) {
      items.push({
        kategorie: 'Stoff',
        name: `${capitalize(fabric)} #${idx + 1}`,
        preis_key: key,
        menge: qm,
      });
    }
  });

  // Frame rows
  document.querySelectorAll('.frame-row').forEach((row, idx) => {
    const key    = row.dataset.key;
    const label  = row.dataset.label;
    const laenge = parseFloat(row.querySelector('.frame-laenge').value) || 0;
    const anzahl = parseFloat(row.querySelector('.frame-anzahl').value) || 0;
    const meter  = (laenge / 100) * anzahl;
    if (meter > 0) {
      items.push({
        kategorie: 'Rahmen',
        name: `${label} #${idx + 1}`,
        preis_key: key,
        menge: meter,
      });
    }
  });

  // Binder
  const binderChk = document.getElementById('chk-binder');
  if (binderChk.checked) {
    const dl = parseFloat(document.getElementById('binder-dl').value) || 0;
    if (dl > 0) {
      items.push({ kategorie: 'Farbe & Binder', name: 'Binder (Guardi)', preis_key: 'binder_l', menge: dl / 10 });
    }
  }

  // Farbe
  const farbeChk = document.getElementById('chk-farbe');
  if (farbeChk.checked) {
    const dl = parseFloat(document.getElementById('farbe-dl').value) || 0;
    if (dl > 0) {
      items.push({ kategorie: 'Farbe & Binder', name: 'Farbe (Guardi)', preis_key: 'farbe_l', menge: dl / 10 });
    }
  }

  return items;
}

// ── Calculate ─────────────────────────────────────────────────────────────────

document.getElementById('btn-calc-material').addEventListener('click', async () => {
  const items = collectItems();
  const resultPanel = document.getElementById('mat-result-panel');
  const resultError = document.getElementById('mat-result-error');
  const btn = document.getElementById('btn-calc-material');

  if (items.length === 0) {
    resultError.textContent = 'Bitte wählen Sie mindestens ein Material aus und geben Sie eine Menge ein.';
    resultError.classList.remove('d-none');
    resultPanel.classList.add('d-none');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Berechne…';

  try {
    const res = await fetch('/api/calculate/material', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    renderResult(data);
    resultError.classList.add('d-none');
  } catch (e) {
    resultPanel.classList.add('d-none');
    resultError.textContent = 'Fehler: ' + e.message;
    resultError.classList.remove('d-none');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-calculator me-2"></i>Berechnen';
  }
});

function renderResult(data) {
  const body = document.getElementById('mat-result-body');
  body.innerHTML = '';

  Object.entries(data.groups).forEach(([kategorie, group]) => {
    const section = document.createElement('div');
    section.className = 'px-3 pt-3';
    let rows = group.rows.map(r => `
      <tr>
        <td>${r.produkt}</td>
        <td class="text-secondary small">${r.preis_einheit}</td>
        <td class="text-secondary small">${r.menge}</td>
        <td class="text-end fw-semibold">${r.gesamtpreis}</td>
      </tr>`).join('');
    section.innerHTML = `
      <h6 class="fw-bold text-uppercase text-secondary small mb-2">${kategorie}</h6>
      <div class="table-responsive">
        <table class="table table-sm table-striped mb-1">
          <thead class="table-light"><tr>
            <th>Produkt</th><th>Preis/Einheit</th><th>Menge</th><th class="text-end">Gesamt</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="text-end small mb-3">Zwischentotal: <strong>${group.subtotal}</strong></p>`;
    body.appendChild(section);
    body.appendChild(document.createElement('hr'));
  });

  document.getElementById('mat-total').textContent = data.total;
  document.getElementById('mat-result-panel').classList.remove('d-none');
  document.getElementById('mat-result-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
