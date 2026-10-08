/* HireHector documents: quote, invoice and contract PDFs, made in the browser with jsPDF. */
(function () {
  'use strict';
  const INK = [43, 38, 32], MUTED = [107, 98, 88], MAROON = [155, 44, 38], RULE = [200, 192, 186];
  const DOWFULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const LOGO_PNG = 'data:image/png;base64,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';
  const PLATES = { Hector: 'RWA62E', Helga: 'LKC350E' };

  const TERMS = [
    ['Booking and fee', 'Your date is only secured once we have received the booking fee and a signed copy of your hire agreement. The booking fee is non-refundable, unless we cancel (see clause 9).'],
    ['Payment', 'The balance is due on the date shown in your hire agreement. Payment is by bank transfer. We may cancel the booking if the balance is not received by that date.'],
    ['The vehicles', 'Hector (red and cream) and Helga (blue and white) are vintage vehicles. We will always provide the van or vans named in your agreement. If one is unavailable we will offer a comparable alternative or a refund.'],
    ['Chauffeur-driven', 'Our vans are hired with a driver only. Clients and guests may not drive them.'],
    ['Timings', 'The agreement lists the agreed journeys. Please be ready at the pick-up time, as delays may shorten your hire. Extra time or stops can be added at the agreed rate.'],
    ['Capacity and safety', 'The number of passengers must not exceed the seats available. Please ask guests to take care when climbing in and out of the vans.'],
    ['Decorations', 'Ribbons and flowers may be attached only with our agreement and only using fixings we provide. Confetti and glitter are not allowed in or near the vans. You may play your own music if the driver agrees.'],
    ['Food and drink', 'Drinks are welcome in the vans, but we ask that red wine and sticky foods are kept out. A cleaning fee may apply for anything that needs a deep clean.'],
    ['Cancellation by us', 'If we have to cancel, for example because of mechanical failure, we will tell you as soon as we can, try to supply an alternative and refund anything you have paid if we cannot.'],
    ['Breakdown', 'If a van breaks down on the day we will arrange a replacement where we can. If we cannot complete your hire, we will refund the hire cost for the part not completed.'],
    ['Cancellation by you', 'If you cancel, the booking fee is kept. If you cancel less than 28 days before the date, the full hire cost is payable unless we can re-let the vans.'],
    ['Weather', 'We cannot be held responsible for delays caused by weather or traffic. In the event of extreme conditions we may agree a new date.'],
    ['Liability', 'We hold insurance for the vans and for passengers. You are responsible for any damage caused by you or your guests beyond normal use. Our liability is limited to the hire cost.']
  ];

  function pd(iso) { const p = String(iso).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function longDate(iso) { if (!iso) return 'Date to be confirmed'; const d = pd(iso); return DOWFULL[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  // Balance is due one month before the hire date
  function dueDate(iso) {
    if (!iso) return null; const d = pd(iso), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() - 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last));
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function dueText(b) { const d = dueDate(b.hire_date); return d ? longDate(d) : 'one month before your hire date'; }
  function money(n) { n = Number(n) || 0; return '£' + (Number.isInteger(n) ? String(n) : n.toFixed(2)); }
  function vansText(b) {
    if (b.van === 'Both') return 'Hector (' + PLATES.Hector + ') and Helga (' + PLATES.Helga + ')';
    return b.van ? b.van + ' (' + PLATES[b.van] + ')' : 'Van to be confirmed';
  }
  function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  const CREAM = [244, 238, 226], GOLD = [176, 141, 87], PT = 0.3528;

  /* A small layout engine: margins, line height, page breaks, footers. */
  function writer(S) {
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    const L = 20, R = 190, W = R - L, TOP = 22, BOTTOM = 276;
    const w = { doc, y: TOP, L, R, W, S: S || {} };
    w.ensure = function (h) { if (w.y + h > BOTTOM) { doc.addPage(); w.y = TOP; } };
    w.font = function (o) {
      doc.setFont(o.font || 'helvetica', o.style || 'normal');
      doc.setFontSize(o.size || 10);
      doc.setTextColor.apply(doc, o.color || INK);
    };
    // Wrapped paragraph. o: size, style, font, color, x, width, gap (mm after), lh (line height multiplier), align
    w.para = function (str, o) {
      o = o || {}; w.font(o);
      const size = o.size || 10, x = o.x == null ? L : o.x, width = o.width || (R - x);
      const lh = size * PT * (o.lh || 1.5);
      const lines = doc.splitTextToSize(String(str), width);
      lines.forEach(function (ln) {
        w.ensure(lh);
        w.y += lh * 0.78;
        if (o.align === 'right') doc.text(ln, x + width, w.y, { align: 'right' });
        else doc.text(ln, x, w.y);
        w.y += lh * 0.22;
      });
      w.y += o.gap == null ? 2 : o.gap;
      return lines.length;
    };
    w.height = function (str, o) {
      o = o || {}; w.font(o);
      const size = o.size || 10, width = o.width || W;
      return doc.splitTextToSize(String(str), width).length * size * PT * (o.lh || 1.5);
    };
    w.rule = function (color, weight, gapBefore, gapAfter) {
      w.y += gapBefore == null ? 0 : gapBefore;
      doc.setDrawColor.apply(doc, color || RULE); doc.setLineWidth(weight || 0.2);
      doc.line(L, w.y, R, w.y); w.y += gapAfter == null ? 3 : gapAfter;
    };
    // Small spaced capitals label with a hairline underneath
    w.label = function (txt) {
      w.ensure(14); w.y += 7;
      w.font({ size: 8, style: 'bold', color: MAROON });
      doc.text(String(txt).toUpperCase(), L, w.y, { charSpace: 0.9 });
      w.y += 2; doc.setDrawColor.apply(doc, RULE); doc.setLineWidth(0.2); doc.line(L, w.y, R, w.y); w.y += 2.5;
    };
    // Label on the left, value on the right of a hairline row
    w.row = function (lab, val, o) {
      o = o || {}; const lx = 44, vw = W - lx;
      const h = Math.max(w.height(val, { width: vw, size: 10 }), 5) + 3.5;
      w.ensure(h);
      w.font({ size: 8, style: 'bold', color: MUTED });
      doc.text(String(lab).toUpperCase(), L, w.y + 3.5, { charSpace: 0.6 });
      const keep = w.y; w.y = keep - 0.6;
      w.para(val, { x: L + lx, width: vw, gap: 0 });
      w.y = keep + h; doc.setDrawColor.apply(doc, RULE); doc.setLineWidth(0.15); doc.line(L, w.y - 1, R, w.y - 1);
    };
    // Money line: description left, amount right. o.total fills a cream band.
    w.money = function (lab, amt, o) {
      o = o || {}; const h = o.total ? 11 : 8.5; w.ensure(h + 2);
      if (o.total) { doc.setFillColor.apply(doc, CREAM); doc.rect(L, w.y, W, h, 'F'); }
      w.font({ size: o.total ? 11.5 : 10.5, style: o.total ? 'bold' : 'normal', color: INK });
      doc.text(String(lab), L + (o.total ? 4 : 0), w.y + h * 0.62);
      w.font({ size: o.total ? 12.5 : 10.5, style: 'bold', color: o.total ? MAROON : INK });
      doc.text(String(amt), R - (o.total ? 4 : 0), w.y + h * 0.62, { align: 'right' });
      w.y += h;
      if (!o.total) { doc.setDrawColor.apply(doc, RULE); doc.setLineWidth(0.15); doc.line(L, w.y, R, w.y); }
    };
    // Tinted panel with text inside
    w.panel = function (title, lines) {
      const body = lines.join('\n'), bh = w.height(body, { width: W - 12, size: 10 });
      const h = bh + (title ? 11 : 6);
      w.ensure(h + 2);
      doc.setFillColor.apply(doc, CREAM); doc.rect(L, w.y, W, h, 'F');
      doc.setFillColor.apply(doc, GOLD); doc.rect(L, w.y, 1.2, h, 'F');
      const top = w.y; w.y += 5.5;
      if (title) { w.font({ size: 8, style: 'bold', color: MAROON }); doc.text(title.toUpperCase(), L + 6, w.y, { charSpace: 0.9 }); w.y += 1.5; }
      w.para(body, { x: L + 6, width: W - 12, gap: 0 });
      w.y = top + h + 4;
    };
    // Letterhead, repeated look on page one only
    w.letterhead = function (title, refText) {
      const S2 = w.S;
      let tx = L;
      try { doc.addImage(LOGO_PNG, 'PNG', L, w.y - 1, 19.5, 16); tx = L + 23; } catch (e) { tx = L; }
      w.font({ font: 'times', style: 'bold', size: 27, color: MAROON });
      doc.text(S2.business_name || 'HireHector', tx, w.y + 7);
      w.font({ font: 'times', style: 'italic', size: 10.5, color: MUTED });
      doc.text('Vintage VW split screen camper hire', tx, w.y + 13);
      const contact = [S2.address, S2.phone, S2.email].filter(Boolean);
      w.font({ size: 8.5, color: MUTED });
      let cy = w.y + 3;
      contact.forEach(function (ln) { String(ln).split('\n').forEach(function (p) { doc.text(p, R, cy, { align: 'right' }); cy += 4; }); });
      w.y = Math.max(w.y + 17, cy + 1);
      doc.setDrawColor.apply(doc, MAROON); doc.setLineWidth(0.7); doc.line(L, w.y, R, w.y);
      doc.setDrawColor.apply(doc, GOLD); doc.setLineWidth(0.2); doc.line(L, w.y + 1.3, R, w.y + 1.3);
      w.y += 12;
      w.font({ font: 'times', style: 'bold', size: 22, color: INK });
      doc.text(title, L, w.y);
      if (refText) { w.font({ size: 9, color: MUTED }); doc.text(refText, R, w.y, { align: 'right' }); }
      w.y += 3;
    };
    // Footer with page numbers on every page
    w.finish = function () {
      const n = doc.getNumberOfPages(), S2 = w.S;
      for (let i = 1; i <= n; i++) {
        doc.setPage(i);
        doc.setDrawColor.apply(doc, RULE); doc.setLineWidth(0.2); doc.line(L, 283, R, 283);
        w.font({ size: 8, color: MUTED });
        doc.text((S2.business_name || 'HireHector') + '  ·  ' + (S2.website || 'hirehector.co.uk'), L, 288);
        doc.text('Page ' + i + ' of ' + n, R, 288, { align: 'right' });
      }
      return doc;
    };
    return w;
  }
  function ref(b, p) { return [p, b.hire_date ? b.hire_date.slice(0, 4) : '', String(b.id || '').slice(0, 4).toUpperCase()].filter(Boolean).join('-'); }
  function clientBlock(b) { return b.client + (b.address ? '\n' + b.address : ''); }
  function hireRows(w, b) {
    w.row('Date', longDate(b.hire_date));
    w.row('Vehicles', vansText(b));
    if (b.journey) w.row('Journeys', b.journey);
  }

  function quote(b, S, c) {
    const w = writer(S);
    w.letterhead('Quote', 'Ref ' + ref(b, 'Q') + '  ·  Issued ' + longDate(today()));
    w.para('For your wedding on ' + longDate(b.hire_date), { size: 12, style: 'italic', font: 'times', color: MUTED, gap: 1 });
    w.label('Prepared for'); w.para(clientBlock(b), { size: 11, gap: 1 });
    w.label('Your hire'); hireRows(w, b);
    w.label('Cost'); w.y += 1;
    w.money('Hire price', money(c.cost));
    w.money('Booking fee to secure your date', money(c.fee));
    w.y += 3;
    w.money('Balance after the booking fee', money(c.balance), { total: true });
    w.para('The balance is due one month before your hire date, by ' + dueText(b) + '.', { size: 9.5, color: MUTED, gap: 1 }); w.y += 5;
    w.panel('To accept this quote', ['Reply to the email this quote came with and we will hold your date and send your hire agreement.', 'Our vans are hired with a driver.']);
    return w.finish();
  }

  function invoice(b, S, c) {
    const w = writer(S);
    w.letterhead('Invoice', 'Ref ' + ref(b, 'INV') + '  ·  Issued ' + longDate(today()));
    w.label('Billed to'); w.para(clientBlock(b), { size: 11, gap: 1 });
    w.label('For'); w.row('Service', 'Wedding hire with driver'); hireRows(w, b);
    w.label('Amount'); w.y += 1;
    w.money('Hire price', money(c.cost));
    w.money('Less payments received', '-' + money(c.paid));
    w.y += 3;
    w.money('Balance due', money(Math.max(c.cost - c.paid, 0)), { total: true });
    if (c.cost - c.paid > 0) w.para('Please pay by ' + dueText(b) + ', one month before your hire date.', { size: 9.5, color: MUTED, gap: 1 });
    w.y += 5;
    if (S.payee_name || S.sort_code || S.account_number) {
      w.panel('How to pay', ['Bank transfer to ' + (S.payee_name || ''), 'Sort code ' + (S.sort_code || '') + '    Account number ' + (S.account_number || ''), 'Please use the reference: ' + (b.client.split(' ').pop() || '') + ' ' + (b.hire_date || '')]);
    }
    return w.finish();
  }

  function clause(w, num, title, body) {
    const bh = w.height(body, { x: 0, width: w.W - 10, size: 10 });
    w.ensure(Math.min(bh + 12, 40));
    w.font({ font: 'times', style: 'bold', size: 13, color: MAROON });
    w.doc.text(String(num) + '.', w.L, w.y + 5);
    w.font({ font: 'times', style: 'bold', size: 12.5, color: INK });
    w.doc.text(title, w.L + 10, w.y + 5);
    w.y += 7.5;
    w.para(body, { x: w.L + 10, width: w.W - 10, gap: 4.5 });
  }

  function contract(b, S, c) {
    const w = writer(S);
    w.letterhead('Hire agreement', 'Ref ' + ref(b, 'HA'));
    w.y += 4;
    w.para('This agreement is between ' + (S.business_name || 'HireHector') + ' ("we", "us") and the client named below ("you"). It confirms the hire of our vintage VW split screen campers, with a driver, for your special day. The terms and conditions on the last page form part of this agreement.', { size: 10.5, gap: 2 });
    clause(w, 1, 'The client', b.client + '\n' + (b.address || '[client address to be added]'));
    clause(w, 2, 'The vehicles', vansText(b) + '\nOur vans are hired with a driver only.');
    clause(w, 3, 'Date and journeys', longDate(b.hire_date) + '\nPick-up and departure times to be confirmed nearer the date.' + (b.journey ? '\n' + b.journey : ''));
    clause(w, 4, 'Cost and payment',
      'Total hire cost ' + money(c.cost) + '. Booking fee ' + money(c.fee) + ' (non-refundable). Balance ' + money(c.balance) + ', due by ' + dueText(b) + ' (one month before your hire date).\n' +
      'Please pay by bank transfer to ' + (S.payee_name || '[payee]') + ', sort code ' + (S.sort_code || '[sort code]') + ', account number ' + (S.account_number || '[account number]') + '.');
    clause(w, 5, 'Your booking', 'Your booking is provisional until we have received the booking fee and a signed copy of this agreement.');

    // Signatures, kept together
    w.ensure(48); w.y += 2;
    const doc = w.doc, y0 = w.y, colW = 76, x2 = w.L + 94;
    w.font({ size: 8, style: 'bold', color: MAROON });
    doc.text('SIGNED BY THE CLIENT', w.L, y0, { charSpace: 0.9 });
    doc.text('SIGNED FOR ' + (S.business_name || 'HIREHECTOR').toUpperCase(), x2, y0, { charSpace: 0.9 });
    doc.setDrawColor.apply(doc, INK); doc.setLineWidth(0.3);
    doc.line(w.L, y0 + 20, w.L + colW, y0 + 20); doc.line(x2, y0 + 20, x2 + colW, y0 + 20);
    w.font({ size: 10, color: INK });
    if (b.signature) { try { doc.addImage(b.signature, 'PNG', w.L, y0 + 3, 62, 16); } catch (e) {} }
    doc.text(b.signed_name || b.client, w.L, y0 + 26);
    doc.text((S.owner ? S.owner + ', for ' : 'For ') + (S.business_name || 'HireHector'), x2, y0 + 26);
    w.font({ size: 9, color: MUTED });
    const sd = b.signed_at ? new Date(b.signed_at) : null;
    doc.text(sd ? 'Date  ' + longDate(sd.getFullYear() + '-' + String(sd.getMonth() + 1).padStart(2, '0') + '-' + String(sd.getDate()).padStart(2, '0')) : 'Date  ____ / ____ / ________', w.L, y0 + 33);
    doc.text('Date  ' + longDate((b.approved_at || '').slice(0, 10) || today()), x2, y0 + 33);
    if (sd) { w.font({ size: 8, color: MUTED }); doc.text('Signed electronically by ' + (b.signed_name || b.client) + ' on ' + sd.toLocaleString('en-GB') + (b.signed_ip ? ' (IP ' + String(b.signed_ip).split(',')[0] + ')' : '') + '.', w.L, y0 + 39); }
    w.y = y0 + 44;

    doc.addPage(); w.y = TOP_PAGE;
    w.font({ font: 'times', style: 'bold', size: 20, color: INK });
    doc.text('Terms and conditions', w.L, w.y + 6);
    doc.setDrawColor.apply(doc, MAROON); doc.setLineWidth(0.7); doc.line(w.L, w.y + 10, w.R, w.y + 10);
    doc.setDrawColor.apply(doc, GOLD); doc.setLineWidth(0.2); doc.line(w.L, w.y + 11.3, w.R, w.y + 11.3);
    w.y += 15;
    TERMS.forEach(function (t, i) {
      const bh = w.height(t[1], { width: w.W - 10, size: 9.5, lh: 1.42 });
      w.ensure(bh + 8);
      w.font({ font: 'times', style: 'bold', size: 11, color: MAROON }); doc.text((i + 1) + '.', w.L, w.y + 4);
      w.font({ font: 'times', style: 'bold', size: 11, color: INK }); doc.text(t[0], w.L + 10, w.y + 4);
      w.y += 5.5; w.para(t[1], { x: w.L + 10, width: w.W - 10, size: 9.5, lh: 1.42, gap: 2.2 });
    });
    return w.finish();
  }
  const TOP_PAGE = 22;

  window.HHPDF = { quote: quote, invoice: invoice, contract: contract, TERMS: TERMS, longDate: longDate, money: money, vansText: vansText, dueText: dueText };
})();
