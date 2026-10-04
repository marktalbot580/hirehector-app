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
  function money(n) { n = Number(n) || 0; return '£' + (Number.isInteger(n) ? String(n) : n.toFixed(2)); }
  function vansText(b) {
    if (b.van === 'Both') return 'Hector (' + PLATES.Hector + ') and Helga (' + PLATES.Helga + ')';
    return b.van ? b.van + ' (' + PLATES[b.van] + ')' : 'Van to be confirmed';
  }
  function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  function writer() {
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    const L = 18, R = 192, W = R - L;
    const w = { doc, y: 20, L, R, W };
    w.text = function (str, o) {
      o = o || {};
      doc.setFont('helvetica', o.bold ? 'bold' : 'normal');
      doc.setFontSize(o.size || 11);
      doc.setTextColor.apply(doc, o.color || INK);
      const lines = doc.splitTextToSize(String(str), o.width || W);
      const lh = (o.size || 11) * 0.5;
      lines.forEach(function (ln) {
        if (w.y > 280) { doc.addPage(); w.y = 20; }
        doc.text(ln, o.right ? R : L, w.y, o.right ? { align: 'right' } : undefined);
        w.y += lh;
      });
      w.y += o.gap == null ? 2 : o.gap;
    };
    w.rule = function (heavy) {
      doc.setDrawColor.apply(doc, heavy ? INK : RULE); doc.setLineWidth(heavy ? 0.5 : 0.2);
      doc.line(L, w.y, R, w.y); w.y += 4;
    };
    w.heading = function (s) { w.y += 3; w.text(s.toUpperCase(), { size: 9, bold: true, color: MUTED, gap: 1 }); };
    w.kv = function (a, b, o) {
      o = o || {};
      doc.setFont('helvetica', o.bold ? 'bold' : 'normal'); doc.setFontSize(11); doc.setTextColor.apply(doc, INK);
      doc.text(String(a), L, w.y); doc.text(String(b), R, w.y, { align: 'right' });
      w.y += 3; doc.setDrawColor.apply(doc, o.bold ? INK : RULE); doc.setLineWidth(o.bold ? 0.5 : 0.2); doc.line(L, w.y, R, w.y); w.y += 5;
    };
    return w;
  }
  function head(w, S) {
    w.text(S.business_name || 'HireHector', { size: 24, bold: true, color: MAROON, gap: 1 });
    w.text([S.address, [S.phone, S.email].filter(Boolean).join('  |  ')].filter(Boolean).join('\n'), { size: 9, color: MUTED, gap: 3 });
    w.rule(true);
  }
  function ref(b, p) { return p + '-' + (b.hire_date ? b.hire_date.slice(0, 4) : '') + '-' + String(b.id || '').slice(0, 4).toUpperCase(); }

  function quote(b, S, c) {
    const w = writer(); head(w, S);
    w.text('Quote', { size: 20, bold: true, gap: 1 });
    w.text('Reference ' + ref(b, 'Q') + '   |   Issued ' + longDate(today()), { size: 9, color: MUTED, gap: 4 });
    w.heading('Prepared for'); w.text(b.client + (b.address ? '\n' + b.address : ''), { bold: false });
    w.heading('Your hire'); w.text('Date: ' + longDate(b.hire_date) + '\nVehicles: ' + vansText(b) + (b.journey ? '\nJourneys: ' + b.journey : ''));
    w.heading('Cost'); w.y += 1;
    w.kv('Hire price', money(c.cost));
    w.kv('Booking fee to secure your date', money(c.fee));
    w.kv('Balance after the booking fee', money(c.balance), { bold: true });
    w.text('Our vans are hired with a driver. To accept this quote, please reply to the email it came with and we will hold your date and send your hire agreement.', { size: 10, color: MUTED });
    return w.doc;
  }

  function invoice(b, S, c) {
    const w = writer(); head(w, S);
    w.text('Invoice', { size: 20, bold: true, gap: 1 });
    w.text('Reference ' + ref(b, 'INV') + '   |   Issued ' + longDate(today()), { size: 9, color: MUTED, gap: 4 });
    w.heading('Billed to'); w.text(b.client + (b.address ? '\n' + b.address : ''));
    w.heading('Description');
    w.text('Wedding hire, ' + longDate(b.hire_date) + '\n' + vansText(b) + (b.journey ? '\n' + b.journey : ''));
    w.y += 1;
    w.kv('Hire price', money(c.cost));
    w.kv('Less payments received', '-' + money(c.paid));
    w.kv('Balance due', money(Math.max(c.cost - c.paid, 0)), { bold: true });
    if (S.payee_name || S.sort_code || S.account_number) {
      w.heading('How to pay');
      w.text('Bank transfer to ' + (S.payee_name || '') + '\nSort code ' + (S.sort_code || '') + '   Account number ' + (S.account_number || '') + '\nReference: ' + (b.client.split(' ').pop() || '') + ' ' + (b.hire_date || ''));
    }
    return w.doc;
  }

  function contract(b, S, c) {
    const w = writer(); head(w, S);
    w.text('Hire agreement', { size: 20, bold: true, gap: 3 });
    w.text('This agreement is between ' + (S.business_name || 'HireHector') + ' ("we", "us") and the client named below ("you"). It confirms the hire of our vintage VW split screen campers, with a driver, for your special day. The terms and conditions on the last page form part of this agreement.');
    w.heading('1. The client'); w.text(b.client + '\n' + (b.address || '[client address to be added]'));
    w.heading('2. The vehicles'); w.text(vansText(b));
    w.heading('3. Date and journeys');
    w.text(longDate(b.hire_date) + '\nPick-up and departure times to be confirmed nearer the date.' + (b.journey ? '\n' + b.journey : ''));
    w.heading('4. Cost and payment'); w.y += 1;
    w.kv('Total hire cost', money(c.cost));
    w.kv('Booking fee (non-refundable)', money(c.fee));
    w.kv('Balance', money(c.balance), { bold: true });
    w.text('The booking fee secures your date. The balance is due on [date to be agreed]. Please pay by bank transfer to ' + (S.payee_name || '[payee]') + ', sort code ' + (S.sort_code || '[sort code]') + ', account number ' + (S.account_number || '[account number]') + '.');
    w.heading('5. Your booking');
    w.text('Your booking is provisional until we have received the booking fee and a signed copy of this agreement.', { gap: 8 });
    if (w.y > 235) { w.doc.addPage(); w.y = 20; }
    const y0 = w.y + 8, doc = w.doc;
    doc.setDrawColor.apply(doc, INK); doc.setLineWidth(0.3);
    doc.line(w.L, y0 + 14, w.L + 75, y0 + 14); doc.line(w.L + 95, y0 + 14, w.R, y0 + 14);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor.apply(doc, MUTED);
    doc.text('SIGNED BY THE CLIENT', w.L, y0); doc.text('SIGNED FOR ' + (S.business_name || 'HIREHECTOR').toUpperCase(), w.L + 95, y0);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor.apply(doc, INK);
    doc.text(b.client, w.L, y0 + 19); doc.text('Date: ____ / ____ / ________', w.L, y0 + 25);
    doc.text((S.owner || '') + ', on behalf of ' + (S.business_name || 'HireHector'), w.L + 95, y0 + 19);
    doc.text('Date: ' + longDate(today()), w.L + 95, y0 + 25);
    doc.addPage(); w.y = 20;
    w.text('Terms and conditions', { size: 18, bold: true, gap: 4 });
    TERMS.forEach(function (t, i) { w.text((i + 1) + '. ' + t[0], { bold: true, size: 11, gap: 0.5 }); w.text(t[1], { size: 10, gap: 3 }); });
    return doc;
  }

  window.HHPDF = { quote: quote, invoice: invoice, contract: contract, TERMS: TERMS };
})();
