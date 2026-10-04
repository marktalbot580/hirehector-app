/* HireHector: bookings, quotes, contracts, servicing and accounts. Data lives in Supabase; sign-in is required. */
(function () {
  'use strict';
  const CFG = window.HH_CONFIG;
  const APP_VERSION = '1.3.1';
  const FORCE_PW = /type=(invite|recovery)/.test(location.hash);
  const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY);
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DOWFULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const VANS = { Hector: { plate: 'RWA62E', colour: '#7A1F2E', desc: 'Red & cream' }, Helga: { plate: 'LKC350E', colour: '#17607A', desc: 'Blue & white' } };
  const TONES = { complete: ['#E3F3EA', '#14633C', 'Complete'], booked: ['#E4F0F3', '#0F4659', 'Booked'], quote: ['#FFF0D2', '#7A4F00', 'Quote'], refund: ['#F6E9EB', '#5E1623', 'Refunded'] };
  const pad = (n) => String(n).padStart(2, '0');
  const isoOf = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const TODAY = isoOf(new Date());
  const pd = (iso) => { const p = String(iso).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  const money = (n) => { n = Number(n) || 0; return '£' + (Number.isInteger(n) ? String(n) : n.toFixed(2)); };
  const shortDate = (iso) => { if (!iso) return 'No date'; const d = pd(iso); return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); };
  const longDate = (iso) => { if (!iso) return 'No date'; const d = pd(iso); return DOWFULL[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); };
  const r1 = (n) => Math.round(n * 10) / 10;
  const num = (v) => { const x = parseFloat(v); return isNaN(x) ? 0 : x; };

  const S = { user: null, ready: false, bookings: [], servicing: [], receipts: [], fillups: [], settings: {}, filters: { year: 'all', status: 'all' }, cal: null, taxYear: null, contractYear: null };

  /* ---------- helpers ---------- */
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3200); }
  function setting(k, d) { const v = S.settings[k]; return v == null || v === '' ? d : v; }
  function rate(v) { return num(setting(v.toLowerCase() + '_cost_per_mile', v === 'Hector' ? 0.309 : 0.346)); }
  function feeShare() { return num(setting('booking_fee_share', 1 / 3)) || 1 / 3; }
  function calc(b) { const cost = num(b.cost); const fee = Math.round(cost * feeShare()); return { cost, fee, paid: num(b.paid), balance: cost - fee }; }
  function vansOf(b) { return b.van === 'Both' ? ['Hector', 'Helga'] : (b.van ? [b.van] : []); }
  function fuelEst(b) {
    if (b.miles_per_van == null || b.miles_per_van === '') return null;
    const vs = vansOf(b);
    const r = vs.length ? vs.reduce((t, v) => t + rate(v), 0) : (rate('Hector') + rate('Helga')) / 2;
    return Math.round(num(b.miles_per_van) * r * 100) / 100;
  }
  function milesTotal(b) { return b.miles_per_van == null || b.miles_per_van === '' ? null : r1(num(b.miles_per_van) * Math.max(vansOf(b).length, 1)); }
  function milesLine(b) { const m = milesTotal(b); return m == null ? 'Miles not recorded' : m + ' miles, fuel about ' + money(fuelEst(b)); }
  function due(b) { return b.status === 'booked' || b.status === 'quote' ? num(b.cost) - num(b.paid) : 0; }
  function chip(s) { const t = TONES[s] || TONES.quote; return '<span class="chip" style="background:' + t[0] + ';color:' + t[1] + '">' + t[2] + '</span>'; }
  function vanDots(b) { return vansOf(b).map((v) => '<span class="dot" style="background:' + VANS[v].colour + '"></span>').join(''); }
  function vanLabel(b) { return b.van === 'Both' ? 'Both vans' : (b.van || 'Van not set'); }
  function slug(n) { return String(n).trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, ''); }
  function compact(iso) { const p = iso.split('-'); return p[2] + p[1] + p[0]; }
  function safeName(n) { return String(n).replace(/[^A-Za-z0-9._-]/g, '_'); }
  function taxYearOf(iso) { const d = pd(iso); return d >= new Date(d.getFullYear(), 3, 6) ? d.getFullYear() : d.getFullYear() - 1; }
  function inTax(iso, y) { return !!iso && iso >= y + '-04-06' && iso <= (y + 1) + '-04-05'; }
  function getSettings() { const o = {}; Object.keys(S.settings).forEach((k) => { o[k] = S.settings[k]; }); return o; }
  async function run(fn) { try { return await fn(); } catch (e) { console.error(e); toast(e.message || 'Something went wrong'); } }

  /* ---------- data ---------- */
  async function load() {
    const q = (t, o) => sb.from(t).select('*').order(o, { ascending: true });
    const [b, s, r, f, st] = await Promise.all([q('bookings', 'hire_date'), q('servicing', 'service_date'), q('receipts', 'receipt_date'), q('fillups', 'fill_date'), sb.from('settings').select('*')]);
    [b, s, r, f, st].forEach((x) => { if (x.error) throw x.error; });
    S.bookings = b.data; S.servicing = s.data; S.receipts = r.data; S.fillups = f.data;
    S.settings = {}; st.data.forEach((x) => { S.settings[x.key] = x.value; });
    S.ready = true;
  }
  async function upload(path, file) {
    const { error } = await sb.storage.from('files').upload(path, file, { upsert: true, contentType: file.type || undefined });
    if (error) throw error;
    return path;
  }
  async function openFile(path) {
    const w = window.open('', '_blank');
    const { data, error } = await sb.storage.from('files').createSignedUrl(path, 3600);
    if (error) { if (w) w.close(); throw error; }
    if (w) w.location = data.signedUrl; else location.href = data.signedUrl;
  }

  /* ---------- layout ---------- */
  const ICONS = {
    home: '<path d="M3 11l9-8 9 8v10H3z"/><path d="M9 21v-7h6v7"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    coins: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'
  };
  const ic = (n) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[n] + '</svg>';
  const NAV = [
    ['home', 'Home', 'home', 1], ['bookings', 'Bookings', 'list', 1], ['calendar', 'Calendar', 'cal', 1], ['accounts', 'Accounts', 'coins', 1],
    ['contracts', 'Contracts', 'folder', 0], ['servicing', 'Servicing', 'wrench', 0], ['terms', 'Terms', 'shield', 0], ['settings', 'Settings', 'gear', 0]
  ];
  function shell(active, inner) {
    const links = NAV.map((n) => '<a href="#/' + n[0] + '" class="' + (n[3] ? '' : 'desk ') + (active === n[0] || (n[0] === 'bookings' && active === 'booking') ? 'on' : '') + '">' + ic(n[2]) + n[1] + '</a>').join('') +
      '<a href="#/more" class="mob ' + (active === 'more' ? 'on' : '') + '">' + ic('more') + 'More</a>';
    return '<div class="shell"><header class="top"><div><div class="logo">HireHector</div><small>hirehector.co.uk</small></div></header><nav class="nav" aria-label="Main">' + links + '</nav><main class="main">' + inner + '</main></div>';
  }

  /* ---------- views ---------- */
  function viewPassword(forced) {
    return (forced ? '<div class="login"><div><div class="logo" style="font-size:38px">HireHector</div><div class="sub">Choose your password</div></div>' : '<header><h1>Change password</h1></header>') +
      '<form class="card stack" data-form="setpw"><div class="fld"><label for="np">New password (at least 8 characters)</label><input id="np" name="password" type="password" autocomplete="new-password" minlength="8" required></div>' +
      '<div class="fld"><label for="np2">Type it again</label><input id="np2" name="password2" type="password" autocomplete="new-password" minlength="8" required></div>' +
      '<button class="btn" type="submit">Save password</button></form>' + (forced ? '</div>' : '');
  }
  function viewLogin(err, info) {
    return '<div class="login"><div><div class="logo" style="font-size:38px">HireHector</div><div class="sub">Sign in to the booking app</div></div>' +
      '<form class="card stack" data-form="login"><div class="fld"><label for="em">Email</label><input id="em" name="email" type="email" autocomplete="username" required></div>' +
      '<div class="fld"><label for="pw">Password</label><input id="pw" name="password" type="password" autocomplete="current-password" required></div>' +
      (err ? '<div class="notice err" role="alert">' + esc(err) + '</div>' : '') +
      '<button class="btn" type="submit">Sign in</button><button class="btn2" type="button" data-act="forgot">Forgot password? Email me a link</button></form>' + (info ? '<div class="notice" role="status">' + esc(info) + '</div>' : '') + '<div class="sub">Access is only for people added by Christine or Nigel.</div></div>';
  }

  function bookingRow(b) {
    const d = b.hire_date ? pd(b.hire_date) : null;
    return '<a class="item" href="#/booking/' + b.id + '"><div class="date"><span>' + (d ? MON[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2) : '') + '</span><b>' + (d ? d.getDate() : '-') + '</b></div>' +
      '<div class="grow"><div style="font-weight:700">' + esc(b.client) + '</div><div class="sub">' + vanDots(b) + ' ' + esc(vanLabel(b)) + (b.journey ? ' · ' + esc(b.journey) : '') + '</div><div class="sub">' + esc(milesLine(b)) + '</div></div>' +
      '<div style="text-align:right">' + chip(b.status) + (due(b) ? '<div style="font-weight:700;color:#7A1F2E;margin-top:4px">' + money(due(b)) + ' to pay</div>' : '<div class="sub" style="margin-top:4px">' + money(b.paid) + ' of ' + money(b.cost) + '</div>') + '</div></a>';
  }

  function viewHome() {
    const up = S.bookings.filter((b) => b.hire_date >= TODAY && b.status === 'booked');
    const done = S.bookings.filter((b) => b.status === 'complete');
    const chase = S.bookings.filter((b) => b.status === 'booked' || b.status === 'quote');
    const taken = S.bookings.filter((b) => b.status === 'complete' || b.status === 'booked').reduce((t, b) => t + num(b.paid), 0);
    const recent = S.bookings.filter((b) => b.hire_date < TODAY && b.status !== 'quote').slice(-5).reverse();
    return '<header><div class="sub">' + longDate(TODAY) + '</div><h1>Hello</h1></header>' + draftCard() + notices() +
      '<div class="grid"><div class="card tile"><div class="eyebrow">Upcoming</div><div class="n">' + up.length + '</div><div class="sub">' + (up[0] ? esc(up[0].client) + ', ' + shortDate(up[0].hire_date) : 'Nothing booked') + '</div></div>' +
      '<div class="card tile"><div class="eyebrow">Jobs completed</div><div class="n">' + done.length + '</div></div>' +
      '<div class="card tile"><div class="eyebrow">Balances to collect</div><div class="n" style="color:#7A1F2E">' + money(up.reduce((t, b) => t + due(b), 0)) + '</div></div>' +
      '<div class="card tile"><div class="eyebrow">Taken so far</div><div class="n">' + money(taken) + '</div></div></div>' +
      '<div class="row"><a class="btn" href="#/new">New quote</a><a class="btn2" href="#/calendar">Calendar</a></div>' +
      '<section class="card"><h2>Coming up</h2>' + (up.length ? up.map(bookingRow).join('') : '<p class="sub">No upcoming bookings.</p>') + '</section>' +
      '<section class="card"><h2>Chase up</h2><div class="sub">Quotes not yet accepted and balances not yet paid.</div>' + (chase.length ? chase.map((b) => '<a class="item" href="#/booking/' + b.id + '"><div class="grow"><b>' + esc(b.client) + '</b><div class="sub">' + shortDate(b.hire_date) + '</div></div>' + chip(b.status) + '<b style="color:#7A1F2E">' + (b.status === 'quote' ? 'Quote ' + money(b.cost) : money(due(b)) + ' due') + '</b></a>').join('') : '<p class="sub">Nothing to chase.</p>') + '</section>' +
      '<section class="card"><h2>Recent jobs</h2>' + recent.map(bookingRow).join('') + '</section>';
  }

  function viewBookings() {
    const yrs = ['all'].concat(Array.from(new Set(S.bookings.map((b) => (b.hire_date || '').slice(0, 4)).filter(Boolean))).sort());
    const sts = [['all', 'All'], ['complete', 'Complete'], ['booked', 'Booked'], ['quote', 'Quote'], ['refund', 'Refunded']];
    const rows = S.bookings.filter((b) => (S.filters.year === 'all' || (b.hire_date || '').slice(0, 4) === S.filters.year) && (S.filters.status === 'all' || b.status === S.filters.status)).slice().reverse();
    const sum = (f) => rows.reduce((t, b) => t + f(b), 0);
    return '<header class="row sp"><div><div class="sub">Every hire</div><h1>Bookings</h1></div><a class="btn" href="#/new">New quote</a></header>' +
      '<section class="card stack"><div class="lbl eyebrow">Year</div><div class="chips">' + yrs.map((y) => '<button class="pill ' + (S.filters.year === y ? 'on' : '') + '" data-act="fyear" data-v="' + y + '">' + (y === 'all' ? 'All years' : y) + '</button>').join('') + '</div>' +
      '<div class="lbl eyebrow">Status</div><div class="chips">' + sts.map((s) => '<button class="pill ' + (S.filters.status === s[0] ? 'on' : '') + '" data-act="fstatus" data-v="' + s[0] + '">' + s[1] + '</button>').join('') + '</div></section>' +
      '<div class="grid"><div class="card tile"><div class="eyebrow">Showing</div><div class="n">' + rows.length + '</div></div><div class="card tile"><div class="eyebrow">Quoted</div><div class="n">' + money(sum((b) => num(b.cost))) + '</div></div><div class="card tile"><div class="eyebrow">Received</div><div class="n">' + money(sum((b) => num(b.paid))) + '</div></div><div class="card tile"><div class="eyebrow">Miles</div><div class="n">' + r1(sum((b) => milesTotal(b) || 0)) + '</div></div><div class="card tile"><div class="eyebrow">Est. fuel</div><div class="n">' + money(sum((b) => fuelEst(b) || 0)) + '</div></div></div>' +
      '<section class="card">' + (rows.length ? rows.map(bookingRow).join('') : '<p class="sub">No bookings match those filters.</p>') + '</section>';
  }

  function autoPrice(van) {
    const h = num(setting('hector_price', 0)), g = num(setting('helga_price', 0)), disc = num(setting('pair_discount', 0));
    return van === 'Both' ? Math.max(h + g - disc, 0) : van === 'Hector' ? h : van === 'Helga' ? g : '';
  }
  const DRAFT_KEY = 'hh_draft_quote';
  function getDraft() { try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); return d && typeof d === 'object' ? d : null; } catch (e) { return null; } }
  function setDraft(o) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(o)); } catch (e) { /* storage unavailable */ } }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ } }
  function draftHasContent(d) { return !!(d && (d.client || d.email || d.phone || d.hire_date || d.address || d.journey || d.note)); }
  function bookingForm(b, draft) {
    b = b || Object.assign({ van: 'Both', status: 'quote', cost: autoPrice('Both'), paid: 0 }, draft || {});
    const f = (n, label, type, val, extra) => '<div class="fld ' + ((extra && extra.wide) ? 'wide' : '') + '"><label for="f_' + n + '">' + label + '</label><input id="f_' + n + '" name="' + n + '" type="' + type + '" value="' + esc(val == null ? '' : val) + '" ' + ((extra && extra.attrs) || '') + '></div>';
    const sel = (n, label, opts, val) => '<div class="fld"><label for="f_' + n + '">' + label + '</label><select id="f_' + n + '" name="' + n + '">' + opts.map((o) => '<option value="' + o[0] + '"' + (String(val || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div>';
    return '<form class="card stack" data-form="booking" data-id="' + (b.id || '') + '"><div class="form">' +
      f('client', 'Client name', 'text', b.client, { attrs: 'required' }) + f('email', 'Email', 'email', b.email) + f('phone', 'Phone', 'tel', b.phone) + f('hire_date', 'Date of hire', 'date', b.hire_date) +
      f('address', 'Address', 'text', b.address, { wide: true }) +
      sel('van', 'Van', [['Both', 'Both vans'], ['Hector', 'Hector'], ['Helga', 'Helga'], ['', 'Not set']], b.van) +
      f('cost', 'Hire price (£)', 'number', b.cost, { attrs: 'min="0" step="1" data-auto="' + autoPrice(b.van) + '"' }) + f('paid', 'Paid so far (£)', 'number', b.paid, { attrs: 'min="0" step="1"' }) +
      sel('status', 'Status', [['quote', 'Quote'], ['booked', 'Booked'], ['complete', 'Complete'], ['refund', 'Refunded']], b.status) +
      '<div class="fld wide"><label for="f_journey">Journeys</label><textarea id="f_journey" name="journey">' + esc(b.journey) + '</textarea></div>' +
      f('miles_per_van', 'Miles per van (road, from base and back)', 'number', b.miles_per_van, { attrs: 'min="0" step="0.1"' }) +
      '<div class="fld wide"><label for="f_note">Note</label><input id="f_note" name="note" type="text" value="' + esc(b.note) + '"></div></div>' +
      '<div class="row"><button class="btn" type="submit">Save booking</button><button class="btn2" type="button" data-act="suggest">Suggest price from Settings</button>' +
      (b.id ? '<button class="btn2 danger" type="button" data-act="delbooking" data-id="' + b.id + '">Delete</button>' : '') + '</div></form>';
  }

  function clientUrl(b) { return location.origin + location.pathname.replace(/[^/]*$/, '') + 'client.html?t=' + b.quote_token; }
  function stamp(iso) { return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  function workflowCard(b) {
    const cs = b.contract_status || (b.status === 'booked' ? 'review' : null);
    let h = '<section class="card stack"><h2>Client link and agreement</h2>';
    if (b.status === 'quote' && !b.accepted_at) {
      h += '<div class="sub">The client opens a private page, reads the quote and presses Accept. You will see it here and on the home page.</div><div class="row"><button class="btn" data-act="sendlink" data-kind="quote" data-id="' + b.id + '">Send quote with Accept button</button><button class="btn2" data-act="copylink" data-id="' + b.id + '">Copy link</button></div>';
    } else if (cs === 'review') {
      h += '<div class="notice ok">' + (b.accepted_at ? 'Accepted by the client on ' + esc(stamp(b.accepted_at)) + '.' : 'Booked.') + ' Review the agreement, then approve it to send the signing link.</div>' +
        '<div class="row"><button class="btn2" data-act="preview" data-id="' + b.id + '">Review agreement</button><button class="btn" data-act="approve" data-id="' + b.id + '">Approve and send signing link</button></div>';
    } else if (cs === 'approved') {
      h += '<div class="sub">Approved' + (b.approved_at ? ' on ' + esc(stamp(b.approved_at)) : '') + '. Waiting for the client to sign.</div><div class="row"><button class="btn2" data-act="sendlink" data-kind="contract" data-id="' + b.id + '">Send the link again</button><button class="btn2" data-act="copylink" data-id="' + b.id + '">Copy link</button></div>';
    } else if (cs === 'signed') {
      h += '<div class="notice ok">Signed by ' + esc(b.signed_name) + ' on ' + esc(stamp(b.signed_at)) + '.</div>' + (b.contract_file ? '<div class="row"><button class="btn2" data-act="openfile" data-path="' + esc(b.contract_file) + '">Open signed copy</button></div>' : '<div class="sub">The signed copy will be filed in Contracts automatically.</div>');
    } else { h += '<div class="sub">Nothing waiting for this booking.</div>'; }
    return h + '</section>';
  }
  async function shareLink(b, text, title) {
    const url = clientUrl(b), body = 'Hello ' + b.client.split(' ')[0] + ',\n\n' + text + '\n' + url + '\n\n' + (S.settings.owner || '') + '\n' + (S.settings.business_name || 'HireHector');
    if (navigator.share) { try { await navigator.share({ title, text: body }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    if (b.email) { location.href = 'mailto:' + encodeURIComponent(b.email) + '?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(body); return; }
    try { await navigator.clipboard.writeText(url); toast('Link copied. Paste it into a message.'); } catch (e) { prompt('Copy this link', url); }
  }
  function draftCard() {
    const d = getDraft(); if (!draftHasContent(d)) return '';
    return '<section class="card stack" style="border-color:#E8CF98;background:#FFF8E6"><h2>Draft quote</h2><div class="sub">' + esc(d.client || 'No name yet') + (d.hire_date ? ' · ' + esc(longDate(d.hire_date)) : '') + '</div><div class="row"><a class="btn" href="#/new">Carry on with this quote</a><button class="btn2" type="button" data-act="discarddraft">Discard</button></div></section>';
  }
  function notices() {
    const ev = [];
    S.bookings.forEach((b) => {
      const t = b.signed_at || b.accepted_at; if (!t) return;
      if (b.acknowledged_at && new Date(b.acknowledged_at) >= new Date(t)) return;
      ev.push({ b, t, text: b.signed_at ? b.client + ' has signed their agreement' : b.client + ' has accepted their quote' });
    });
    if (!ev.length) return '';
    return '<section class="card stack" style="border-color:#B5D8BC;background:#F3FAF4"><h2>New</h2>' + ev.sort((x, y) => (x.t < y.t ? 1 : -1)).map((e) => '<div class="row sp"><a class="grow" href="#/booking/' + e.b.id + '"><b>' + esc(e.text) + '</b><div class="sub">' + esc(stamp(e.t)) + (e.b.signed_at ? '' : ' · review the agreement') + '</div></a><button class="btn2" data-act="ack" data-id="' + e.b.id + '">Done</button></div>').join('') + '</section>';
  }
  async function fileSigned() {
    S.filing = S.filing || {};
    for (const b of S.bookings) {
      if (b.contract_status !== 'signed' || !b.signature || !b.hire_date || S.filing[b.id] || (b.contract_file || '').indexOf('_signed') > -1) continue;
      S.filing[b.id] = 1;
      try {
        const doc = window.HHPDF.contract(b, getSettings(), calc(b)), name = slug(b.client) + '_' + compact(b.hire_date) + '_signed.pdf', path = 'contracts/' + b.hire_date.slice(0, 4) + '/' + name;
        await upload(path, new File([doc.output('blob')], name, { type: 'application/pdf' }));
        const { error } = await sb.from('bookings').update({ contract_file: path }).eq('id', b.id); if (error) throw error;
        b.contract_file = path; toast('Signed agreement from ' + b.client + ' filed in Contracts'); render.keep = true; render();
      } catch (e) { console.error(e); }
    }
  }

  function viewBooking(id) {
    const b = S.bookings.find((x) => x.id === id);
    if (!b) return '<p>Booking not found. <a href="#/bookings">Back to bookings</a></p>';
    const c = calc(b);
    const fuel = fuelEst(b);
    return '<header><a class="link" href="#/bookings">&lsaquo; Bookings</a><h1>' + esc(b.client) + '</h1><div class="row">' + chip(b.status) + '<span class="sub">' + esc(longDate(b.hire_date)) + ' · ' + esc(vanLabel(b)) + '</span></div></header>' +
      '<section class="card stack"><h2>Money</h2><div><div class="kv"><span>Hire price</span><b>' + money(c.cost) + '</b></div><div class="kv"><span>Booking fee (' + Math.round(feeShare() * 1000) / 10 + '%)</span><b>' + money(c.fee) + '</b></div><div class="kv"><span>Paid so far</span><b>' + money(c.paid) + '</b></div><div class="kv tot"><span>Still to pay</span><b>' + money(Math.max(c.cost - c.paid, 0)) + '</b></div></div>' +
      '<div class="sub">' + esc(milesLine(b)) + (fuel != null ? ' (estimate)' : '') + '</div></section>' +
      workflowCard(b) +
      '<section class="card stack"><h2>Documents</h2><div class="row"><button class="btn" data-act="doc" data-kind="quote" data-id="' + b.id + '">Quote PDF</button><button class="btn" data-act="doc" data-kind="contract" data-id="' + b.id + '">Contract PDF</button><button class="btn" data-act="doc" data-kind="invoice" data-id="' + b.id + '">Invoice PDF</button></div>' +
      '<div class="sub">On a phone the share sheet opens with the PDF attached, so you can choose Mail or Gmail and press send.' + (b.email ? ' Client email: ' + esc(b.email) : ' Add the client email below first.') + '</div>' +
      (b.contract_file ? '<div class="row"><span>Contract on file: ' + esc(b.contract_file.split('/').pop()) + '</span><button class="btn2" data-act="openfile" data-path="' + esc(b.contract_file) + '">Open</button></div>' : '<div class="sub">No contract filed yet. Making the contract PDF files it in Contracts / ' + esc((b.hire_date || '').slice(0, 4)) + '.</div>') + '</section>' +
      '<section class="card stack"><h2>Next steps</h2><div class="row">' +
      (b.status === 'quote' ? '<button class="btn2" data-act="setstatus" data-s="booked" data-id="' + b.id + '">Client accepted: mark as booked</button>' : '') +
      (b.status === 'booked' ? '<button class="btn2" data-act="setstatus" data-s="complete" data-id="' + b.id + '">Mark as complete</button>' : '') +
      (b.hire_date ? '<a class="btn2" target="_blank" rel="noopener" href="' + gcalLink(b) + '">Add to Google Calendar</a><button class="btn2" data-act="ics" data-id="' + b.id + '">Download .ics</button>' : '') + '</div></section>' +
      '<h2>Edit booking</h2>' + bookingForm(b);
  }

  function gcalLink(b) {
    const d = pd(b.hire_date), n = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    const f = (x) => x.getFullYear() + pad(x.getMonth() + 1) + pad(x.getDate());
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent('HireHector: ' + b.client + ' (' + vanLabel(b) + ')') + '&dates=' + f(d) + '/' + f(n) + '&details=' + encodeURIComponent((b.journey || '') + (b.phone ? '\n' + b.phone : ''));
  }

  function viewNew() { const d = getDraft(); return '<header><a class="link" href="#/bookings">&lsaquo; Bookings</a><h1>New quote</h1><div class="sub">' + (draftHasContent(d) ? 'Your draft has been restored. ' : '') + 'The price fills in from Settings when you choose the van. Save, then make the quote PDF from the booking.</div></header>' + bookingForm(null, d) + (draftHasContent(d) ? '<div><button class="btn2 danger" type="button" data-act="discarddraft">Discard this draft</button></div>' : ''); }

  function viewCalendar() {
    if (!S.cal) { const t = new Date(); S.cal = { y: t.getFullYear(), m: t.getMonth() }; }
    const { y, m } = S.cal;
    const lead = (new Date(y, m, 1).getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate(), total = Math.ceil((lead + days) / 7) * 7;
    let cells = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((h) => '<div class="h">' + h + '</div>').join('');
    for (let i = 0; i < total; i++) {
      const dn = i - lead + 1, inM = dn >= 1 && dn <= days, iso = inM ? y + '-' + pad(m + 1) + '-' + pad(dn) : '';
      const evs = inM ? S.bookings.filter((b) => b.hire_date === iso).map((b) => '<a class="ev" href="#/booking/' + b.id + '" style="background:' + (b.status === 'quote' ? '#FFF0D2' : b.status === 'booked' ? '#E4F0F3' : '#E3F3EA') + '">' + esc(b.client) + '</a>').join('') : '';
      cells += '<div class="' + (inM ? '' : 'o') + '">' + (inM ? (iso === TODAY ? '<span class="t">' + dn + '</span>' : '<b>' + dn + '</b>') : '') + evs + '</div>';
    }
    const up = S.bookings.filter((b) => b.hire_date >= TODAY && b.status === 'booked');
    return '<header class="row sp"><div><div class="sub">Every booking, month by month</div><h1>Calendar</h1></div></header>' +
      '<section class="card stack"><div class="row sp"><h2>' + MONTHS[m] + ' ' + y + '</h2><div class="row"><button class="btn2" data-act="calprev" aria-label="Previous month">&lt;</button><button class="btn2" data-act="caltoday">Today</button><button class="btn2" data-act="calnext" aria-label="Next month">&gt;</button></div></div><div class="scroll"><div class="cal">' + cells + '</div></div></section>' +
      '<section class="card"><h2>Coming up</h2>' + (up.length ? up.map((b) => '<a class="item" href="#/booking/' + b.id + '"><div class="grow"><b>' + esc(b.client) + '</b><div class="sub">' + esc(longDate(b.hire_date)) + ' · ' + esc(vanLabel(b)) + '</div></div><button class="btn2" data-act="caljump" data-d="' + b.hire_date + '">Show</button></a>').join('') : '<p class="sub">Nothing booked.</p>') + '</section>';
  }

  function viewContracts() {
    const years = Array.from(new Set(S.bookings.map((b) => (b.hire_date || '').slice(0, 4)).filter(Boolean))).sort();
    if (!S.contractYear || years.indexOf(S.contractYear) < 0) S.contractYear = years.indexOf(String(new Date().getFullYear() + 1)) >= 0 ? String(new Date().getFullYear() + 1) : years[years.length - 1];
    const rows = S.bookings.filter((b) => (b.hire_date || '').slice(0, 4) === S.contractYear);
    return '<header><div class="sub">Filed by the year of the hire</div><h1>Contracts</h1></header>' +
      '<div class="grid">' + years.map((y) => { const n = S.bookings.filter((b) => (b.hire_date || '').slice(0, 4) === y); const f = n.filter((b) => b.contract_file).length; return '<button class="card" data-act="cyear" data-v="' + y + '" style="text-align:left;cursor:pointer;' + (y === S.contractYear ? 'border:2px solid #362F2D;background:#F4ECE0' : '') + '"><div style="font-size:22px;font-weight:700">' + y + '</div><div class="sub">' + n.length + ' bookings · ' + f + ' on file</div></button>'; }).join('') + '</div>' +
      '<section class="card"><h2>' + S.contractYear + ' folder</h2><div class="sub">Files are named Name_Surname_DDMMYYYY.pdf</div>' + rows.map((b) => '<div class="item"><div class="grow"><b>' + esc(b.client) + '</b><div class="sub">' + shortDate(b.hire_date) + ' · ' + esc(vanLabel(b)) + '</div></div>' + chip(b.status) +
        (b.contract_file ? '<span style="overflow-wrap:anywhere">' + esc(b.contract_file.split('/').pop()) + '</span><button class="btn2" data-act="openfile" data-path="' + esc(b.contract_file) + '">Open</button>' : '<span class="sub">' + (b.status === 'quote' ? 'Quote only' : 'No contract on file') + '</span><a class="btn2" href="#/booking/' + b.id + '">Make contract</a><label class="btn2" style="cursor:pointer">Upload PDF<input type="file" accept="application/pdf" data-upload="contract" data-id="' + b.id + '" style="position:absolute;width:1px;height:1px;opacity:0"></label>') + '</div>').join('') + '</section>';
  }

  function viewServicing() {
    const sum = ['Hector', 'Helga'].map((v) => {
      const l = S.servicing.filter((s) => s.van === v).sort((a, b) => (a.service_date < b.service_date ? 1 : -1));
      const nx = l.map((s) => s.next_due).filter(Boolean).sort();
      return '<div class="card"><div class="row"><span class="dot" style="background:' + VANS[v].colour + ';width:14px;height:14px"></span><b style="font-size:18px">' + v + '</b><span class="sub">' + VANS[v].plate + '</span></div><div class="sub">Last service: <b style="color:#362F2D">' + (l[0] ? shortDate(l[0].service_date) : 'none recorded') + '</b></div><div class="sub">Total spent: <b style="color:#362F2D">' + money(l.reduce((t, s) => t + num(s.amount), 0)) + '</b></div><div class="sub">Next due: <b style="color:#362F2D">' + (nx.length ? shortDate(nx[nx.length - 1]) : 'not set') + '</b></div></div>';
    }).join('');
    const items = S.servicing.slice().sort((a, b) => (a.service_date < b.service_date ? 1 : -1));
    return '<header><div class="sub">Keep the vans wedding ready</div><h1>Servicing</h1></header><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">' + sum + '</div>' +
      '<form class="card stack" data-form="servicing"><h2>Add a service invoice</h2><div class="form">' +
      '<div class="fld"><label for="s_van">Van</label><select id="s_van" name="van"><option>Hector</option><option>Helga</option></select></div><div class="fld"><label for="s_date">Date of service</label><input id="s_date" name="service_date" type="date" required></div>' +
      '<div class="fld"><label for="s_garage">Garage or supplier</label><input id="s_garage" name="garage" type="text"></div><div class="fld"><label for="s_amt">Amount (£)</label><input id="s_amt" name="amount" type="number" min="0" step="0.01" required></div>' +
      '<div class="fld wide"><label for="s_work">Work carried out</label><input id="s_work" name="work" type="text" required></div><div class="fld"><label for="s_next">Next service due (optional)</label><input id="s_next" name="next_due" type="date"></div>' +
      '<div class="fld"><label for="s_file">Invoice (photo or PDF)</label><input id="s_file" name="file" type="file" accept="image/*,application/pdf"></div></div><div><button class="btn" type="submit">Add service invoice</button></div></form>' +
      '<section class="card"><h2>Service history</h2>' + (items.length ? items.map((s) => '<div class="item"><span class="dot" style="background:' + VANS[s.van].colour + '"></span><div class="grow"><b>' + esc(s.work) + '</b><div class="sub">' + esc(s.van) + ' · ' + shortDate(s.service_date) + ' · ' + esc(s.garage || '') + '</div></div><b>' + money(s.amount) + '</b>' + (s.file_path ? '<button class="btn2" data-act="openfile" data-path="' + esc(s.file_path) + '">Invoice</button>' : '') + '<button class="btn2 danger" data-act="delrow" data-t="servicing" data-id="' + s.id + '" aria-label="Remove ' + esc(s.work) + '">Remove</button></div>').join('') : '<p class="sub">No service invoices yet. Add the first one above.</p>') + '</section>';
  }

  function expenseLines(y) {
    const L = [];
    S.receipts.forEach((r) => { if (inTax(r.receipt_date, y)) L.push({ date: r.receipt_date, category: r.category, supplier: r.supplier || '', van: r.van || '', amount: num(r.amount), note: r.note || '', file: r.file_path || '', src: 'receipts', id: r.id }); });
    S.servicing.forEach((s) => { if (inTax(s.service_date, y)) L.push({ date: s.service_date, category: 'Servicing', supplier: s.garage || '', van: s.van, amount: num(s.amount), note: s.work || '', file: s.file_path || '', src: 'servicing', id: s.id }); });
    S.fillups.forEach((f) => { if (inTax(f.fill_date, y)) L.push({ date: f.fill_date, category: 'Fuel', supplier: 'Fill-up', van: f.van, amount: num(f.cost), note: f.litres + ' litres at ' + f.odometer + ' miles', file: '', src: 'fillups', id: f.id }); });
    return L.sort((a, b) => (a.date < b.date ? 1 : -1));
  }
  function incomeLines(y) { return S.bookings.filter((b) => (b.status === 'complete' || b.status === 'booked') && num(b.paid) > 0 && inTax(b.hire_date, y)); }
  function fuelStats() {
    return ['Hector', 'Helga'].map((v) => {
      const f = S.fillups.filter((x) => x.van === v).sort((a, b) => num(a.odometer) - num(b.odometer));
      if (f.length < 2) return '<div class="card"><b>' + v + '</b><div class="sub">' + f.length + ' fill-up' + (f.length === 1 ? '' : 's') + ' saved. Two or more are needed to work out the cost per mile.</div></div>';
      const miles = num(f[f.length - 1].odometer) - num(f[0].odometer), used = f.slice(1), cost = used.reduce((t, x) => t + num(x.cost), 0), litres = used.reduce((t, x) => t + num(x.litres), 0);
      if (miles <= 0 || litres <= 0) return '<div class="card"><b>' + v + '</b><div class="sub">Check the odometer readings: they need to go up.</div></div>';
      return '<div class="card"><b>' + v + '</b><div style="font-size:26px;font-weight:700">' + money(Math.round(cost / miles * 1000) / 1000) + ' a mile</div><div class="sub">' + r1(miles / (litres / 4.54609)) + ' miles per gallon · ' + money(Math.round(cost / litres * 100) / 100) + ' a litre · ' + miles + ' miles</div></div>';
    }).join('');
  }
  function viewAccounts() {
    if (S.taxYear == null) S.taxYear = taxYearOf(TODAY);
    const y = S.taxYear, inc = incomeLines(y), exp = expenseLines(y);
    const incSum = inc.reduce((t, b) => t + num(b.paid), 0), expSum = exp.reduce((t, e) => t + e.amount, 0);
    const years = []; for (let k = 2021; k <= taxYearOf(TODAY) + 1; k++) years.push(k);
    const cats = ['Fuel', 'Insurance', 'Servicing', 'Other'];
    return '<header class="row sp"><div><div class="sub">Receipts, costs and the year-end sheet</div><h1>Accounts</h1></div><div class="row"><div class="fld"><label for="ty">Tax year</label><select id="ty" data-change="taxyear">' + years.map((k) => '<option value="' + k + '"' + (k === y ? ' selected' : '') + '>' + k + '/' + String(k + 1).slice(2) + '</option>').join('') + '</select></div></div></header>' +
      '<div class="grid"><div class="card tile"><div class="eyebrow">Income</div><div class="n">' + money(incSum) + '</div></div><div class="card tile"><div class="eyebrow">Expenses</div><div class="n">' + money(expSum) + '</div></div><div class="card tile"><div class="eyebrow">Profit before tax</div><div class="n" style="color:#14633C">' + money(incSum - expSum) + '</div></div></div>' +
      '<button class="btn" data-act="csv">Create spreadsheet for the accountant</button>' +
      '<form class="card stack" data-form="receipt"><h2>Add a receipt</h2><div class="form">' +
      '<div class="fld wide"><label for="r_file">Photo of the receipt</label><input id="r_file" name="file" type="file" accept="image/*,application/pdf"></div>' +
      '<div class="fld"><label for="r_cat">Type of cost</label><select id="r_cat" name="category">' + ['Fuel', 'Insurance', 'Other'].map((c) => '<option>' + c + '</option>').join('') + '</select></div>' +
      '<div class="fld"><label for="r_date">Date on the receipt</label><input id="r_date" name="receipt_date" type="date" value="' + TODAY + '" required></div>' +
      '<div class="fld"><label for="r_sup">Supplier</label><input id="r_sup" name="supplier" type="text"></div><div class="fld"><label for="r_amt">Amount (£)</label><input id="r_amt" name="amount" type="number" min="0" step="0.01" required></div>' +
      '<div class="fld"><label for="r_van">Which van</label><select id="r_van" name="van"><option>Not van-specific</option><option>Hector</option><option>Helga</option><option>Both vans</option></select></div><div class="fld"><label for="r_note">Note (optional)</label><input id="r_note" name="note" type="text"></div></div>' +
      '<div class="sub">Servicing invoices are added on the Servicing page and fill-ups below. Both count in these totals.</div><div><button class="btn" type="submit">Save receipt</button></div></form>' +
      '<form class="card stack" data-form="fillup"><h2>Fuel and cost per mile</h2><div class="sub">Fill the tank each time and enter the odometer reading.</div><div class="form">' +
      '<div class="fld"><label for="f_van2">Van</label><select id="f_van2" name="van"><option>Hector</option><option>Helga</option></select></div><div class="fld"><label for="f_date2">Date</label><input id="f_date2" name="fill_date" type="date" value="' + TODAY + '" required></div>' +
      '<div class="fld"><label for="f_l">Litres</label><input id="f_l" name="litres" type="number" min="0" step="0.01" required></div><div class="fld"><label for="f_c">Cost (£)</label><input id="f_c" name="cost" type="number" min="0" step="0.01" required></div>' +
      '<div class="fld"><label for="f_o">Odometer (miles)</label><input id="f_o" name="odometer" type="number" min="0" step="1" required></div></div><div><button class="btn" type="submit">Save fill-up</button></div>' +
      '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">' + fuelStats() + '</div><div class="sub">Once you have a few fill-ups, copy each van\'s cost per mile into Settings so quotes and bookings use the real figure.</div></form>' +
      '<section class="card"><h2>Costs by type</h2>' + cats.map((c) => '<div class="kv"><span>' + c + '</span><b>' + money(exp.filter((e) => e.category === c).reduce((t, e) => t + e.amount, 0)) + '</b></div>').join('') + '</section>' +
      '<section class="card"><h2>Costs in ' + y + '/' + String(y + 1).slice(2) + '</h2>' + (exp.length ? exp.map((e) => '<div class="item"><div class="grow"><b>' + esc(e.supplier || e.category) + '</b><div class="sub">' + esc(e.category) + ' · ' + esc(e.van) + ' · ' + shortDate(e.date) + (e.note ? ' · ' + esc(e.note) : '') + '</div></div><b>' + money(e.amount) + '</b>' + (e.file ? '<button class="btn2" data-act="openfile" data-path="' + esc(e.file) + '">Photo</button>' : '') + '<button class="btn2 danger" data-act="delrow" data-t="' + e.src + '" data-id="' + e.id + '" aria-label="Remove cost from ' + esc(e.supplier || e.category) + '">Remove</button></div>').join('') : '<p class="sub">No costs yet for this tax year.</p>') + '</section>' +
      '<section class="card"><div class="sub">Income uses the date of each hire and the amount paid, with refunds left out. The UK tax year runs from 6 April to 5 April.</div></section>';
  }

  function viewTerms() {
    return '<header><div class="sub">Part of every hire agreement</div><h1>Terms &amp; conditions</h1></header><section class="card stack">' + window.HHPDF.TERMS.map((t, i) => '<div><h2>' + (i + 1) + '. ' + esc(t[0]) + '</h2><p style="margin:4px 0 0">' + esc(t[1]) + '</p></div>').join('') + '</section><div class="notice">Draft wording: please check it against your own terms, and have a solicitor look over it before use.</div>';
  }
  function viewMore() {
    return '<header><h1>More</h1></header><section class="card">' + NAV.filter((n) => !n[3]).map((n) => '<a class="item" href="#/' + n[0] + '">' + n[1] + '</a>').join('') + '<a class="item" href="#/password">Change password</a><button class="item btn2" style="width:100%;margin-top:8px" data-act="signout">Sign out</button></section>';
  }
  async function checkUpdate() {
    try { const r = await fetch('version.json?ts=' + Date.now(), { cache: 'no-store' }); S.latest = await r.json(); S.latestErr = null; } catch (e) { S.latestErr = 'Could not check just now. Try again in a moment.'; }
    render.keep = true; render();
  }
  function versionCard() {
    const L = S.latest, newer = L && L.version && L.version !== APP_VERSION;
    let h = '<section class="card stack"><h2>Version</h2><div class="kv"><span>You are using</span><b>' + esc(APP_VERSION) + '</b></div>';
    if (L) h += '<div class="kv"><span>Latest available</span><b>' + esc(L.version) + '</b></div>';
    if (S.latestErr) h += '<div class="notice err">' + esc(S.latestErr) + '</div>';
    if (newer) h += '<div class="notice">A new version is ready.</div><div class="row"><button class="btn" type="button" data-act="doupdate">Update now</button></div>';
    else if (L) h += '<div class="notice ok">You have the latest version.</div><div class="row"><button class="btn2" type="button" data-act="checkupdate">Check again</button></div>';
    else h += '<div class="row"><button class="btn2" type="button" data-act="checkupdate">Check for updates</button></div>';
    if (L && L.history) h += '<details><summary>What is new</summary>' + L.history.map((x) => '<div style="margin-top:10px"><b>' + esc(x.version) + '</b> <span class="sub">' + esc(x.date) + '</span><ul style="margin:4px 0 0 18px;padding:0">' + x.notes.map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul></div>').join('') + '</details>';
    return h + '</section>';
  }
  function viewSettings() {
    if (!S.latest && !S.latestErr && !S.checking) { S.checking = true; setTimeout(checkUpdate, 50); }
    const f = (k, label, type, extra) => '<div class="fld"><label for="g_' + k + '">' + label + '</label><input id="g_' + k + '" name="' + k + '" type="' + type + '" ' + (extra || '') + ' value="' + esc(k === 'booking_fee_share' ? Math.round(feeShare() * 10000) / 100 : setting(k, '')) + '"></div>';
    return '<header class="row sp"><div><div class="sub">Used on every new quote, invoice and contract</div><h1>Settings</h1></div></header><form class="stack" data-form="settings">' +
      '<section class="card stack"><h2>Van prices</h2><div class="form">' + f('hector_price', 'Hector starting price (£)', 'number', 'step="5"') + f('helga_price', 'Helga starting price (£)', 'number', 'step="5"') + f('pair_discount', 'Two-van discount (£)', 'number', 'step="5"') + '</div></section>' +
      '<section class="card stack"><h2>Booking fee</h2><div class="form">' + f('booking_fee_share', 'Booking fee (% of total)', 'number', 'step="0.01"') + '</div></section>' +
      '<section class="card stack"><h2>Fuel</h2><div class="form">' + f('hector_fuel_litre', 'Hector price per litre (£, unleaded)', 'number', 'step="0.01"') + f('hector_cost_per_mile', 'Hector cost per mile (£)', 'number', 'step="0.001"') + f('helga_fuel_litre', 'Helga price per litre (£, super unleaded)', 'number', 'step="0.01"') + f('helga_cost_per_mile', 'Helga cost per mile (£)', 'number', 'step="0.001"') + '</div></section>' +
      '<section class="card stack"><h2>Payment details</h2><div class="form">' + f('payee_name', 'Payee name', 'text') + f('sort_code', 'Sort code', 'text') + f('account_number', 'Account number', 'text') + '</div></section>' +
      '<section class="card stack"><h2>Business details</h2><div class="form">' + f('business_name', 'Business name', 'text') + f('owner', 'Owner name', 'text') + f('website', 'Website', 'text') + f('phone', 'Phone', 'tel') + f('email', 'Email', 'email') + f('address', 'Address', 'text') + '</div></section>' +
      versionCard() + '<div><button class="btn" type="submit">Save settings</button></div></form><div><button class="btn2" data-act="signout">Sign out</button></div>';
  }

  /* ---------- render and routes ---------- */
  function route() { const h = location.hash.replace(/^#\/?/, '') || 'home'; const p = h.split('/'); return { name: p[0], id: p[1] }; }
  function render() {
    const app = $('#app');
    if (!S.user) { app.innerHTML = viewLogin(render.err, render.info); return; }
    if (S.setpw) { app.innerHTML = viewPassword(true); return; }
    if (!S.ready) { app.innerHTML = '<div class="login"><div class="logo">HireHector</div><div class="sub">Loading...</div></div>'; return; }
    const r = route();
    const V = { home: viewHome, bookings: viewBookings, calendar: viewCalendar, accounts: viewAccounts, contracts: viewContracts, servicing: viewServicing, terms: viewTerms, settings: viewSettings, more: viewMore, password: () => viewPassword(false), new: viewNew };
    let inner;
    if (r.name === 'booking') inner = viewBooking(r.id); else inner = (V[r.name] || viewHome)();
    const keepY = window.scrollY;
    app.innerHTML = shell(r.name, inner);
    if (render.keep) { window.scrollTo(0, keepY); render.keep = false; }
  }
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

  /* ---------- documents ---------- */
  async function deliver(doc, filename, b, subject) {
    const blob = doc.output('blob');
    const file = new File([blob], filename, { type: 'application/pdf' });
    const body = 'Hello ' + b.client.split(' ')[0] + ',\n\nPlease find attached: ' + subject + '.\n' + (b.quote_token && /quote/.test(subject) ? '\nYou can accept your quote online here:\n' + clientUrl(b) + '\n' : '') + '\n' + (S.settings.owner || '') + '\n' + (S.settings.business_name || 'HireHector');
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: subject, text: body }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    doc.save(filename);
    if (b.email) setTimeout(() => { location.href = 'mailto:' + encodeURIComponent(b.email) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body + '\n\n(Attach the PDF that has just been saved.)'); }, 600);
  }
  async function makeDoc(kind, id) {
    const b = S.bookings.find((x) => x.id === id), c = calc(b), st = getSettings();
    if (!b.hire_date) { toast('Add the date of hire first.'); return; }
    const base = slug(b.client) + '_' + compact(b.hire_date);
    const doc = window.HHPDF[kind](b, st, c);
    if (kind === 'contract') {
      const path = 'contracts/' + b.hire_date.slice(0, 4) + '/' + base + '.pdf';
      await upload(path, new File([doc.output('blob')], base + '.pdf', { type: 'application/pdf' }));
      const { error } = await sb.from('bookings').update({ contract_file: path }).eq('id', id);
      if (error) throw error;
      b.contract_file = path; toast('Contract filed in Contracts / ' + b.hire_date.slice(0, 4)); render.keep = true; render();
      await deliver(doc, base + '.pdf', b, 'your hire agreement');
    } else if (kind === 'quote') await deliver(doc, 'Quote_' + base + '.pdf', b, 'your quote for your wedding on ' + longDate(b.hire_date));
    else await deliver(doc, 'Invoice_' + base + '.pdf', b, 'your invoice');
  }
  function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  function csv() {
    const y = S.taxYear, q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const rows = incomeLines(y).map((b) => ({ date: b.hire_date, type: 'Income', category: 'Hire', desc: b.client + ' (' + vanLabel(b) + ')', amount: num(b.paid), file: b.contract_file || '' }))
      .concat(expenseLines(y).map((e) => ({ date: e.date, type: 'Expense', category: e.category, desc: [e.supplier, e.van, e.note].filter(Boolean).join(' - '), amount: -e.amount, file: e.file }))).sort((a, b) => (a.date < b.date ? -1 : 1));
    const inc = rows.filter((r) => r.amount > 0).reduce((t, r) => t + r.amount, 0), exp = -rows.filter((r) => r.amount < 0).reduce((t, r) => t + r.amount, 0);
    const lines = [['Date', 'Type', 'Category', 'Description', 'Amount (GBP)', 'File'].map(q).join(',')];
    rows.forEach((r) => lines.push([r.date, r.type, r.category, r.desc, r.amount.toFixed(2), r.file].map(q).join(',')));
    lines.push(['', '', '', 'Total income', inc.toFixed(2), ''].map(q).join(',')); lines.push(['', '', '', 'Total expenses', (-exp).toFixed(2), ''].map(q).join(',')); lines.push(['', '', '', 'Profit before tax', (inc - exp).toFixed(2), ''].map(q).join(','));
    download('HireHector_accounts_' + y + '-' + String(y + 1).slice(2) + '.csv', '﻿' + lines.join('\r\n'), 'text/csv');
    toast('Spreadsheet downloaded. It opens in Excel, Numbers or Google Sheets.');
  }
  function ics(b) {
    const d = pd(b.hire_date), n = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1), f = (x) => x.getFullYear() + pad(x.getMonth() + 1) + pad(x.getDate());
    download(slug(b.client) + '_' + compact(b.hire_date) + '.ics', ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HireHector//EN', 'BEGIN:VEVENT', 'UID:' + b.id + '@hirehector', 'DTSTAMP:' + f(new Date()) + 'T000000Z', 'DTSTART;VALUE=DATE:' + f(d), 'DTEND;VALUE=DATE:' + f(n), 'SUMMARY:HireHector: ' + b.client + ' (' + vanLabel(b) + ')', 'DESCRIPTION:' + (b.journey || '').replace(/\n/g, ' '), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'), 'text/calendar');
  }

  /* ---------- events ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const a = el.dataset.act, id = el.dataset.id;
    run(async () => {
      if (a === 'fyear') { S.filters.year = el.dataset.v; render.keep = true; render(); }
      else if (a === 'fstatus') { S.filters.status = el.dataset.v; render.keep = true; render(); }
      else if (a === 'cyear') { S.contractYear = el.dataset.v; render.keep = true; render(); }
      else if (a === 'calprev' || a === 'calnext') { const d = new Date(S.cal.y, S.cal.m + (a === 'calnext' ? 1 : -1), 1); S.cal = { y: d.getFullYear(), m: d.getMonth() }; render.keep = true; render(); }
      else if (a === 'caltoday') { S.cal = null; render.keep = true; render(); }
      else if (a === 'caljump') { const d = pd(el.dataset.d); S.cal = { y: d.getFullYear(), m: d.getMonth() }; render(); window.scrollTo(0, 0); }
      else if (a === 'signout') { await sb.auth.signOut(); }
      else if (a === 'forgot') {
        const em = ($('#em') || {}).value; if (!em) { render.err = 'Type your email above first, then press the link button.'; render(); return; }
        const { error } = await sb.auth.resetPasswordForEmail(em.trim(), { redirectTo: location.origin + location.pathname });
        if (error) { render.err = error.message; } else { render.err = null; render.info = 'If that email has an account, a link to set a new password is on its way.'; }
        render();
      }
      else if (a === 'openfile') await openFile(el.dataset.path);
      else if (a === 'doc') await makeDoc(el.dataset.kind, id);
      else if (a === 'ics') ics(S.bookings.find((x) => x.id === id));
      else if (a === 'csv') csv();
      else if (a === 'discarddraft') { clearDraft(); toast('Draft discarded'); if (route().name === 'new') location.hash = '#/home'; render(); }
      else if (a === 'suggest') {
        const f = el.closest('form'), van = f.van.value, h = num(setting('hector_price', 300)), g = num(setting('helga_price', 300)), disc = num(setting('pair_discount', 0));
        f.cost.value = van === 'Both' ? Math.max(h + g - disc, 0) : van === 'Hector' ? h : van === 'Helga' ? g : ''; f.cost.dataset.auto = f.cost.value; f.cost.dispatchEvent(new Event('input', { bubbles: true }));
        toast('Price suggested from Settings. Change it if you have agreed a different one.');
      }
      else if (a === 'setstatus') {
        const { error } = await sb.from('bookings').update({ status: el.dataset.s }).eq('id', id); if (error) throw error;
        S.bookings.find((x) => x.id === id).status = el.dataset.s; toast('Marked as ' + TONES[el.dataset.s][2].toLowerCase()); render.keep = true; render();
      }
      else if (a === 'sendlink') {
        const b = S.bookings.find((x) => x.id === id);
        if (el.dataset.kind === 'quote') await shareLink(b, 'Here is your quote for your wedding on ' + longDate(b.hire_date) + '. You can read it and press Accept here:', 'Quote for your wedding on ' + longDate(b.hire_date));
        else await shareLink(b, 'Your hire agreement is ready to read and sign here:', 'Your HireHector hire agreement');
      }
      else if (a === 'copylink') { const b = S.bookings.find((x) => x.id === id); try { await navigator.clipboard.writeText(clientUrl(b)); toast('Link copied'); } catch (e) { prompt('Copy this link', clientUrl(b)); } }
      else if (a === 'preview') {
        const b = S.bookings.find((x) => x.id === id); if (!b.hire_date) { toast('Add the date of hire first.'); return; }
        window.open(window.HHPDF.contract(b, getSettings(), calc(b)).output('bloburl'), '_blank');
      }
      else if (a === 'approve') {
        const b = S.bookings.find((x) => x.id === id); if (!b.hire_date) { toast('Add the date of hire first.'); return; }
        const now = new Date().toISOString(), { error } = await sb.from('bookings').update({ contract_status: 'approved', approved_at: now }).eq('id', id); if (error) throw error;
        b.contract_status = 'approved'; b.approved_at = now; render.keep = true; render();
        await shareLink(b, 'Your hire agreement is ready to read and sign here:', 'Your HireHector hire agreement');
      }
      else if (a === 'ack') { const now = new Date().toISOString(), { error } = await sb.from('bookings').update({ acknowledged_at: now }).eq('id', id); if (error) throw error; S.bookings.find((x) => x.id === id).acknowledged_at = now; render.keep = true; render(); }
      else if (a === 'checkupdate') { await checkUpdate(); }
      else if (a === 'doupdate') { location.href = location.pathname + '?u=' + Date.now() + location.hash; }
      else if (a === 'delbooking') {
        if (!confirm('Delete this booking? This cannot be undone.')) return;
        const { error } = await sb.from('bookings').delete().eq('id', id); if (error) throw error;
        S.bookings = S.bookings.filter((x) => x.id !== id); location.hash = '#/bookings'; toast('Booking deleted');
      }
      else if (a === 'delrow') {
        if (!confirm('Remove this entry?')) return;
        const t = el.dataset.t, { error } = await sb.from(t).delete().eq('id', id); if (error) throw error;
        S[t] = S[t].filter((x) => x.id !== id); render.keep = true; render(); toast('Removed');
      }
    });
  });
  document.addEventListener('input', (e) => {
    const f = e.target.closest && e.target.closest('form[data-form="booking"]');
    if (!f || f.dataset.id) return;
    const o = {}; new FormData(f).forEach((v, k) => { if (typeof v === 'string') o[k] = v; }); setDraft(o);
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'van' && t.form && t.form.dataset.form === 'booking' && t.form.cost) {
      const c = t.form.cost, auto = c.dataset.auto == null ? '' : c.dataset.auto, next = autoPrice(t.value);
      if (c.value === '' || String(c.value) === String(auto)) { c.value = next; c.dataset.auto = String(next); toast(next === '' ? 'Price cleared' : 'Price set from Settings: ' + money(next)); }
      c.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (t.dataset.change === 'taxyear') { S.taxYear = parseInt(t.value, 10); render.keep = true; render(); }
    if (t.dataset.upload === 'contract' && t.files[0]) run(async () => {
      const b = S.bookings.find((x) => x.id === t.dataset.id), name = slug(b.client) + '_' + compact(b.hire_date) + '.pdf', path = 'contracts/' + b.hire_date.slice(0, 4) + '/' + name;
      await upload(path, t.files[0]); const { error } = await sb.from('bookings').update({ contract_file: path }).eq('id', b.id); if (error) throw error;
      b.contract_file = path; toast('Filed in Contracts / ' + b.hire_date.slice(0, 4)); render.keep = true; render();
    });
  });
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-form]'); if (!form) return;
    e.preventDefault();
    const kind = form.dataset.form, fd = new FormData(form), v = {}; fd.forEach((val, k) => { if (!(val instanceof File)) v[k] = typeof val === 'string' ? val.trim() : val; });
    run(async () => {
      if (kind === 'setpw') {
        if (v.password !== v.password2) { toast('The two passwords do not match'); return; }
        const { error } = await sb.auth.updateUser({ password: fd.get('password') }); if (error) throw error;
        S.setpw = false; toast('Password saved'); location.hash = '#/home'; render();
      } else if (kind === 'login') {
        const { error } = await sb.auth.signInWithPassword({ email: v.email, password: fd.get('password') });
        if (error) { render.err = 'Sign in failed: ' + error.message; render(); }
      } else if (kind === 'booking') {
        const row = { client: v.client, email: v.email || null, phone: v.phone || null, address: v.address || null, hire_date: v.hire_date || null, van: v.van || null, cost: num(v.cost), paid: num(v.paid), journey: v.journey || null, miles_per_van: v.miles_per_van === '' ? null : num(v.miles_per_van), status: v.status, note: v.note || null };
        const id = form.dataset.id;
        const res = id ? await sb.from('bookings').update(row).eq('id', id).select().single() : await sb.from('bookings').insert(row).select().single();
        if (res.error) throw res.error;
        if (id) S.bookings = S.bookings.map((x) => (x.id === id ? res.data : x)); else S.bookings.push(res.data);
        S.bookings.sort((a, b) => ((a.hire_date || '') < (b.hire_date || '') ? -1 : 1));
        if (!id) clearDraft();
        toast('Saved'); location.hash = '#/booking/' + res.data.id; render();
      } else if (kind === 'servicing') {
        const file = fd.get('file'); let path = null;
        if (file && file.size) path = await upload('servicing/' + v.service_date.slice(0, 4) + '/' + v.service_date + '_' + v.van + '_' + safeName(file.name), file);
        const { data, error } = await sb.from('servicing').insert({ service_date: v.service_date, van: v.van, garage: v.garage || null, work: v.work, amount: num(v.amount), next_due: v.next_due || null, file_path: path }).select().single();
        if (error) throw error; S.servicing.push(data); toast('Service invoice added'); render.keep = true; render();
      } else if (kind === 'receipt') {
        const file = fd.get('file'); let path = null;
        if (file && file.size) path = await upload('receipts/' + taxYearOf(v.receipt_date) + '-' + String(taxYearOf(v.receipt_date) + 1).slice(2) + '/' + v.category + '/' + v.receipt_date + '_' + safeName(file.name), file);
        const { data, error } = await sb.from('receipts').insert({ receipt_date: v.receipt_date, category: v.category, supplier: v.supplier || null, van: v.van, amount: num(v.amount), note: v.note || null, file_path: path }).select().single();
        if (error) throw error; S.receipts.push(data); toast('Receipt saved'); render.keep = true; render();
      } else if (kind === 'fillup') {
        const { data, error } = await sb.from('fillups').insert({ fill_date: v.fill_date, van: v.van, litres: num(v.litres), cost: num(v.cost), odometer: num(v.odometer) }).select().single();
        if (error) throw error; S.fillups.push(data); toast('Fill-up saved'); render.keep = true; render();
      } else if (kind === 'settings') {
        const rows = Object.keys(v).map((k) => ({ key: k, value: k === 'booking_fee_share' ? String(Math.round(num(v[k]) * 100) / 10000) : v[k] }));
        const { error } = await sb.from('settings').upsert(rows); if (error) throw error;
        rows.forEach((r) => { S.settings[r.key] = r.value; }); toast('Settings saved'); render.keep = true; render();
      }
    });
  });

  /* ---------- start ---------- */
  async function onSession(session) {
    S.user = session ? session.user : null; S.ready = false; render();
    if (S.user) { try { await load(); } catch (e) { console.error(e); render.err = null; toast('Could not load: ' + e.message); } render(); fileSigned(); }
  }
  sb.auth.getSession().then((r) => onSession(r.data.session));
  if (FORCE_PW) S.setpw = true;
  sb.auth.onAuthStateChange((ev, s) => { if (ev === 'PASSWORD_RECOVERY') S.setpw = true; if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT' || ev === 'PASSWORD_RECOVERY') onSession(s); });
})();
