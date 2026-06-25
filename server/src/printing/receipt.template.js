// server/src/printing/receipt.template.js
// Pure function — no DB access, no side effects.
//
// generateReceipt(saleData) → HTML string
//
// saleData shape:
//   saleNumber, saleDate, storeName, storePhone, storeEmail, storeAddress,
//   customerName, subTotal, discountTotal, grandTotal,
//   lines:  [{ lineNumber, description, unitPrice, discount, lineTotal }]
//   tender: [{ tenderMethod, amount, reference }]

function esc(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function fmt(n) {
    return Number(n || 0).toLocaleString('en-AU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function fmtDate(d) {
    if (!d) return '';
    try {
        return new Date(d).toLocaleString('en-AU', {
            day:    '2-digit',
            month:  'short',
            year:   'numeric',
            hour:   '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    } catch (_) {
        return String(d);
    }
}

function generateReceipt(saleData) {
    const {
        saleNumber,
        saleDate,
        storeName,
        storePhone,
        storeEmail,
        storeAddress,
        customerName,
        subTotal      = 0,
        discountTotal = 0,
        grandTotal    = 0,
        lines  = [],
        tender = [],
    } = saleData || {};

    // Store contact line (optional fields joined with a centre dot)
    const contactParts = [storeAddress, storePhone, storeEmail].filter(Boolean);
    const storeContactHtml = contactParts.length
        ? `<p class="store-contact">${contactParts.map(esc).join(' &middot; ')}</p>`
        : '';

    // Customer row
    const customerHtml = customerName
        ? `<div class="meta-row"><span class="lbl">Customer</span><span class="val">${esc(customerName)}</span></div>`
        : `<div class="meta-row"><span class="lbl">Customer</span><span class="val muted">Walk-in</span></div>`;

    // Sale lines
    const lineRowsHtml = lines.length === 0
        ? '<tr><td colspan="2" class="no-items">No items</td></tr>'
        : lines.map((l) => {
            const total   = l.lineTotal !== undefined ? l.lineTotal : (l.unitPrice || 0) - (l.discount || 0);
            const discRow = Number(l.discount) > 0
                ? `<div class="disc-row">Discount&ensp;&minus;$${fmt(l.discount)}</div>`
                : '';
            return `<tr>
      <td class="desc-cell"><div>${esc(l.description || '')}</div>${discRow}</td>
      <td class="price-cell">$${fmt(total)}</td>
    </tr>`;
        }).join('');

    // Subtotal / discount rows (only shown when there is a discount)
    const showSubBlock = Number(discountTotal) > 0;
    const subBlockHtml = showSubBlock ? `
    <div class="totals-row"><span>Subtotal</span><span>$${fmt(subTotal)}</span></div>
    <div class="totals-row disc-text"><span>Discount</span><span>&minus;$${fmt(discountTotal)}</span></div>` : '';

    // GST (10% included in GST-inclusive price, i.e. grandTotal / 11)
    const gstIncluded = Number(grandTotal) / 11;

    // Tender rows
    const tenderHtml = tender.map((t) =>
        `<div class="tender-row"><span>${esc(t.tenderMethod || '')}</span><span>$${fmt(t.amount)}</span></div>`
    ).join('');

    // Change due (cash only)
    const cashPaid = tender
        .filter((t) => t.tenderMethod === 'Cash')
        .reduce((s, t) => s + Number(t.amount), 0);
    const changeAmt  = cashPaid - Number(grandTotal);
    const changeHtml = cashPaid > 0 && changeAmt >= -0.001
        ? `<div class="change-row"><span>Change</span><span>$${fmt(Math.max(0, changeAmt))}</span></div>`
        : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Receipt #${saleNumber != null ? saleNumber : ''} — $${Number(grandTotal || 0).toFixed(2)}</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    @page{size:A4;margin:18mm 22mm}
    body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a1a;background:#fff;font-size:13px;line-height:1.55}
    .receipt{max-width:540px;margin:0 auto;padding:28px 0}
    .store-name{font-size:22px;font-weight:700;letter-spacing:-0.3px;color:#1a1a1a}
    .store-contact{font-size:11px;color:#777;margin-top:3px}
    .tax-label{display:inline-block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#bbb;margin-top:5px}
    hr{border:none}
    .rule-thin{border-top:1px solid #e0e0e0;margin:14px 0}
    .rule-thick{border-top:2px solid #1a1a1a;margin:16px 0}
    .meta-row{display:flex;justify-content:space-between;font-size:12px;padding:2px 0}
    .lbl{color:#888}.val{font-weight:500}.muted{color:#bbb}
    table{width:100%;border-collapse:collapse}
    thead th{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#bbb;padding:6px 0;border-bottom:1px solid #e0e0e0;text-align:left}
    thead th.price-hdr{text-align:right}
    tbody td{padding:10px 0;border-bottom:1px solid #f2f2f2;vertical-align:top}
    .desc-cell{font-size:13px}
    .disc-row{font-size:11px;color:#c07000;margin-top:2px}
    .price-cell{text-align:right;font-weight:500;white-space:nowrap;padding-left:16px}
    .no-items{color:#bbb;font-style:italic;padding:12px 0}
    .totals-block{padding:10px 0 2px}
    .totals-row{display:flex;justify-content:space-between;font-size:12px;color:#666;padding:2px 0}
    .disc-text{color:#c07000}
    .grand-row{display:flex;justify-content:space-between;font-size:18px;font-weight:700;padding:10px 0 3px}
    .gst-row{font-size:11px;color:#bbb;padding-bottom:8px}
    .tender-block{padding:6px 0}
    .tender-row{display:flex;justify-content:space-between;font-size:12px;color:#555;padding:2px 0}
    .change-row{display:flex;justify-content:space-between;font-size:12px;font-weight:600;padding:2px 0;color:#1a1a1a}
    .footer{text-align:center;padding-top:22px}
    .footer-thanks{font-size:13px;font-weight:500;color:#333}
    .footer-policy{font-size:11px;color:#bbb;margin-top:5px}
    @media print{body{margin:0}.receipt{padding:0}}
  </style>
</head>
<body>
<div class="receipt">

  <div class="store-name">${esc(storeName || 'NovaPOS Store')}</div>
  ${storeContactHtml}
  <div class="tax-label">Tax Invoice</div>

  <hr class="rule-thin">

  <div class="meta-row"><span class="lbl">Sale Number</span><span class="val">#${saleNumber != null ? saleNumber : '&mdash;'}</span></div>
  <div class="meta-row"><span class="lbl">Date</span><span class="val">${esc(fmtDate(saleDate))}</span></div>
  ${customerHtml}

  <hr class="rule-thin">

  <table>
    <thead>
      <tr><th>Description</th><th class="price-hdr">Price</th></tr>
    </thead>
    <tbody>
      ${lineRowsHtml}
    </tbody>
  </table>

  <div class="totals-block">
    ${subBlockHtml}
    <div class="grand-row"><span>Total</span><span>$${fmt(grandTotal)}</span></div>
    <div class="gst-row">Includes GST&ensp;$${fmt(gstIncluded)}</div>
  </div>

  <hr class="rule-thin">

  <div class="tender-block">
    ${tenderHtml}
    ${changeHtml}
  </div>

  <hr class="rule-thick">

  <div class="footer">
    <div class="footer-thanks">Thank you for your purchase</div>
    <div class="footer-policy">Returns accepted within 30 days with original receipt</div>
  </div>

</div>
</body>
</html>`;
}

module.exports = { generateReceipt };
