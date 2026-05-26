'use strict';

// ── Shared order module ───────────────────────────────────────────────────────
// Included on every page that has an order panel.
// Requires: window.jspdf (jsPDF + AutoTable) to be loaded first.
// Requires: window.BUSINESS_INFO to be set by the template.

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
  }

  function addItem(item) {
    const items = getItems();
    items.push(item);
    _save(items);
  }

  function removeItem(idx) {
    const items = getItems();
    items.splice(idx, 1);
    _save(items);
  }

  function clearItems() {
    localStorage.removeItem(KEY);
    updateNavBadge();
    renderPanel();
  }

  // ── Nav badge ───────────────────────────────────────────────────────────────

  function updateNavBadge() {
    const badge = el('nav-order-badge');
    if (!badge) return;
    const count = getItems().length;
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
    el('order-count').textContent = items.length;
    const pBtn = el('btn-print-order');
    if (pBtn) pBtn.classList.remove('d-none');

    const tbody = el('order-tbody');
    tbody.innerHTML = '';
    let total = 0;

    items.forEach((item, idx) => {
      const net   = item.verkauf;
      const mwst  = item.mwst ? Math.round(net * 0.081 * 20) / 20 : 0;
      const gross = Math.round((net + mwst) * 20) / 20;
      total += gross;

      let desc, detail;
      if (item.type === 'material') {
        desc   = item.produkt;
        detail = item.qty_display || '';
      } else {
        // canvas (or legacy items without type)
        desc   = `${item.size} cm`;
        const support = item.support && item.support !== 'Kein Zwischenstück' ? ` · ${item.support}` : '';
        detail = `${item.fabric} · ${item.wood}${support}`;
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="fw-semibold small">${desc}</td>
        <td class="text-secondary small">${detail}</td>
        <td class="text-end font-monospace small">${gross.toFixed(2)}${item.mwst ? '<span class="text-secondary x-small ms-1">*</span>' : ''}</td>
        <td class="d-print-none text-end">
          <button class="btn btn-sm btn-outline-danger py-0 px-1 remove-order-item" data-idx="${idx}">×</button>
        </td>`;
      tbody.appendChild(tr);
    });

    const hasMwst = items.some(i => i.mwst);
    el('order-mwst-note').textContent = hasMwst ? '* inkl. MwSt 8.1%' : '';
    el('order-total').textContent = (Math.round(total * 20) / 20).toFixed(2);

    document.querySelectorAll('.remove-order-item').forEach(btn =>
      btn.addEventListener('click', () => removeItem(parseInt(btn.dataset.idx)))
    );
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
    return 58; // Y position after header
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

  // ── Order PDF ───────────────────────────────────────────────────────────────

  function generatePDF() {
    if (!window.jspdf) { alert('PDF-Bibliothek noch nicht geladen — kurz warten.'); return; }
    const items = getItems();
    if (items.length === 0) { alert('Keine Artikel in der Bestellung.'); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, ML = 15, MR = 15;
    let Y = drawPDFHeader(doc, W, ML, MR);

    // Section title
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(30);
    doc.text('Bestellung / Offerte', ML, Y); Y += 8;

    // Separate canvas and material items for display grouping
    const canvasItems   = items.filter(i => !i.type || i.type === 'canvas');
    const materialItems = items.filter(i => i.type === 'material');

    const buildRows = arr => arr.map(item => {
      const net   = item.verkauf;
      const mwst  = item.mwst ? Math.round(net * 0.081 * 20) / 20 : 0;
      const gross = Math.round((net + mwst) * 20) / 20;
      let desc, detail;
      if (item.type === 'material') {
        desc   = item.produkt;
        detail = item.qty_display || '';
      } else {
        desc   = `Leinwand ${item.size} cm`;
        const sup = item.support && item.support !== 'Kein Zwischenstück' ? ` · ${item.support}` : '';
        detail = `${item.fabric} · ${item.wood}${sup}`;
      }
      return [desc, detail, `CHF ${gross.toFixed(2)}${item.mwst ? ' *' : ''}`];
    });

    const allRows = buildRows(items);

    doc.autoTable({
      startY: Y,
      head: [['Beschreibung', 'Details', 'CHF']],
      body: allRows,
      styles:           { fontSize: 9, cellPadding: 2.5 },
      headStyles:       { fillColor: [25, 135, 84], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      columnStyles:     { 2: { halign: 'right', fontStyle: 'bold' } },
      margin:           { left: ML, right: MR },
    });

    Y = doc.lastAutoTable.finalY + 6;

    // Total
    const total = items.reduce((s, item) => {
      const mwst = item.mwst ? Math.round(item.verkauf * 0.081 * 20) / 20 : 0;
      return s + Math.round((item.verkauf + mwst) * 20) / 20;
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
    const today = new Date().toLocaleDateString('de-CH').replace(/\./g, '-');
    doc.save(`Bestellung_${today}.pdf`);
  }

  // ── Init ─────────────────────────────────────────────────────────────────────

  function init() {
    updateNavBadge();
    renderPanel();
    const clearBtn = el('btn-clear-order');
    if (clearBtn) clearBtn.addEventListener('click', clearItems);
    const printBtn = el('btn-print-order');
    if (printBtn) printBtn.addEventListener('click', generatePDF);
  }

  init();

  return { getItems, addItem, removeItem, clearItems, renderPanel, updateNavBadge, generatePDF, drawPDFHeader, drawPDFFooter };
})();
