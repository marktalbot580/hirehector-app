/* HireHector client page: accept a quote and sign the hire agreement from a private link. */
(function () {
  'use strict';
  const CFG = window.HH_CONFIG, P = window.HHPDF;
  const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY);
  const T = new URLSearchParams(location.search).get('t') || '';
  const app = document.getElementById('app');
  let D = null, drawn = false;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function toast(m) { const t = document.getElementById('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3500); }

  function model() {
    const s = D.s || {}, share = parseFloat(s.booking_fee_share) || 1 / 3, cost = Number(D.cost) || 0, fee = Math.round(cost * share);
    const b = { id: '', client: D.client, address: D.address, hire_date: D.hire_date, van: D.van, journey: D.journey, signature: D.signature, signed_name: D.signed_name, signed_at: D.signed_at };
    return { b, s, c: { cost, fee, paid: Number(D.paid) || 0, balance: cost - fee } };
  }
  function pdfFor(kind) { const m = model(); return P[kind](m.b, m.s, m.c); }
  function save(kind, name) { pdfFor(kind).save(name); }

  function summary() {
    const m = model(), b = m.b;
    return '<section class="card stack"><h2>Your hire</h2><div>' +
      '<div class="kv"><span>Date</span><b>' + esc(P.longDate(b.hire_date)) + '</b></div>' +
      '<div class="kv"><span>Vehicles</span><b>' + esc(P.vansText(b)) + '</b></div>' +
      (b.journey ? '<div class="kv"><span>Journeys</span><b style="text-align:right">' + esc(b.journey) + '</b></div>' : '') +
      '<div class="kv"><span>Hire price</span><b>' + P.money(m.c.cost) + '</b></div>' +
      '<div class="kv"><span>Booking fee</span><b>' + P.money(m.c.fee) + '</b></div>' +
      '<div class="kv tot"><span>Balance, due ' + esc(P.dueText(b)) + '</span><b>' + P.money(m.c.balance) + '</b></div></div></section>';
  }
  function termsBlock() {
    return '<section class="card"><details><summary>Read the terms and conditions</summary><ol class="terms">' +
      P.TERMS.map((t) => '<li><b>' + esc(t[0]) + '.</b> ' + esc(t[1]) + '</li>').join('') + '</ol></details></section>';
  }
  function bankBlock() {
    const s = D.s || {};
    if (!(s.payee_name || s.sort_code || s.account_number)) return '';
    return '<section class="card stack"><h2>How to pay</h2><div>Bank transfer to ' + esc(s.payee_name || '') + '<br>Sort code ' + esc(s.sort_code || '') + ' &nbsp; Account number ' + esc(s.account_number || '') + '<br>Reference: ' + esc((D.client || '').split(' ').pop()) + ' ' + esc(D.hire_date || '') + '</div></section>';
  }
  function head() {
    const s = D.s || {};
    return '<header><div class="logo" style="font-size:34px">' + esc(s.business_name || 'HireHector') + '</div><div class="sub">Vintage VW split screen camper hire</div></header>';
  }

  function view() {
    if (!D) { app.innerHTML = '<header><div class="logo" style="font-size:34px">HireHector</div></header><section class="card"><h2>Link not found</h2><p>This link is not valid. Please ask us to send it again.</p></section>'; return; }
    const s = D.s || {}, st = D.contract_status;
    const first = esc((D.client || '').split(' ')[0]), quoting = D.status === 'quote' && !D.accepted_at;
    let h = head() + (quoting ? '<h1 style="margin:0">Quote for your wedding on ' + esc(P.longDate(D.hire_date)) + '</h1>' : '<h1 style="margin:0">Hello ' + first + '</h1>');
    if (D.status === 'quote' && !D.accepted_at) {
      h += '<p class="big">Hello ' + first + ', thank you for choosing ' + esc(s.business_name || 'HireHector') + '. Please check the details below, then press Accept to secure your date.</p>' + summary() + termsBlock() +
        '<section class="card stack"><label class="chk"><input type="checkbox" id="agree"><span>I have read the terms and conditions and I would like to book.</span></label>' +
        '<button class="btn" id="accept" disabled>Accept quote</button><button class="btn2" id="dlq">Download quote (PDF)</button></section>';
    } else if (st === 'signed' || st === 'confirmed') {
      h += '<div class="notice ok"><b>All done.</b> Your hire agreement was signed by ' + esc(D.signed_name) + ' on ' + esc(new Date(D.signed_at).toLocaleString('en-GB')) + '. Thank you. We will check it and confirm your booking.</div>' + summary() +
        '<section class="card stack"><button class="btn" id="dls">Download your signed agreement (PDF)</button></section>';
    } else if (st === 'approved') {
      h += '<p class="big">Your hire agreement is ready. Please read it, then sign below.</p>' + summary() + termsBlock() +
        '<section class="card stack"><button class="btn2" id="dlc">Download the agreement (PDF)</button></section>' +
        '<section class="card stack"><h2>Sign</h2><div class="fld"><label for="nm">Your full name</label><input id="nm" type="text" autocomplete="name" value=""></div>' +
        '<div class="fld"><label>Draw your signature with your finger or mouse</label><canvas id="sig" class="sigbox"></canvas></div>' +
        '<div class="row"><button class="btn2" id="clr" type="button">Clear</button></div>' +
        '<label class="chk"><input type="checkbox" id="agree2"><span>I agree to the hire agreement and the terms and conditions, and I am happy for this electronic signature to be used.</span></label>' +
        '<button class="btn" id="sign" disabled>Sign agreement</button></section>';
    } else if (D.accepted_at || D.status === 'booked') {
      h += '<div class="notice ok"><b>Thank you, your quote is accepted.</b> We are holding ' + esc(P.longDate(D.hire_date)) + ' for you.</div>' + summary() +
        '<section class="card"><h2>What happens next</h2><p>We will send you your hire agreement shortly. Your date is secured once the booking fee is paid and the agreement is signed.</p></section>' + bankBlock();
    } else {
      h += '<section class="card"><p>Thank you for choosing ' + esc(s.business_name || 'HireHector') + '. Please get in touch if you have any questions.</p></section>' + summary();
    }
    h += '<div class="sub" style="text-align:center">' + esc([s.phone, s.email].filter(Boolean).join('  ·  ')) + '</div>';
    app.innerHTML = h; wire();
  }

  function wire() {
    const $ = (id) => document.getElementById(id);
    if ($('agree')) { $('agree').onchange = () => { $('accept').disabled = !$('agree').checked; };
      $('accept').onclick = async () => { $('accept').disabled = true; const { data, error } = await sb.rpc('accept_quote', { t: T }); if (error) { toast('Sorry, that did not work: ' + error.message); $('accept').disabled = false; return; } D = data; view(); window.scrollTo(0, 0); }; }
    if ($('dlq')) $('dlq').onclick = () => save('quote', 'Quote.pdf');
    if ($('dlc')) $('dlc').onclick = () => save('contract', 'Hire_agreement.pdf');
    if ($('dls')) $('dls').onclick = () => save('contract', 'Signed_hire_agreement.pdf');
    if ($('sig')) {
      const cv = $('sig'), r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
      const cx = cv.getContext('2d'); cx.scale(dpr, dpr); cx.lineWidth = 2.4; cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.strokeStyle = '#1b1b3a';
      drawn = false; let down = false;
      const pt = (e) => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
      const upd = () => { $('sign').disabled = !(drawn && $('nm').value.trim().length > 1 && $('agree2').checked); };
      cv.addEventListener('pointerdown', (e) => { down = true; cv.setPointerCapture(e.pointerId); const p = pt(e); cx.beginPath(); cx.moveTo(p[0], p[1]); cx.lineTo(p[0] + 0.1, p[1] + 0.1); cx.stroke(); drawn = true; upd(); e.preventDefault(); });
      cv.addEventListener('pointermove', (e) => { if (!down) return; const p = pt(e); cx.lineTo(p[0], p[1]); cx.stroke(); e.preventDefault(); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((n) => cv.addEventListener(n, () => { down = false; }));
      $('clr').onclick = () => { cx.clearRect(0, 0, cv.width, cv.height); drawn = false; upd(); };
      $('nm').oninput = upd; $('agree2').onchange = upd;
      $('sign').onclick = async () => {
        $('sign').disabled = true;
        const { data, error } = await sb.rpc('sign_contract', { t: T, nm: $('nm').value.trim(), sig: cv.toDataURL('image/png') });
        if (error) { toast('Sorry, that did not work: ' + error.message); $('sign').disabled = false; return; }
        D = data; view(); window.scrollTo(0, 0);
      };
    }
  }

  sb.rpc('client_view', { t: T }).then((r) => { D = r.error ? null : r.data; view(); }, () => { D = null; view(); });
})();
