/* HireHector documents: quote, invoice and contract PDFs, made in the browser with jsPDF. */
(function () {
  'use strict';
  const INK = [54, 47, 45], MUTED = [106, 97, 94], MAROON = [122, 31, 46], RULE = [200, 192, 186];
  const DOWFULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const PLATES = { Hector: 'RWA62E', Helga: 'LKC350E' };

  const TERMS = [
    ['Booking and fee', 'Your date is only secured once we have received the booking fee and a signed copy of your hire agreement. The booking fee is non-refundable, unless we cancel (see clause 9).'],
    ['Payment', 'The balance is due on the date shown in your hire agreement. Payment is by bank transfer. We may cancel the booking if the balance is not received by that date.'],
    ['The vehicles', 'Hector (red and cream) and Helga (blue and white) are vintage vehicles. We will always provide the van or vans named in your agreement. If one is unavailable we will offer a comparable alternative or a refund.'],
    ['Chauffeur-driven', 'Our vans are hired with a driver only. Clients and guests may not drive them.'],
    ['Timings', 'The agreement lists the agreed journeys. Please be ready at the pick-up time, as delays may shorten your hire. Extra time or stops can be added at the agreed rate.'],
    ['Capacity and safety', 'Seat belts are fitted and must be worn where provided. The number of passengers must not exceed the seats available. Please ask guests to take care when climbing in and out.'],
    ['Decorations', 'Ribbons and flowers may be attached only with our agreement and only using fixings we provide. Confetti and glitter are not allowed in or near the vans. You may play your own music if the driver agrees.'],
    ['Food and drink', 'Drinks are welcome in the vans, but we ask that red wine and sticky foods are kept out. A cleaning fee may apply for anything that needs a deep clean.'],
    ['Cancellation by us', 'If we have to cancel, for example because of mechanical failure, we will tell you as soon as we can, try to supply an alternative and refund anything you have paid if we cannot.'],
    ['Breakdown', 'If a van breaks down on the day we will arrange a replacement where we can. If we cannot complete your hire, we will refund the hire cost for the part not completed.'],
    ['Cancellation by you', 'If you cancel, the booking fee is kept. If you cancel less than 28 days before the date, the full hire cost is payable unless we can re-let the vans.'],
    ['Weather', 'We cannot be held responsible for delays caused by weather or traffic. In the event of extreme conditions we may agree a new date.'],
    ['Proms and school events', 'If the hire is for a prom or school event, the person booking must confirm they are an adult and that any insurance needed by the school or venue is in place.'],
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

  const CREAM = [244, 236, 224], GOLD = [176, 141, 87], PT = 0.3528;

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
      w.font({ font: 'times', style: 'bold', size: 27, color: MAROON });
      doc.text(S2.business_name || 'HireHector', L, w.y + 7);
      w.font({ font: 'times', style: 'italic', size: 10.5, color: MUTED });
      doc.text('Vintage VW split screen camper hire', L, w.y + 13);
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
  function ref(b, p) { return p + '-' + (b.hire_date ? b.hire_date.slice(0, 4) : '') + '-' + String(b.id || '').slice(0, 4).toUpperCase(); }
  function clientBlock(b) { return b.client + (b.address ? '\n' + b.address : ''); }
  function hireRows(w, b) {
    w.row('Date', longDate(b.hire_date));
    w.row('Vehicles', vansText(b));
    if (b.journey) w.row('Journeys', b.journey);
  }

  function quote(b, S, c) {
    const w = writer(S);
    w.letterhead('Quote', 'Ref ' + ref(b, 'Q') + '  ·  Issued ' + longDate(today()));
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
    doc.text(b.client, w.L, y0 + 26);
    doc.text((S.owner ? S.owner + ', for ' : 'For ') + (S.business_name || 'HireHector'), x2, y0 + 26);
    w.font({ size: 9, color: MUTED });
    doc.text('Date  ____ / ____ / ________', w.L, y0 + 33);
    doc.text('Date  ' + longDate(today()), x2, y0 + 33);
    w.y = y0 + 40;

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

  window.HHPDF = { quote: quote, invoice: invoice, contract: contract, TERMS: TERMS };
})();
