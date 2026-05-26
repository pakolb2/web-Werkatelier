'use strict';

// ── Shared order module ───────────────────────────────────────────────────────
// Loaded globally from base.html on every page.
// Requires: window.jspdf (jsPDF + AutoTable) for PDF generation (lazy).
// Requires: window.BUSINESS_INFO set by the page template.

const ORDER = (() => {
  const KEY = 'wa_order';
  const el  = id => document.getElementById(id);

  // ── State ───────────────────────────────────────────────────────────────────

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
    const items = getItems();
    if (!('qty'  in item)) item.qty  = 1;
    if (!('mwst' in item)) item.mwst = true;
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
    updateNavBadge();
    renderPanel();
    document.dispatchEvent(new CustomEvent('wa_order_changed'));
  }

  // ── Nav badge ───────────────────────────────────────────────────────────────

  function updateNavBadge() {
    const badge = el('nav-order-badge');
    if (!badge) return;
    const count = getItems().reduce((s, i) => s + (i.qty || 1), 0);
    badge.textContent = count;
    badge.classList.toggle('d-none', count === 0);
  }

  // ── Panel rendering ─────────────────────────────────────────────────────────

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
        const support = item.support && item.support !== 'Kein Zwischenstück' ? ` · ${item.support}` : '';
        detail = `${item.fabric} · ${item.wood}${support}`;
      }

      const qtyBadge = qty > 1 ? `<span class="badge bg-secondary me-1">${qty}×</span>` : '';

      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.title = 'Klicken zum Bearbeiten';
      tr.innerHTML = `
        <td class="fw-semibold small">${qtyBadge}${desc}</td>
        <td class="text-secondary small">${detail}</td>
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

  // ── Edit modal ──────────────────────────────────────────────────────────────

  let _editIdx = -1;

  function openEditModal(idx) {
    const items = getItems();
    const item  = items[idx];
    if (!item) return;
    _editIdx = idx;

    const descEl = el('edit-item-desc');
    if (descEl) {
      descEl.textContent = item.type === 'material'
        ? item.produkt
        : `${item.size} cm — ${item.fabric} · ${item.wood}`;
    }
    const qtyInp = el('edit-qty');
    if (qtyInp) qtyInp.value = item.qty || 1;
    const mwstChk = el('edit-mwst');
    if (mwstChk) mwstChk.checked = item.mwst !== false;

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
      const qty  = Math.max(1, parseInt(el('edit-qty')?.value || 1));
      const mwst = el('edit-mwst')?.checked ?? true;
      updateItem(_editIdx, { qty, mwst });
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

  // ── Shared PDF helpers ──────────────────────────────────────────────────────

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

  // ── PDF builder (shared core) ───────────────────────────────────────────────

  function _buildPDFDoc() {
    if (!window.jspdf) return null;
    const items = getItems();
    if (!items.length) return null;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, ML = 15, MR = 15;
    let Y = drawPDFHeader(doc, W, ML, MR);

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

    const total = items.reduce((s, item) => {
      const qty   = item.qty || 1;
      const mwst  = item.mwst ? Math.round(item.verkauf * 0.081 * 20) / 20 : 0;
      const gross = Math.round((item.verkauf + mwst) * 20) / 20;
      return s + Math.round(gross * qty * 20) / 20;
    }, 0);

    const cR = W - MR, cL = cR - 68;
    doc.setDrawColor(210); doc.line(cL - 4, Y, cR, Y); Y += 6;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(20);
    doc.text('Total', cL, Y);
    doc.text(`CHF ${(Math.round(total * 20) / 20).toFixed(2)}`, cR, Y, { align: 'right' });
    if (items.some(i => i.mwst)) {
      Y += 5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120);
      doc.text('* inkl. MwSt 8.1%', cL, Y);
    }

    drawPDFFooter(doc, W, ML, MR);
    return doc;
  }

  // ── Order PDF ───────────────────────────────────────────────────────────────

  function generatePDF() {
    if (!window.jspdf) { alert('PDF-Bibliothek noch nicht geladen — kurz warten.'); return; }
    const items = getItems();
    if (!items.length) { alert('Keine Artikel in der Bestellung.'); return; }
    const doc = _buildPDFDoc();
    if (!doc) return;
    const today = new Date().toLocaleDateString('de-CH').replace(/\./g, '-');
    doc.save(`Bestellung_${today}.pdf`);
  }

  function generatePDFBlobUrl() {
    const doc = _buildPDFDoc();
    if (!doc) return null;
    return doc.output('bloburl');
  }

  // ── Init ─────────────────────────────────────────────────────────────────────

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
    openEditModal,
  };
})();
