'use strict';

// ── Bestellung page ───────────────────────────────────────────────────────────
// Depends on ORDER (from order.js, loaded by base.html).

const $b = id => document.getElementById(id);
const CUST_KEY = 'wa_order_customer';

// ── Customer info persistence ─────────────────────────────────────────────────

function loadCustomer() {
  return JSON.parse(localStorage.getItem(CUST_KEY) || '{}');
}

function saveCustomer() {
  const data = {
    name:    $b('cust-name')?.value.trim()    || '',
    address: $b('cust-address')?.value.trim() || '',
    city:    $b('cust-city')?.value.trim()    || '',
  };
  localStorage.setItem(CUST_KEY, JSON.stringify(data));
}

function initCustomerFields() {
  const c = loadCustomer();
  if ($b('cust-name'))    $b('cust-name').value    = c.name    || '';
  if ($b('cust-address')) $b('cust-address').value = c.address || '';
  if ($b('cust-city'))    $b('cust-city').value    = c.city    || '';

  ['cust-name', 'cust-address', 'cust-city'].forEach(id => {
    $b(id)?.addEventListener('input', saveCustomer);
  });
}

// ── Quote number display ──────────────────────────────────────────────────────

function updateQuoteNrDisplay() {
  const badge = $b('quote-nr-badge');
  if (!badge) return;
  const meta = ORDER.getMeta();
  badge.textContent = meta.quote_nr || '';
  badge.classList.toggle('d-none', !meta.quote_nr);
}

// ── Main render ───────────────────────────────────────────────────────────────

function renderBestellung() {
  const items   = ORDER.getItems();
  const empty   = $b('empty-state');
  const content = $b('order-content');

  updateQuoteNrDisplay();

  if (items.length === 0) {
    empty.classList.remove('d-none');
    content.classList.add('d-none');
    $b('cart-count-badge').textContent = '';
    return;
  }
  empty.classList.add('d-none');
  content.classList.remove('d-none');

  const totalQty = items.reduce((s, i) => s + (i.qty || 1), 0);
  $b('cart-count-badge').textContent = `${totalQty} Artikel`;

  renderItems(items);
  renderSummary(items);
}

function renderItems(items) {
  const container = $b('order-items-container');
  container.innerHTML = '';

  items.forEach((item, idx) => {
    const qty       = item.qty || 1;
    const net       = item.verkauf;
    const mwstAmt   = item.mwst ? Math.round(net * 0.081 * 20) / 20 : 0;
    const gross     = Math.round((net + mwstAmt) * 20) / 20;
    const lineTotal = Math.round(gross * qty * 20) / 20;

    let desc, detail, icon;
    if (item.type === 'material') {
      desc   = item.produkt;
      detail = item.qty_display || '';
      icon   = 'bi-basket text-success';
    } else {
      desc   = `${item.size} cm`;
      const sup = item.support && item.support !== 'Kein Zwischenstück' ? ` · ${item.support}` : '';
      detail = `${item.fabric} · ${item.wood}${sup}`;
      icon   = 'bi-rulers text-primary';
    }

    const mwstBadge = item.mwst
      ? '<span class="badge bg-success-subtle text-success border border-success-subtle small">inkl. MwSt</span>'
      : '<span class="badge bg-secondary-subtle text-secondary border small">exkl. MwSt</span>';

    const notesHtml = item.notes
      ? `<div class="text-secondary x-small fst-italic mt-1"><i class="bi bi-chat-text me-1"></i>${item.notes}</div>`
      : '';

    const unitNote = qty > 1
      ? `<div class="text-secondary x-small">${gross.toFixed(2)} × ${qty}</div>`
      : '';

    const card = document.createElement('div');
    card.className = 'card shadow-sm mb-2';
    card.innerHTML = `
      <div class="card-body py-2 px-3">
        <div class="d-flex align-items-start gap-3">
          <div class="flex-grow-1" style="cursor:pointer" data-edit-idx="${idx}">
            <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
              ${qty > 1 ? `<span class="badge bg-primary rounded-pill">${qty}×</span>` : ''}
              <span class="fw-semibold"><i class="bi ${icon} me-1"></i>${desc}</span>
              ${mwstBadge}
            </div>
            <div class="text-secondary small">${detail}</div>
            ${notesHtml}
          </div>
          <div class="text-end flex-shrink-0">
            <div class="fw-bold font-monospace text-success fs-6">${lineTotal.toFixed(2)}</div>
            <div class="text-secondary x-small">CHF${unitNote ? '' : ''}</div>
            ${unitNote}
          </div>
        </div>
        <div class="d-flex gap-2 mt-2 pt-2 border-top flex-wrap">
          <button class="btn btn-outline-secondary btn-sm btn-edit-item" data-idx="${idx}">
            <i class="bi bi-pencil me-1"></i>Bearbeiten
          </button>
          <button class="btn btn-outline-secondary btn-sm btn-dup-item" data-idx="${idx}">
            <i class="bi bi-copy me-1"></i>Duplizieren
          </button>
          <button class="btn btn-outline-danger btn-sm ms-auto btn-remove-item" data-idx="${idx}">
            <i class="bi bi-trash me-1"></i>Entfernen
          </button>
        </div>
      </div>`;
    container.appendChild(card);
  });

  // Clickable info area
  container.querySelectorAll('[data-edit-idx]').forEach(el => {
    el.addEventListener('click', () => ORDER.openEditModal(parseInt(el.dataset.editIdx)));
  });
  // Edit button
  container.querySelectorAll('.btn-edit-item').forEach(el => {
    el.addEventListener('click', () => ORDER.openEditModal(parseInt(el.dataset.idx)));
  });
  // Duplicate button
  container.querySelectorAll('.btn-dup-item').forEach(el => {
    el.addEventListener('click', () => {
      const items = ORDER.getItems();
      const orig  = items[parseInt(el.dataset.idx)];
      if (!orig) return;
      ORDER.addItem({ ...orig, qty: 1, notes: orig.notes || '' });
      // Flash feedback
      el.innerHTML = '<i class="bi bi-check me-1"></i>Dupliziert!';
      setTimeout(() => { el.innerHTML = '<i class="bi bi-copy me-1"></i>Duplizieren'; }, 1200);
    });
  });
  // Remove button
  container.querySelectorAll('.btn-remove-item').forEach(el => {
    el.addEventListener('click', () => ORDER.removeItem(parseInt(el.dataset.idx)));
  });
}

function renderSummary(items) {
  const lines = $b('summary-lines');
  lines.innerHTML = '';

  let totalNet  = 0;
  let totalMwst = 0;

  items.forEach(item => {
    const qty   = item.qty || 1;
    const net   = item.verkauf * qty;
    const mwst  = item.mwst ? Math.round(item.verkauf * 0.081 * 20) / 20 * qty : 0;
    totalNet  += net;
    totalMwst += mwst;

    const gross = Math.round((net + mwst) * 20) / 20;
    const label = item.type === 'material'
      ? item.produkt
      : `${qty > 1 ? qty + '× ' : ''}${item.size} cm`;

    lines.innerHTML += `
      <div class="d-flex justify-content-between align-items-baseline small py-1 border-bottom">
        <span class="text-secondary text-truncate me-2" style="max-width:170px" title="${label}">${label}</span>
        <span class="font-monospace flex-shrink-0">${gross.toFixed(2)}</span>
      </div>`;
  });

  const hasMwst = totalMwst > 0;
  const total   = Math.round((totalNet + totalMwst) * 20) / 20;

  $b('summary-total').textContent = total.toFixed(2) + ' CHF';

  const netRow  = $b('summary-net-row');
  const mwstRow = $b('summary-mwst-row');
  if (netRow)  netRow.classList.toggle('d-none', !hasMwst);
  if (mwstRow) mwstRow.classList.toggle('d-none', !hasMwst);
  if ($b('summary-net'))      $b('summary-net').textContent      = (Math.round(totalNet * 20) / 20).toFixed(2) + ' CHF';
  if ($b('summary-mwst-amt')) $b('summary-mwst-amt').textContent = (Math.round(totalMwst * 20) / 20).toFixed(2) + ' CHF';
}

// ── PDF preview ───────────────────────────────────────────────────────────────

$b('btn-preview-pdf').addEventListener('click', () => {
  if (!window.jspdf) { alert('PDF-Bibliothek noch nicht geladen — bitte kurz warten.'); return; }
  const url = ORDER.generatePDFBlobUrl();
  if (!url) return;

  const iframe = $b('pdf-preview-iframe');
  const box    = $b('pdf-preview-box');
  iframe.src   = url;
  box.classList.remove('d-none');
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  $b('btn-preview-pdf').innerHTML = '<i class="bi bi-arrow-clockwise me-1"></i>Vorschau aktualisieren';
});

$b('btn-close-preview').addEventListener('click', () => {
  $b('pdf-preview-box').classList.add('d-none');
  $b('pdf-preview-iframe').src = '';
  $b('btn-preview-pdf').innerHTML = '<i class="bi bi-eye me-1"></i>PDF Vorschau';
});

$b('btn-download-pdf').addEventListener('click', () => {
  if (!window.jspdf) { alert('PDF-Bibliothek noch nicht geladen — bitte kurz warten.'); return; }
  ORDER.generatePDF();
});

$b('btn-clear-all').addEventListener('click', () => {
  if (confirm('Bestellung wirklich löschen?')) {
    ORDER.clearItems();
    // Also clear customer info
    localStorage.removeItem(CUST_KEY);
    initCustomerFields();
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('wa_order_changed', renderBestellung);
initCustomerFields();
renderBestellung();
