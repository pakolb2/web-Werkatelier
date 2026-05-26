'use strict';

// ── Shared order module ───────────────────────────────────────────────────────
// Loaded globally from base.html.
// Requires: window.jspdf + AutoTable for PDF (lazy).
// Requires: window.BUSINESS_INFO set by the page template.

const ORDER = (() => {
  const KEY      = 'wa_order';
  const META_KEY = 'wa_order_meta';
  const CUST_KEY = 'wa_order_customer';
  const CNT_KEY  = 'wa_quote_counter';
  const el       = id => document.getElementById(id);

  // ── Quote number ─────────────────────────────────────────────────────────────

  function _ensureQuoteNr() {
    const meta = JSON.parse(localStorage.getItem(META_KEY) || '{}');
    if (meta.quote_nr) return meta.quote_nr;
    const cnt = parseInt(localStorage.getItem(CNT_KEY) || '0') + 1;
    localStorage.setItem(CNT_KEY, String(cnt));
    const nr = `OFF-${new Date().getFullYear()}-${String(cnt).padStart(4, '0')}`;
    localStorage.setItem(META_KEY, JSON.stringify({ quote_nr: nr }));
    return nr;
  }

  function getMeta() {
    return JSON.parse(localStorage.getItem(META_KEY) || '{}');
  }

  // ── State ─────────────────────────────────────────────────────────────────────

  function getItems() {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  }

  function _save(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    updateNavBadge();
    renderPanel();
    document.dispatchEvent(new CustomEvent('wa_order_changed'));
  }

  function addItem(item) {
    _ensureQuoteNr();
    const items = getItems();
    if (!('qty'   in item)) item.qty   = 1;
    if (!('mwst'  in item)) item.mwst  = true;
    if (!('notes' in item)) item.notes = '';
    items.push(item);
    _save(items);
  }

  function removeItem(idx) {
    const items = getItems();
    items.splice(idx, 1);
    _save(items);
  }

  function updateItem(idx, changes) {
    const items = getItems();
    if (idx < 0 || idx >= items.length) return;
    Object.assign(items[idx], changes);
    _save(items);
  }

  function clearItems() {
    localStorage.removeItem(KEY);
    localStorage.removeItem(META_KEY);
    updateNavBadge();
    renderPanel();
    document.dispatchEvent(new CustomEvent('wa_order_changed'));
  }

  // ── Nav badge ─────────────────────────────────────────────────────────────────

  function updateNavBadge() {
    const badge = el('nav-order-badge');
    if (!badge) return;
    const count = getItems().reduce((s, i) => s + (i.qty || 1), 0);
    badge.textContent = count;
    badge.classList.toggle('d-none', count === 0);
  }

  // ── Panel rendering ───────────────────────────────────────────────────────────

  function renderPanel() {
    const panel = el('order-panel');
    if (!panel) return;

    const items = getItems();
    if (items.length === 0) { panel.classList.add('d-none'); return; }

    panel.classList.remove('d-none');
    el('order-count').textContent = items.reduce((s, i) => s + (i.qty || 1), 0);
    const pBtn = el('btn-print-order');
    if (pBtn) pBtn.classList.remove('d-none');

    const tbody = el('order-tbody');
    tbody.innerHTML = '';
    let total = 0;

    items.forEach((item, idx) => {
      const qty       = item.qty || 1;
      const net       = item.verkauf;
      const mwst      = item.mwst ? Math.round(net * 0.081 * 20) / 20 : 0;
      const gross     = Math.round((net + mwst) * 20) / 20;
      const lineTotal = Math.round(gross * qty * 20) / 20;
      total += lineTotal;

      let desc, detail;
      if (item.type === 'material') {
        desc   = item.produkt;
        detail = item.qty_display || '';
      } else {
        desc   = `${item.size} cm`;
        const sup = item.support && item.support !== 'Kein Zwischenstück' ? ` · ${item.support}` : '';
        detail = `${item.fabric} · ${item.wood}${sup}`;
      }

      const qtyBadge  = qty > 1 ? `<span class="badge bg-secondary me-1">${qty}×</span>` : '';
      const notesHtml = item.notes
        ? `<div class="text-secondary x-small fst-italic mt-1"><i class="bi bi-chat-text me-1"></i>${item.notes}</div>`
        : '';

      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.title = 'Klicken zum Bearbeiten';
      tr.innerHTML = `
        <td class="fw-semibold small">${qtyBadge}${desc}</td>
        <td class="small text-secondary">${detail}${notesHtml}</td>
        <td class="text-end font-monospace small">${lineTotal.toFixed(2)}${item.mwst ? '<span class="text-secondary x-small ms-1">*</span>' : ''}</td>
        <td class="d-print-none text-end">
          <button class="btn btn-sm btn-outline-danger py-0 px-1 remove-order-item" data-idx="${idx}" title="Entfernen">×</button>
        </td>`;
      tr.addEventListener('click', e => {
        if (e.target.closest('.remove-order-item')) return;
        openEditModal(idx);
      });
      tbody.appendChild(tr);
    });

    const hasMwst = items.some(i => i.mwst);
    el('order-mwst-note').textContent = hasMwst ? '* inkl. MwSt 8.1%' : '';
    el('order-total').textContent = (Math.round(total * 20) / 20).toFixed(2);

    document.querySelectorAll('.remove-order-item').forEach(btn =>
      btn.addEventListener('click', () => removeItem(parseInt(btn.dataset.idx)))
    );
  }

  // ── Edit modal ────────────────────────────────────────────────────────────────

  let _editIdx = -1;

  function openEditModal(idx) {
    const items = getItems();
    const item  = items[idx];
    if (!item) return;
    _editIdx = idx;

    const descEl  = el('edit-item-desc');
    const qtyInp  = el('edit-qty');
    const mwstChk = el('edit-mwst');
    const notesEl = el('edit-notes');

    if (descEl) {
      descEl.textContent = item.type === 'material'
        ? item.produkt
        : `${item.size} cm — ${item.fabric} · ${item.wood}`;
    }
    if (qtyInp)  qtyInp.value  = item.qty || 1;
    if (mwstChk) mwstChk.checked = item.mwst !== false;
    if (notesEl) notesEl.value   = item.notes || '';

    const modalEl = el('order-edit-modal');
    if (modalEl) new bootstrap.Modal(modalEl).show();
  }

  function _bindEditModal() {
    const saveBtn  = el('btn-save-edit');
    const minusBtn = el('edit-qty-minus');
    const plusBtn  = el('edit-qty-plus');
    if (!saveBtn) return;

    saveBtn.addEventListener('click', () => {
      if (_editIdx < 0) return;
      const qty   = Math.max(1, parseInt(el('edit-qty')?.value  || 1));
      const mwst  = el('edit-mwst')?.checked ?? true;
      const notes = (el('edit-notes')?.value || '').trim();
      updateItem(_editIdx, { qty, mwst, notes });
      _editIdx = -1;
      bootstrap.Modal.getInstance(el('order-edit-modal'))?.hide();
    });
    minusBtn?.addEventListener('click', () => {
      const inp = el('edit-qty');
      if (inp) inp.value = Math.max(1, parseInt(inp.value || 1) - 1);
    });
    plusBtn?.addEventListener('click', () => {
      const inp = el('edit-qty');
      if (inp) inp.value = Math.min(99, parseInt(inp.value || 1) + 1);
    });
  }

  // ── Shared PDF helpers ────────────────────────────────────────────────────────

  function drawPDFHeader(doc, W, ML, MR) {
    const biz   = window.BUSINESS_INFO || {};
    const today = new Date().toLocaleDateString('de-CH');

    doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(30);
    doc.text(biz.name || 'Werkatelier', ML, 22);

    let addrY = 27;
    if (biz.subtitle) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100);
      doc.text(biz.subtitle, ML, addrY); addrY += 5;
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
    if (biz.address) { doc.text(biz.address, ML, addrY); addrY += 4.5; }
    if (biz.city)    { doc.text(biz.city,    ML, addrY); addrY += 4.5; }
    const contact = [biz.phone, biz.email, biz.website].filter(Boolean).join('   ·   ');
    if (contact) doc.text(contact, ML, addrY);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(60);
    doc.text('OFFERTE', W - MR, 22, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100);
    doc.text(`Datum: ${today}`, W - MR, 29, { align: 'right' });

    doc.setDrawColor(200); doc.setLineWidth(0.4);
    doc.line(ML, 50, W - MR, 50);
    return 58;
  }

  function drawPDFFooter(doc, W, ML, MR) {
    const biz = window.BUSINESS_INFO || {};
    const fY  = 282;
    doc.setDrawColor(200); doc.line(ML, fY - 7, W - MR, fY - 7);
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(130);
    let fLine = fY - 1;
    if (biz.invoice_note) { doc.text(biz.invoice_note, ML, fLine); fLine += 5; }
    const parts = [];
    if (biz.vat_nr)       parts.push(`MwSt-Nr: ${biz.vat_nr}`);
    if (biz.bank_details) parts.push(biz.bank_details);
    if (parts.length) { doc.setFont('helvetica', 'normal'); doc.text(parts.join('   ·   '), ML, fLine); }
  }

  // ── PDF builder ───────────────────────────────────────────────────────────────

  function _buildPDFDoc() {
    if (!window.jspdf) return null;
    const items = getItems();
    if (!items.length) return null;

    const { jsPDF } = window.jspdf;
    const doc  = new jsPDF({ unit: 'mm', format: 'a4' });
    const W    = 210, ML = 15, MR = 15;
    let headerY = drawPDFHeader(doc, W, ML, MR); // = 58

    // ── Customer block (left) + quote number (right) ──
    const cust = JSON.parse(localStorage.getItem(CUST_KEY) || '{}');
    const meta = getMeta();
    let custBottomY = headerY;

    if (cust.name || cust.address || cust.city) {
      let cY = headerY;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120);
      doc.text('An:', ML, cY);
      doc.setFontSize(9);
      if (cust.name)    { doc.setFont('helvetica', 'bold');   doc.setTextColor(25);  doc.text(cust.name,    ML + 8, cY); doc.setFont('helvetica', 'normal'); cY += 4.5; }
      if (cust.address) { doc.setTextColor(60); doc.text(cust.address, ML + 8, cY); cY += 4.5; }
      if (cust.city)    { doc.text(cust.city,    ML + 8, cY); cY += 4.5; }
      custBottomY = cY + 2;
    }

    if (meta.quote_nr) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120);
      doc.text('Referenz:', W - MR, headerY, { align: 'right' });
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(40);
      doc.text(meta.quote_nr, W - MR, headerY + 5, { align: 'right' });
    }

    let Y = Math.max(custBottomY, headerY + 14); // at least 14 mm below header line

    // ── Table ──
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(30);
    doc.text('Bestellung / Offerte', ML, Y); Y += 8;

    const allRows = items.map(item => {
      const qty       = item.qty || 1;
      const net       = item.verkauf;
      const mwst      = item.mwst ? Math.round(net * 0.081 * 20) / 20 : 0;
      const gross     = Math.round((net + mwst) * 20) / 20;
      const lineTotal = Math.round(gross * qty * 20) / 20;
      let desc, detail;
      if (item.type === 'material') {
        desc   = item.produkt;
        detail = item.qty_display || '';
      } else {
        desc   = `Leinwand ${item.size} cm`;
        const sup = item.support && item.support !== 'Kein Zwischenstück' ? ` · ${item.support}` : '';
        detail = `${item.fabric} · ${item.wood}${sup}`;
      }
      if (item.notes) detail += `\n↳ ${item.notes}`;
      const qtyStr = qty > 1 ? `${qty}× ` : '';
      return [`${qtyStr}${desc}`, detail, `CHF ${lineTotal.toFixed(2)}${item.mwst ? ' *' : ''}`];
    });

    doc.autoTable({
      startY: Y,
      head: [['Beschreibung', 'Details', 'CHF']],
      body: allRows,
      styles:             { fontSize: 9, cellPadding: 2.5 },
      headStyles:         { fillColor: [25, 135, 84], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      columnStyles:       { 2: { halign: 'right', fontStyle: 'bold' } },
      margin:             { left: ML, right: MR },
    });

    Y = doc.lastAutoTable.finalY + 6;

    // ── Total block ──
    const totalNet  = items.reduce((s, i) => s + i.verkauf * (i.qty || 1), 0);
    const totalMwst = items.reduce((s, i) => {
      if (!i.mwst) return s;
      return s + Math.round(i.verkauf * 0.081 * 20) / 20 * (i.qty || 1);
    }, 0);
    const total = Math.round((totalNet + totalMwst) * 20) / 20;

    const cR = W - MR, cL = cR - 68;
    doc.setDrawColor(210); doc.line(cL - 4, Y, cR, Y); Y += 5;

    if (items.some(i => i.mwst)) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120);
      doc.text('Netto', cL, Y);
      doc.text(`CHF ${(Math.round(totalNet * 20) / 20).toFixed(2)}`, cR, Y, { align: 'right' }); Y += 4.5;
      doc.text('MwSt 8.1% *', cL, Y);
      doc.text(`CHF ${(Math.round(totalMwst * 20) / 20).toFixed(2)}`, cR, Y, { align: 'right' }); Y += 5;
    }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(20);
    doc.text('Total', cL, Y);
    doc.text(`CHF ${total.toFixed(2)}`, cR, Y, { align: 'right' });
    if (items.some(i => i.mwst)) {
      Y += 5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120);
      doc.text('* inkl. MwSt 8.1%', cL, Y);
    }

    drawPDFFooter(doc, W, ML, MR);
    return doc;
  }

  // ── Public PDF ────────────────────────────────────────────────────────────────

  function generatePDF() {
    if (!window.jspdf) { alert('PDF-Bibliothek noch nicht geladen — kurz warten.'); return; }
    const items = getItems();
    if (!items.length) { alert('Keine Artikel in der Bestellung.'); return; }
    const doc = _buildPDFDoc();
    if (!doc) return;
    const today   = new Date().toLocaleDateString('de-CH').replace(/\./g, '-');
    const meta    = getMeta();
    const refPart = meta.quote_nr ? `_${meta.quote_nr}` : '';
    doc.save(`Offerte${refPart}_${today}.pdf`);
  }

  function generatePDFBlobUrl() {
    const doc = _buildPDFDoc();
    if (!doc) return null;
    // Safari blocks blob: URLs in iframes — fall back to data URI
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    return isSafari ? doc.output('datauristring') : doc.output('bloburl');
  }

  // ── Init ──────────────────────────────────────────────────────────────────────

  function init() {
    updateNavBadge();
    renderPanel();
    const clearBtn = el('btn-clear-order');
    if (clearBtn) clearBtn.addEventListener('click', clearItems);
    const printBtn = el('btn-print-order');
    if (printBtn) printBtn.addEventListener('click', generatePDF);
    _bindEditModal();
  }

  init();

  return {
    getItems, addItem, removeItem, updateItem, clearItems,
    renderPanel, updateNavBadge,
    generatePDF, generatePDFBlobUrl,
    drawPDFHeader, drawPDFFooter,
    openEditModal, getMeta,
  };
})();
