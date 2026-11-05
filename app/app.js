
const businessFields = [
  ['name', 'Business name'], ['tagline', 'Tagline'], ['address', 'Business address'],
  ['phone', 'Phone'], ['email', 'Business email', 'email'], ['bankName', 'Bank name'],
  ['accountName', 'Account holder'], ['accountNumber', 'Account number'], ['swift', 'SWIFT / BIC']
];
const emptyBusiness = () => Object.fromEntries([...businessFields.map(([key]) => [key, '']), ['logo', '']]);

function normalizeBusiness(value) {
  const business = emptyBusiness();
  for (const [key] of businessFields) {
    if (typeof value?.[key] === 'string') business[key] = value[key].trim();
  }
  if (typeof value?.logo === 'string' && value.logo.length <= 1_400_000 &&
      /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value.logo)) business.logo = value.logo;
  return business;
}

function businessLogo() {
  const { logo } = state.business;
  return logo ? `<img src="${esc(logo)}" alt="Business logo">` : '';
}

let shortcutLogoSent;

async function syncShortcutLogo() {
  const host = window.chrome?.webview;
  const logo = state.business.logo;
  if (!host || shortcutLogoSent === logo) return;
  shortcutLogoSent = logo;
  try {
    let png = '';
    if (logo) {
      const image = new Image();
      image.src = logo;
      await image.decode();
      if (state.business.logo !== logo || shortcutLogoSent !== logo) return;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 128;
      const scale = 128 / Math.max(image.naturalWidth, image.naturalHeight);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      canvas.getContext('2d').drawImage(image, (128 - width) / 2, (128 - height) / 2, width, height);
      png = canvas.toDataURL('image/png').split(',')[1];
    }
    host.postMessage('shortcut-logo:' + png);
  } catch {
    if (shortcutLogoSent === logo) shortcutLogoSent = undefined;
  }
}

function businessBankDetails() {
  return businessFields.slice(5).filter(([key]) => state.business[key]).map(([key, label]) =>
    `<p><strong>${label}:</strong> ${esc(state.business[key])}</p>`).join('');
}

function businessForm(firstRun) {
  const fields = businessFields.map(([key, label, type = 'text']) =>
    `<label class="field">${label}${key === 'name' ? '' : ' (optional)'}<input name="${key}" type="${type}"
      maxlength="250" value="${esc(state.business[key])}" ${key === 'name' ? 'required' : ''}></label>`).join('');
  const form = `<form id="business-form" class="card stack">
    <h1>${firstRun ? 'Set up your business' : 'Business details'}</h1>
    <p>These details appear on quotations and invoices. Only the business name is required.</p>
    <div class="grid two">${fields}</div>
    <label class="field">Business logo (optional)
      <input name="logo" type="file" accept="image/png,image/jpeg,image/webp">
    </label>
    <small>PNG, JPEG or WebP, up to 1 MB.</small>
    ${state.business.logo ? '<label><input name="removeLogo" type="checkbox"> Remove saved logo</label>' : ''}
    <p id="business-error" role="alert" hidden></p>
    <div><button type="submit" class="btn primary">${firstRun ? 'Open workspace' : 'Save business details'}</button></div>
  </form>`;
  return firstRun ? `<main class="content" style="max-width:900px;margin:auto">${form}</main>` : form;
}

function bindBusinessForm(firstRun) {
  const form = document.getElementById('business-form');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button');
    const error = document.getElementById('business-error');
    const values = new FormData(form);
    const next = normalizeBusiness(Object.fromEntries(values));
    if (!next.name) {
      error.textContent = 'Enter a business name.';
      error.hidden = false;
      return;
    }
    next.logo = values.has('removeLogo') ? '' : state.business.logo;
    const file = form.elements.logo.files[0];
    button.disabled = true;
    error.hidden = true;
    try {
      if (file) {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1_048_576) {
          throw new Error('Choose a PNG, JPEG or WebP image up to 1 MB.');
        }
        const reader = new FileReader();
        const url = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('The logo file could not be read.'));
          reader.readAsDataURL(file);
        });
        const image = new Image();
        image.src = url;
        await image.decode().catch(() => { throw new Error('The logo could not be opened as an image.'); });
        next.logo = url;
      }
      const previous = state.business;
      state.business = next;
      try { saveState(); } catch (err) { state.business = previous; throw err; }
      if (firstRun) currentPage = 'dashboard';
      render();
      if (!firstRun) document.getElementById('business-form').insertAdjacentHTML('beforeend', '<p role="status">Business details saved.</p>');
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
      button.disabled = false;
    }
  });
}

const PRICING = [
  { label: 'Ground Camera + Operator', rate: 0, unit: 'day' },
  { label: 'Ground Camera + Operator (corporate)', rate: 0, unit: 'day' },
  { label: 'Drone + Licensed Pilot', rate: 0, unit: 'day' },
  { label: 'Optional Drone Filming', rate: 0, unit: 'day' },
  { label: 'Camera Accessories', rate: 0, unit: 'day' },
  { label: 'Camera Accessories (corporate)', rate: 0, unit: 'day' },
  { label: 'Lighting Setup', rate: 0, unit: 'day' },
  { label: 'Lighting Setup (corporate)', rate: 0, unit: 'day' },
  { label: 'Sound Equipment', rate: 0, unit: 'day' },
  { label: 'Director', rate: 0, unit: 'day' },
  { label: 'Logistics (Van + Fuel)', rate: 0, unit: 'day' },
  { label: 'Videographer', rate: 0, unit: 'day' },
  { label: 'Assistant', rate: 0, unit: 'day' },
  { label: 'Video Editing / Post-production', rate: 0, unit: 'project' },
  { label: 'Audio Mixing, Voice Artist & Mastering', rate: 0, unit: 'project' },
  { label: 'Final Output & Delivery', rate: 0, unit: 'project' },
  { label: 'Crew Accommodation', rate: 0, unit: 'day' },
  { label: 'Per Diem (Meals & Incidentals)', rate: 0, unit: 'day' },
  { label: 'Contingency', rate: 0, unit: 'project' },
  { label: '4K Camera', rate: 0, unit: 'day' },
  { label: 'Drone Camera', rate: 0, unit: 'day' },
  { label: 'Audio Equipment (Lapel and Boom Mics)', rate: 0, unit: 'day' },
  { label: 'Lighting Kit', rate: 0, unit: 'day' },
  { label: 'Accessories Kit', rate: 0, unit: 'day' },
  { label: 'Wireless Lavalier Mic', rate: 0, unit: 'day' },
  { label: 'LED Panel Light with Battery', rate: 0, unit: 'day' },
  { label: '24-70mm Lens', rate: 0, unit: 'day' },
  { label: '50mm Lens', rate: 0, unit: 'day' },
  { label: 'Blackmagic Pocket Cinema Camera 6K Pro', rate: 0, unit: 'day' },
  { label: 'Sony FX3 Cinema Camera', rate: 0, unit: 'day' },
  { label: 'RED Raven Dragon Camera', rate: 0, unit: 'day' },
  { label: 'GoPro Hero 11 Black', rate: 0, unit: 'day' },
  { label: 'DJI Air 2S Drone', rate: 0, unit: 'day' },
  { label: 'Rode NTG4 Boom Set', rate: 0, unit: 'day' },
  { label: 'Aputure C300d LED Light', rate: 0, unit: 'day' }
];

const DEFAULT_TERMS = `A 50% deposit is required to confirm and secure the production date. The balance is due upon delivery of final edited content. This quotation is valid for 30 days from the date of issue. Any scope changes on the day of the shoot may attract additional charges agreed upon in writing. Travel, accommodation, and meals for crew are billable separately. Final edited deliverables timeline shall be agreed after production.`;

const emptyState = () => ({ clients: [], jobs: [], quotations: [], invoices: [], settings: { depositRate: 50, validityDays: 30, taxRate: 0 }, business: emptyBusiness(), auth: { username: '', passwordHash: '' } });
let state = loadState();
let currentPage = 'dashboard';
let currentDocument = null;
let editingClientId = null;
let editingQuotationId = null;
let editingJobId = null;
let serverStorageReady = false;
let serverSaveQueue = Promise.resolve();

function normalizeState(value) {
  const base = emptyState();
  const incoming = value || {};
  return {
    ...base,
    ...incoming,
    clients: Array.isArray(incoming.clients) ? incoming.clients : [],
    jobs: Array.isArray(incoming.jobs) ? incoming.jobs : [],
    quotations: Array.isArray(incoming.quotations) ? incoming.quotations : [],
    invoices: Array.isArray(incoming.invoices) ? incoming.invoices : [],
    business: normalizeBusiness(incoming.business),
    settings: { ...base.settings, ...(incoming.settings || {}) }, auth: { username: incoming.auth?.username || '', passwordHash: incoming.auth?.passwordHash || '' }
  };
}
function loadState() {
  try { return normalizeState(JSON.parse(localStorage.getItem('twisted-imagez-state') || '{}')); }
  catch { return emptyState(); }
}
function hasWorkspace(data) { return Boolean(data.business?.name || data.auth?.passwordHash) || ['clients', 'jobs', 'quotations', 'invoices'].some(key => Array.isArray(data[key]) && data[key].length > 0); }
async function persistToServer() {
  const response = await fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) });
  if (!response.ok) throw new Error('Could not save project data');
}
function saveState() {
  localStorage.setItem('twisted-imagez-state', JSON.stringify(state));
  if (serverStorageReady) {
    serverSaveQueue = serverSaveQueue.then(persistToServer).catch(() => {});
  }
}
async function initializeData() {
  const local = loadState();
  try {
    const response = await fetch('/api/data', { cache: 'no-store' });
    if (!response.ok) throw new Error('Local data API unavailable');
    const remote = normalizeState(await response.json());
    state = hasWorkspace(remote) || !hasWorkspace(local) ? remote : local;
    serverStorageReady = true;
    if (!hasWorkspace(remote) && hasWorkspace(local)) await persistToServer();
    localStorage.setItem('twisted-imagez-state', JSON.stringify(state));
  } catch {
    state = local;
  }
  render();
}function today() { return new Date().toISOString().slice(0, 10); }
function addDays(date, days) { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + Number(days || 0)); return d.toISOString().slice(0, 10); }
function money(n) { return `UGX ${new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0))}`; }
function dateLabel(value) { if (!value) return '—'; return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`)); }
function esc(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;' }[c])); }
function clientName(id) { return state.clients.find(c => c.id === id)?.name || 'Unassigned client'; }
function nextNumber(prefix) { const year = new Date().getFullYear(); const source = prefix === 'Q' ? state.quotations : state.invoices; const count = source.filter(x => String(x.number || '').includes(String(year))).length + 1; return `TI-${prefix}-${year}-${String(count).padStart(3, '0')}`; }
function lineTotal(item) {
  return (Number(item.rate) || 0) * (Number(item.quantity) || 0) * (Number(item.days) || 0);
}
function totals(doc) {
  const subtotal = (doc.items || []).reduce((sum, item) => sum + lineTotal(item), 0);
  const discount = Number(doc.discount) || 0;
  const tax = Math.max(0, (subtotal - discount) * ((Number(doc.taxRate) || 0) / 100));
  const total = Math.max(0, subtotal - discount + tax);
  const deposit = total * ((Number(doc.depositRate) || 0) / 100);
  return { subtotal, discount, tax, total, deposit, balance: Math.max(0, total - deposit) };
}
function uid() { return globalThis.crypto?.randomUUID?.() || "id-" + Date.now() + "-" + Math.random().toString(16).slice(2); }
function defaultItem() { return { id: uid(), description: '', rate: 0, quantity: 1, days: 1 }; }
function defaultDraft() { return { clientId: '', jobId: '', title: '', shootType: 'Video production', location: '', shootDate: today(), days: 1, distanceKm: 0, validUntil: addDays(today(), state.settings.validityDays), depositRate: state.settings.depositRate, taxRate: state.settings.taxRate, discount: 0, items: [defaultItem()], notes: '', terms: DEFAULT_TERMS, paymentMethod: 'Mobile Money / Cash' }; }

function isAuthenticated() {
  try { return sessionStorage.getItem('twisted-imagez-authenticated') === 'true'; }
  catch { return false; }
}
async function hashPassword(password) {
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  return btoa(unescape(encodeURIComponent(password)));
}
function loginPage() {
  const setup = !state.auth?.passwordHash;
  const confirmField = setup ? '<div class="field"><label>Confirm password</label><input name="confirmPassword" type="password" minlength="6" required></div>' : '';
  return '<div class="login-page"><div class="login-card"><h1>' + (setup ? 'Create local access' : 'Welcome back') + '</h1><p class="login-copy">' + (setup ? 'Set a password to protect this local booking workspace.' : 'Sign in to continue to your booking and invoicing workspace.') + '</p><form id="login-form"><div class="field"><label>Email / username</label><input name="username" type="email" value="' + esc(state.auth?.username || '') + '" required></div><div class="field"><label>' + (setup ? 'Create password' : 'Password') + '</label><input name="password" type="password" minlength="6" required></div>' + confirmField + '<button class="btn primary login-submit">' + (setup ? 'Create access' : 'Log in') + '</button><div class="powered-by">Powered by Twist</div></form></div></div>';
}
function bindLoginEvents() {
  const form = document.getElementById('login-form');
  if (!form) return;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const values = new FormData(form);
    const username = String(values.get('username') || '').trim();
    const password = String(values.get('password') || '');
    if (password.length < 6) { alert('Use a password with at least 6 characters.'); return; }
    if (!state.auth?.passwordHash) {
      if (password !== String(values.get('confirmPassword') || '')) { alert('The passwords do not match.'); return; }
      state.auth = { username, passwordHash: await hashPassword(password) };
      saveState();
      try { sessionStorage.setItem('twisted-imagez-authenticated', 'true'); } catch {}
      render();
      return;
    }
    const valid = username.toLowerCase() === String(state.auth.username || '').toLowerCase() && await hashPassword(password) === state.auth.passwordHash;
    if (!valid) { alert('The username or password is incorrect.'); return; }
    try { sessionStorage.setItem('twisted-imagez-authenticated', 'true'); } catch {}
    render();
  });
}
function logout() {
  try { sessionStorage.removeItem('twisted-imagez-authenticated'); } catch {}
  currentDocument = null;
  currentPage = 'dashboard';
  render();
}
function syncDepositTerms(text, rate) {
  const source = String(text || DEFAULT_TERMS);
  return source.replace(/\b\d+(?:\.\d+)?%\s+deposit\b/gi, (Number(rate) || 0) + '% deposit');
}
function render() {
  const app = document.getElementById('app');
  void syncShortcutLogo();
  if (!isAuthenticated()) { app.innerHTML = loginPage(); bindLoginEvents(); return; }
  if (!state.business.name) { app.innerHTML = businessForm(true); bindBusinessForm(true); return; }
  app.innerHTML = `<div class="shell"><aside class="sidebar">${sidebar()}</aside><section class="main"><header class="topbar"><div><h2>${pageTitle()}</h2><small>Booking, quotation and invoice workspace</small></div><div class="top-actions"><button class="btn" data-logout>Logout</button><button class="btn primary" data-action="new-quote">+ New quotation</button></div></header><main class="content">${pageContent()}</main></section></div>`;
  bindEvents();
  if (currentPage === "settings") bindBusinessForm(false);
}
function sidebar() { return `<div class="brand">${businessLogo()}<div><h1>${esc(state.business.name)}</h1><p>${esc(state.business.tagline)}</p></div></div><nav class="nav">${[['dashboard','Dashboard'],['clients','Clients'],['jobs','Jobs / bookings'],['quotations','Quotations'],['invoices','Invoices'],['settings','Business settings']].map(([key,label]) => `<button class="${currentPage===key?'active':''}" data-nav="${key}">${label}</button>`).join('')}</nav><div class="side-note">UGX pricing workspace<br>Data is saved in the project folder when running locally.<br><strong>Powered by Twist</strong></div>`; }
function pageTitle() { return ({ dashboard:esc(state.business.name), settings:'Business settings', clients:'Clients', jobs:'Jobs / bookings', quotations:'Quotations', invoices:'Invoices', 'new-client':'New client', 'edit-client':'Edit client', 'new-job':'New job / booking', 'edit-job':'Edit job / booking', 'new-quote':'New quotation', 'edit-quote':'Edit quotation', document:'Document preview' })[currentPage] || 'Twisted iMAGEZ'; }
function pageContent() {
  if (currentPage === 'settings') return businessForm(false);
  if (currentPage === 'dashboard') return dashboard();
  if (currentPage === 'clients') return clientsPage();
  if (currentPage === 'jobs') return jobsPage();
  if (currentPage === 'quotations') return quotationsPage();
  if (currentPage === 'invoices') return invoicesPage();
  if (currentPage === 'new-client') return clientForm();
  if (currentPage === 'edit-client') return clientForm();
  if (currentPage === 'new-job') return jobForm();
  if (currentPage === 'edit-job') return jobForm();
  if (currentPage === 'new-quote') return quoteForm();
  if (currentPage === 'edit-quote') return quoteForm();
  if (currentPage === 'document') return documentPage();
  return dashboard();
}
function head(title, subtitle, action='') { return `<div class="page-head"><div><h3>${title}</h3><p>${subtitle}</p></div><div class="actions">${action}</div></div>`; }
function dashboard() {
  const quoted = state.quotations.reduce((sum, q) => sum + totals(q).total, 0);
  const invoiced = state.invoices.reduce((sum, q) => sum + totals(q).total, 0);
  return `${head('Good to see you.', 'Start with a client or build a quotation from individual production line items.', '<button class="btn" data-export-backup>Download backup</button><button class="btn" data-import-backup>Restore backup</button><input id="backup-file" type="file" accept="application/json" hidden><button class="btn primary" data-action="new-quote">Create quotation</button>')}<div class="grid cards"><div class="card metric"><span class="label">Clients</span><span class="value">${state.clients.length}</span><span class="hint">Saved client records</span></div><div class="card metric"><span class="label">Active jobs</span><span class="value">${state.jobs.filter(x=>x.status!=='Completed').length}</span><span class="hint">Bookings in progress</span></div><div class="card metric"><span class="label">Quoted</span><span class="value">${money(quoted)}</span><span class="hint">All quotations</span></div><div class="card metric"><span class="label">Invoiced</span><span class="value">${money(invoiced)}</span><span class="hint">All invoices</span></div></div><div class="grid two" style="margin-top:18px"><div class="card"><div class="card-head"><h4>Recent quotations</h4><button class="btn small" data-nav="quotations">View all</button></div>${quoteTable(state.quotations.slice().reverse().slice(0,5))}</div><div class="card"><div class="card-head"><h4>Quotation templates</h4><small>${PRICING.length} presets</small></div><div class="notice">Presets are blank pricing templates. Enter your own rates on each quotation.</div><div style="margin-top:16px" class="stack"><div><strong>Standard deposit</strong><br><span class="muted">50% to secure the production date</span></div><div><strong>Quotation validity</strong><br><span class="muted">30 days from issue</span></div><div><strong>Payment methods</strong><br><span class="muted">Set payment details in Business settings</span></div></div></div></div>`;
}
function quoteTable(rows) { if (!rows.length) return '<div class="empty">No quotations yet. Create your first one to begin.</div>'; return `<div class="table-wrap"><table><thead><tr><th>Reference</th><th>Client</th><th>Date</th><th>Status</th><th class="number">Total</th><th></th></tr></thead><tbody>${rows.map(q=>`<tr data-open-document="quotation" data-id="${q.id}"><td><strong>${esc(q.number)}</strong><br><span class="muted">${esc(q.title || 'Untitled job')}</span></td><td>${esc(clientName(q.clientId))}</td><td>${dateLabel(q.issueDate)}</td><td>${statusTag(q.status || 'Draft')}</td><td class="number"><strong>${money(totals(q).total)}</strong></td><td class="number"><button class="btn small" data-edit-quotation="${q.id}">Edit</button> <button class="btn small danger" data-delete-quotation="${q.id}">Delete</button></td></tr>`).join('')}</tbody></table></div>`; }
function statusTag(status) { const s = String(status); const cls = /paid|accepted|completed/i.test(s) ? 'green' : /pending|sent|issued/i.test(s) ? 'gold' : /unpaid|cancel/i.test(s) ? 'red' : ''; return `<span class="tag ${cls}">${esc(s)}</span>`; }
function clientsPage() {
  return head('Clients', 'Keep contact details ready for repeat work.', '<button class="btn primary" data-nav="new-client">+ Add client</button>') + '<div class="card">' + (state.clients.length ? '<div class="table-wrap"><table><thead><tr><th>Client</th><th>Contact</th><th>Company / organisation</th><th>Jobs</th><th></th></tr></thead><tbody>' + state.clients.map(c => '<tr><td><strong>' + esc(c.name) + '</strong></td><td>' + esc(c.phone || '—') + '<br><span class="muted">' + esc(c.email || '') + '</span></td><td>' + esc(c.organisation || '—') + '</td><td>' + state.jobs.filter(j => j.clientId === c.id).length + '</td><td class="number"><button class="btn small" data-edit-client="' + c.id + '">Edit</button> <button class="btn small danger" data-delete-client="' + c.id + '">Delete</button></td></tr>').join('') + '</tbody></table></div>' : '<div class="empty">No clients yet. Add the first client to start a quotation.</div>') + '</div>';
}
function jobsPage() { return `${head('Jobs / bookings', 'Track the shoot brief before turning it into a quotation.', '<button class="btn primary" data-nav="new-job">+ Add job</button>')}<div class="card">${state.jobs.length ? `<div class="table-wrap"><table><thead><tr><th>Job</th><th>Client</th><th>Shoot date</th><th>Days</th><th>Location</th><th>Status</th><th></th></tr></thead><tbody>${state.jobs.map(j=>`<tr><td><strong>${esc(j.title)}</strong><br><span class="muted">${esc(j.shootType)}</span></td><td>${esc(clientName(j.clientId))}</td><td>${dateLabel(j.shootDate)}</td><td>${j.days}</td><td>${esc(j.location || '—')}</td><td>${statusTag(j.status || 'Planned')}</td><td class="number"><button class="btn small" data-edit-job="${j.id}">Edit</button> <button class="btn small danger" data-delete-job="${j.id}">Delete</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No bookings yet. Add a job when a client confirms the brief.</div>'}</div>`; }
function quotationsPage() { return `${head('Quotations', 'Draft, issue, and convert approved quotations into invoices.', '<button class="btn primary" data-action="new-quote">+ New quotation</button>')}<div class="card">${quoteTable(state.quotations.slice().reverse())}</div>`; }
function invoicesPage() { return `${head('Invoices', 'Track amounts due and present a polished payment document.', '<button class="btn primary" data-action="new-quote">+ New invoice from quotation</button>')}<div class="card">${state.invoices.length ? `<div class="table-wrap"><table><thead><tr><th>Reference</th><th>Client</th><th>Issued</th><th>Status</th><th class="number">Total</th></tr></thead><tbody>${state.invoices.slice().reverse().map(i=>`<tr data-open-document="invoice" data-id="${i.id}"><td><strong>${esc(i.number)}</strong><br><span class="muted">${esc(i.title || 'Untitled job')}</span></td><td>${esc(clientName(i.clientId))}</td><td>${dateLabel(i.issueDate)}</td><td>${statusTag(i.status || 'Unpaid')}</td><td class="number"><strong>${money(totals(i).total)}</strong></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No invoices yet. Open a quotation and convert it after the client accepts.</div>'}</div>`; }

function clientForm() {
  const client = state.clients.find(c => c.id === editingClientId);
  const editing = Boolean(client);
  return head(editing ? 'Edit client' : 'Add client', editing ? 'Update the client details for future jobs and documents.' : 'Create a client record that can be reused across jobs and documents.') + '<div class="card form-card"><form id="client-form"><div class="form-grid"><div class="field"><label>Client name *</label><input name="name" value="' + esc(client?.name || '') + '" required placeholder="Full name or contact person"></div><div class="field"><label>Organisation</label><input name="organisation" value="' + esc(client?.organisation || '') + '" placeholder="Company, school, NGO, etc."></div><div class="field"><label>Phone</label><input name="phone" value="' + esc(client?.phone || '') + '" placeholder="+256 ..."></div><div class="field"><label>Email</label><input name="email" type="email" value="' + esc(client?.email || '') + '" placeholder="client@example.com"></div><div class="field full"><label>Address / notes</label><textarea name="address" placeholder="Billing address or useful contact notes">' + esc(client?.address || '') + '</textarea></div></div><div class="form-footer"><button type="button" class="btn" data-nav="clients">Cancel</button><button class="btn primary">' + (editing ? 'Update client' : 'Save client') + '</button></div></form></div>';
}
function jobForm() { const job = state.jobs.find(j => j.id === editingJobId); const editing = Boolean(job); return `${head(editing ? 'Edit job / booking' : 'New job / booking', editing ? 'Update the booking details while keeping the same job record.' : 'Capture the shoot brief before pricing it.', '<button class="btn" data-action="new-quote">Skip to quotation</button>')}<div class="card form-card"><form id="job-form"><div class="form-grid three"><div class="field"><label>Client *</label>${clientSelect('clientId', job?.clientId || '')}</div><div class="field"><label>Job title *</label><input name="title" value="${esc(job?.title || '')}" required placeholder="e.g. Corporate safety clips"></div><div class="field"><label>Shoot type</label><input name="shootType" value="${esc(job?.shootType || 'Video production')}"></div><div class="field"><label>Shoot date</label><input name="shootDate" type="date" value="${job?.shootDate || today()}"></div><div class="field"><label>Number of days</label><input name="days" type="number" min="1" value="${job?.days || 1}"></div><div class="field"><label>Travel distance (km)</label><input name="distanceKm" type="number" min="0" value="${job?.distanceKm || 0}"></div><div class="field"><label>Location</label><input name="location" value="${esc(job?.location || '')}"></div><div class="field"><label>Status</label><select name="status"><option ${job?.status==='Planned' || !job ? 'selected' : ''}>Planned</option><option ${job?.status==='Confirmed' ? 'selected' : ''}>Confirmed</option><option ${job?.status==='Completed' ? 'selected' : ''}>Completed</option><option ${job?.status==='Cancelled' ? 'selected' : ''}>Cancelled</option></select></div><div class="field full"><label>Brief / deliverables</label><textarea name="brief" placeholder="Nature of the job, intended use, deliverables, special requirements">${esc(job?.brief || '')}</textarea></div></div><div class="form-footer"><button type="button" class="btn" data-nav="jobs">Cancel</button><button class="btn primary">${editing ? 'Update booking' : 'Save booking'}</button></div></form></div>`; }
function clientSelect(name, selected) { return `<select name="${name}" required><option value="">Choose a client</option>${state.clients.map(c=>`<option value="${c.id}" ${selected===c.id?'selected':''}>${esc(c.name)}${c.organisation?` — ${esc(c.organisation)}`:''}</option>`).join('')}</select>`; }
function quoteForm() {
  if (!state.draftQuote) state.draftQuote = defaultDraft();
  const d = state.draftQuote; const t = totals(d);
  const editing = Boolean(editingQuotationId);
  return `${head(editing ? 'Edit quotation' : 'New quotation', editing ? 'Correct the quotation details before saving the updated document.' : 'Build a professional quote from individual line items.', '<button class="btn" data-nav="quotations">Cancel</button>')}<form id="quote-form" class="stack"><div class="grid two"><div class="card"><div class="form-grid three"><div class="field"><label>Client *</label>${clientSelect('clientId', d.clientId)}</div><div class="field"><label>Job title *</label><input name="title" value="${esc(d.title)}" required placeholder="e.g. One-day corporate video"></div><div class="field"><label>Shoot type</label><input name="shootType" value="${esc(d.shootType)}"></div><div class="field"><label>Shoot date</label><input name="shootDate" type="date" value="${d.shootDate}"></div><div class="field"><label>Number of days</label><input name="days" type="number" min="1" value="${d.days}"></div><div class="field"><label>Travel distance (km)</label><input name="distanceKm" type="number" min="0" value="${d.distanceKm}"></div><div class="field"><label>Location</label><input name="location" value="${esc(d.location)}"></div><div class="field"><label>Quotation valid until</label><input name="validUntil" type="date" value="${d.validUntil}"></div><div class="field"><label>Payment method</label><select name="paymentMethod"><option ${d.paymentMethod==='Mobile Money / Cash'?'selected':''}>Mobile Money / Cash</option><option ${d.paymentMethod==='Bank transfer'?'selected':''}>Bank transfer</option><option>Mobile Money / Cash / Bank transfer</option></select></div></div><h4 class="section-title">Production line items</h4><div class="line-actions"><span class="help">Enter your price in Unit price (UGX). Each line and the quotation total update as you type. For a flat fee, set quantity and days to 1.</span><button type="button" class="btn small" data-add-preset>+ Add item template</button></div><div class="table-wrap"><table><thead><tr><th style="min-width:220px">Description</th><th class="number">Unit price (UGX)</th><th class="number">Qty</th><th class="number">Days</th><th class="number">Total</th><th></th></tr></thead><tbody id="line-items">${d.items.map((item,i)=>lineItemRow(item,i)).join('')}</tbody></table></div><div class="line-actions"><button type="button" class="btn small" data-add-line>+ Add custom line item</button></div><div class="totals"><div class="total-row"><span>Subtotal</span><strong data-quote-total="subtotal">${money(t.subtotal)}</strong></div><div class="total-row"><span>Discount</span><input name="discount" type="number" min="0" value="${d.discount}" style="width:125px;text-align:right;padding:6px;border:1px solid #d6dddf;border-radius:6px"></div><div class="total-row"><span>Tax (%)</span><input name="taxRate" type="number" min="0" value="${d.taxRate}" style="width:125px;text-align:right;padding:6px;border:1px solid #d6dddf;border-radius:6px"></div><div class="total-row total"><span>Total</span><strong data-quote-total="total">${money(t.total)}</strong></div><div class="total-row deposit"><span>Deposit (<input name="depositRate" type="number" min="0" max="100" value="${d.depositRate}" style="width:45px;padding:3px;border:1px solid #e2b9be;border-radius:5px">%)</span><strong data-quote-total="deposit">${money(t.deposit)}</strong></div><div class="total-row"><span>Balance on delivery</span><strong data-quote-total="balance">${money(t.balance)}</strong></div></div></div><div class="stack"><div class="card"><div class="card-head"><h4>Travel and brief notes</h4></div><div class="notice">Add travel, accommodation and other billable costs as separate line items.</div><div class="field" style="margin-top:15px"><label>Scope / deliverables notes</label><textarea name="notes" placeholder="What is included, delivery format, number of edits, and exclusions">${esc(d.notes)}</textarea></div></div><div class="card"><div class="card-head"><h4>Terms and conditions</h4><small>Editable default</small></div><div class="field"><textarea name="terms">${esc(syncDepositTerms(d.terms, d.depositRate))}</textarea></div></div></div></div><div class="form-footer"><button type="button" class="btn" data-nav="quotations">Cancel</button><button class="btn primary">${editing ? 'Update quotation' : 'Save quotation'}</button></div></form>`;
}
function lineItemRow(item, i) { return `<tr class="line-item-row"><td><input data-item="description" data-index="${i}" value="${esc(item.description)}" placeholder="Line item description"></td><td><input data-item="rate" data-index="${i}" aria-label="Unit price in UGX for item ${i+1}" inputmode="numeric" pattern="[0-9]+|[0-9]{1,3}(,[0-9]{3})+" placeholder="Enter price" value="${esc(item.rate || '')}" style="text-align:right"></td><td><input data-item="quantity" data-index="${i}" type="number" min="0" value="${item.quantity}" style="text-align:right;width:76px"></td><td><input data-item="days" data-index="${i}" type="number" min="1" value="${item.days}" style="text-align:right;width:76px"></td><td class="number"><strong data-line-total>${money(lineTotal(item))}</strong></td><td class="number"><button type="button" class="btn small danger" data-remove-item="${i}">×</button></td></tr>`; }

function documentPage() { const { doc, type } = currentDocument || {}; if (!doc) return dashboard(); const t = totals(doc); return `${head(type === 'invoice' ? 'Invoice preview' : 'Quotation preview', `${doc.number} · ${clientName(doc.clientId)}`, '<button class="btn" data-print>Print / save PDF</button><button class="btn" data-email>Open Gmail compose</button>' + (type==='quotation' ? '<button class="btn" data-edit-current-quotation>Edit quotation</button>' : '') + (type==='quotation' && doc.status !== 'Converted' ? '<button class="btn primary" data-convert-invoice>Convert to invoice</button>' : ''))}<div class="document" id="print-document"><div class="document-top"><div class="document-brand">${businessLogo()}<div><h1>${esc(state.business.name)}</h1>${[state.business.tagline,state.business.address,[state.business.phone,state.business.email].filter(Boolean).join(" · ")].filter(Boolean).map(value => `<p>${esc(value)}</p>`).join("")}</div></div><div class="document-meta"><h2>${type === 'invoice' ? 'INVOICE' : 'QUOTATION'}</h2><p><strong>Reference:</strong> ${esc(doc.number)}</p><p><strong>Issue date:</strong> ${dateLabel(doc.issueDate)}</p><p><strong>${type === 'invoice' ? 'Due date' : 'Valid until'}:</strong> ${dateLabel(type === 'invoice' ? (doc.dueDate || doc.issueDate) : doc.validUntil)}</p></div></div><div class="document-info"><div><h5>Prepared for</h5><p><strong>${esc(clientName(doc.clientId))}</strong></p>${clientContact(doc.clientId)}</div><div><h5>Production</h5><p><strong>${esc(doc.title || 'Production services')}</strong></p><p>${esc(doc.shootType || 'Video production')} · ${esc(doc.location || '')}</p><p>${doc.days || 1} shooting day(s) · ${doc.distanceKm || 0} km</p></div></div><table><thead><tr><th>Description</th><th class="number">Rate</th><th class="number">Qty</th><th class="number">Days</th><th class="number">Amount</th></tr></thead><tbody>${(doc.items||[]).filter(x=>x.description || x.rate).map(x=>`<tr><td>${esc(x.description || 'Production item')}</td><td class="number">${money(x.rate)}</td><td class="number">${x.quantity}</td><td class="number">${x.days}</td><td class="number"><strong>${money(lineTotal(x))}</strong></td></tr>`).join('') || '<tr><td colspan="5">No line items added.</td></tr>'}</tbody></table><div class="document-bottom"><div class="document-note"><h5>${doc.notes ? 'Scope and notes' : 'Payment terms'}</h5><p>${esc(doc.notes || '')}</p><p>${esc(syncDepositTerms(doc.terms || DEFAULT_TERMS, doc.depositRate))}</p></div><div><div class="totals"><div class="total-row"><span>Subtotal</span><strong>${money(t.subtotal)}</strong></div>${t.discount?`<div class="total-row"><span>Discount</span><strong>- ${money(t.discount)}</strong></div>`:''}${t.tax?`<div class="total-row"><span>Tax</span><strong>${money(t.tax)}</strong></div>`:''}<div class="total-row total"><span>Total ${type==='invoice'?'due':''}</span><strong>${money(t.total)}</strong></div><div class="total-row deposit"><span>${type==='invoice'?'Amount paid / deposit':'Deposit required'} (${doc.depositRate}%)</span><strong>${money(t.deposit)}</strong></div><div class="total-row"><span>Balance</span><strong>${money(t.balance)}</strong></div></div><div class="payment-box"><p><strong>Payment method:</strong> ${esc(doc.paymentMethod || 'Mobile Money / Cash')}</p>${businessBankDetails()}</div></div></div></div>`; }
function clientContact(id) { const c = state.clients.find(x=>x.id===id); if (!c) return ''; return `${c.organisation?`<p>${esc(c.organisation)}</p>`:''}${c.phone?`<p>${esc(c.phone)}</p>`:''}${c.email?`<p>${esc(c.email)}</p>`:''}${c.address?`<p>${esc(c.address)}</p>`:''}`; }

function bindEvents() {
  document.querySelector('[data-logout]')?.addEventListener('click',logout); document.querySelector('[data-export-backup]')?.addEventListener('click',exportBackup); document.querySelector('[data-import-backup]')?.addEventListener('click',()=>document.getElementById('backup-file')?.click()); document.getElementById('backup-file')?.addEventListener('change',importBackup); document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>{ currentPage=b.dataset.nav; currentDocument=null; if(['clients','new-client','quotations'].includes(currentPage)) editingClientId=null; if(currentPage==='quotations') editingQuotationId=null; if(['jobs','new-job'].includes(currentPage)) editingJobId=null; if(currentPage!=='new-quote' && currentPage!=='edit-quote') state.draftQuote=null; render(); }));
  document.querySelectorAll('[data-action="new-quote"]').forEach(b=>b.addEventListener('click',()=>{ editingQuotationId=null; state.draftQuote=defaultDraft(); currentPage='new-quote'; render(); }));
  document.querySelectorAll('[data-open-document]').forEach(row=>row.addEventListener('click',()=>{ const type=row.dataset.openDocument; const collection=type==='invoice'?state.invoices:state.quotations; const doc=collection.find(x=>x.id===row.dataset.id); if(doc){ currentDocument={doc,type}; currentPage='document'; render(); }}));
  document.querySelectorAll('[data-edit-quotation]').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); const q=state.quotations.find(x=>x.id===b.dataset.editQuotation); if(!q) return; if(q.status==='Converted'){ alert('This quotation has already been converted into an invoice. Edit the invoice or create a corrected quotation instead.'); return; } editingQuotationId=q.id; state.draftQuote={...q,items:(q.items||[]).map(item=>({...item}))}; currentPage='edit-quote'; render(); }));
  document.querySelectorAll('[data-delete-quotation]').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); const q=state.quotations.find(x=>x.id===b.dataset.deleteQuotation); if(!q) return; if(state.invoices.some(invoice=>invoice.sourceQuotation===q.number)){ alert('This quotation has already been converted into an invoice and cannot be deleted.'); return; } if(confirm('Delete quotation ' + q.number + '? This cannot be undone.')) { state.quotations=state.quotations.filter(x=>x.id!==q.id); saveState(); render(); } }));
  document.querySelector('[data-edit-current-quotation]')?.addEventListener('click',()=>{ const q=currentDocument?.doc; if(!q || currentDocument.type!=='quotation') return; if(q.status==='Converted'){ alert('This quotation has already been converted into an invoice. Edit the invoice or create a corrected quotation instead.'); return; } editingQuotationId=q.id; state.draftQuote={...q,items:(q.items||[]).map(item=>({...item}))}; currentPage='edit-quote'; render(); });
  document.querySelectorAll('[data-edit-job]').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); const job=state.jobs.find(x=>x.id===b.dataset.editJob); if(!job) return; editingJobId=job.id; currentPage='edit-job'; render(); }));
  document.querySelectorAll('[data-delete-job]').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); const job=state.jobs.find(x=>x.id===b.dataset.deleteJob); if(!job) return; const linked=state.quotations.some(doc=>doc.jobId===job.id) || state.invoices.some(doc=>doc.jobId===job.id); if(linked){ alert('This booking is linked to a quotation or invoice and cannot be deleted.'); return; } if(confirm('Delete booking ' + (job.title || '') + '? This cannot be undone.')) { state.jobs=state.jobs.filter(x=>x.id!==job.id); saveState(); render(); } }));
  document.querySelectorAll('[data-edit-client]').forEach(b=>b.addEventListener('click',()=>{ editingClientId=b.dataset.editClient; currentPage='edit-client'; render(); }));
  document.querySelectorAll('[data-delete-client]').forEach(b=>b.addEventListener('click',()=>{ if(confirm('Delete this client record?')) { state.clients=state.clients.filter(c=>c.id!==b.dataset.deleteClient); saveState(); render(); } }));
  const cf=document.getElementById('client-form'); if(cf) cf.addEventListener('submit',e=>{e.preventDefault(); const f=new FormData(cf); const details={name:f.get('name'),organisation:f.get('organisation'),phone:f.get('phone'),email:f.get('email'),address:f.get('address')}; const existing=state.clients.find(c=>c.id===editingClientId); if(existing) Object.assign(existing,details); else state.clients.push({id:uid(),...details}); editingClientId=null; saveState(); currentPage='clients'; render();});
  const jf=document.getElementById('job-form'); if(jf) jf.addEventListener('submit',e=>{e.preventDefault(); const f=new FormData(jf); const details={clientId:f.get('clientId'),title:f.get('title'),shootType:f.get('shootType'),shootDate:f.get('shootDate'),days:Number(f.get('days')||1),distanceKm:Number(f.get('distanceKm')||0),location:f.get('location'),status:f.get('status'),brief:f.get('brief')}; const existing=state.jobs.find(j=>j.id===editingJobId); if(existing) Object.assign(existing,details); else state.jobs.push({id:uid(),...details}); editingJobId=null; saveState(); currentPage='jobs'; render();});
  const quote = document.getElementById('quote-form');
  if (quote) bindQuoteForm(quote);
  document.querySelector('[data-print]')?.addEventListener('click',()=>window.print()); document.querySelector('[data-email]')?.addEventListener('click',emailDocument);
  document.querySelector('[data-convert-invoice]')?.addEventListener('click',convertInvoice);
}
function updateQuoteTotals(form) {
  const summary = totals(state.draftQuote);
  for (const output of form.querySelectorAll('[data-quote-total]')) {
    output.textContent = money(summary[output.dataset.quoteTotal]);
  }
}

function bindQuoteForm(form) {
  const draft = state.draftQuote;
  form.addEventListener('input', event => {
    const input = event.target;
    const field = input.dataset.item;
    if (field) {
      const item = draft.items[Number(input.dataset.index)];
      if (field === 'description') {
        item.description = input.value;
      } else {
        const amount = Number(input.value.replaceAll(',', ''));
        const validPrice = field !== 'rate' || (input.validity.valid && Number.isSafeInteger(amount));
        item[field] = validPrice && Number.isFinite(amount) ? amount : 0;
        input.closest('tr').querySelector('[data-line-total]').textContent = money(lineTotal(item));
        updateQuoteTotals(form);
      }
      saveState();
      return;
    }
    if (!input.name) return;
    const name = input.name;
    const numeric = ['days', 'distanceKm', 'depositRate', 'taxRate', 'discount'];
    draft[name] = numeric.includes(name) ? Number(input.value || 0) : input.value;
    if (name === 'shootDate' && input.value) {
      draft.validUntil = addDays(input.value, state.settings.validityDays);
      form.elements.validUntil.value = draft.validUntil;
    }
    if (name === 'depositRate') {
      draft.terms = syncDepositTerms(draft.terms, draft.depositRate);
      form.elements.terms.value = draft.terms;
    }
    updateQuoteTotals(form);
    saveState();
  });
  form.querySelectorAll('[data-remove-item]').forEach(button => button.addEventListener('click', () => {
    draft.items.splice(Number(button.dataset.removeItem), 1);
    if (!draft.items.length) draft.items.push(defaultItem());
    saveState();
    render();
  }));
  form.querySelector('[data-add-line]').addEventListener('click', () => {
    draft.items.push(defaultItem());
    saveState();
    render();
    focusLastQuoteItem('description');
  });
  form.querySelector('[data-add-preset]').addEventListener('click', addPreset);
  form.addEventListener('submit', saveQuote);
}

function focusLastQuoteItem(field) {
  const inputs = document.querySelectorAll(`[data-item="${field}"]`);
  inputs[inputs.length - 1]?.focus();
}

function emailDocument() {
  const { doc, type } = currentDocument || {};
  const client = state.clients.find(c => c.id === doc?.clientId);
  if (!client?.email) {
    alert('This client does not have an email address. Add one in the Clients section first.');
    return;
  }
  const t = totals(doc);
  const kind = type === 'invoice' ? 'invoice' : 'quotation';
  const subject = (type === 'invoice' ? 'Invoice ' : 'Quotation ') + doc.number + ' - ' + (doc.title || 'Twisted iMAGEZ production services');
  const items = (doc.items || []).filter(x => x.description || x.rate).map(x => '- ' + (x.description || 'Production item') + ': ' + money((Number(x.rate) || 0) * (Number(x.quantity) || 0) * (Number(x.days) || 0))).join('\n');
  const body = [
    'Hello ' + client.name + ',',
    '',
    'Please find the ' + kind + ' for ' + (doc.title || 'your production project') + '.',
    '',
    'Reference: ' + doc.number,
    'Total: ' + money(t.total),
    'Deposit: ' + money(t.deposit),
    'Balance: ' + money(t.balance),
    '',
    items,
    '',
    'Please attach the PDF generated with the Print / save PDF button before sending.',
    '',
    'Kind regards,',
    state.business.name,
    state.business.phone,
    state.business.email
  ].join('\n');
  const gmailUrl = 'https://mail.google.com/mail/u/?view=cm&fs=1&tf=cm&to=' + encodeURIComponent(client.email) + '&su=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body); window.open(gmailUrl, '_blank', 'noopener');
}
function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'twisted-imagez-backup-' + today() + '.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
async function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const imported = normalizeState(JSON.parse(await file.text()));
    if (!confirm('Restore this backup and replace the current project records?')) return;
    state = imported;
    saveState();
    render();
    alert('Backup restored successfully.');
  } catch {
    alert('That backup file could not be read.');
  } finally {
    event.target.value = '';
  }
}
function addPreset(){ const choice=prompt(`Enter a pricing item number:\n${PRICING.map((p,i)=>`${i+1}. ${p.label} (${p.unit})`).join('\n')}`); const index=Number(choice)-1; if(!PRICING[index]) return; const p=PRICING[index]; state.draftQuote.items.push({id:uid(),description:p.label,rate:p.rate,quantity:1,days:p.unit==='project'?1:Number(state.draftQuote.days||1)}); saveState(); render(); focusLastQuoteItem('rate'); }
function saveQuote(e){ e.preventDefault(); const invalidRate = [...e.target.querySelectorAll('[data-item="rate"]')].find(input =>
  !Number.isSafeInteger(Number(input.value.replaceAll(',', ''))));
  if (invalidRate) { alert('Enter a whole UGX amount for each unit price.'); invalidRate.focus(); return; }
  const d={...state.draftQuote, items:(state.draftQuote.items||[]).map(item=>({...item}))}; if(!d.clientId || !d.title){alert('Please choose a client and enter a job title.');return;} d.terms=syncDepositTerms(d.terms, d.depositRate); d.items=d.items.filter(x=>x.description || Number(x.rate)>0); if(!d.items.length){alert('Add at least one priced line item.');return;} const existing=editingQuotationId ? state.quotations.find(q=>q.id===editingQuotationId) : null; if(existing){ Object.assign(existing,d,{id:existing.id,number:existing.number,issueDate:existing.issueDate||today(),status:existing.status||'Draft'}); editingQuotationId=null; state.draftQuote=null; saveState(); currentDocument={doc:existing,type:'quotation'}; currentPage='document'; render(); return; } d.id=uid(); d.number=nextNumber('Q'); d.issueDate=today(); d.status='Draft'; state.quotations.push(d); editingQuotationId=null; state.draftQuote=null; saveState(); currentDocument={doc:d,type:'quotation'}; currentPage='document'; render(); }
function convertInvoice(){ const q=currentDocument.doc; const invoice={...q,id:uid(),number:nextNumber('INV'),issueDate:today(),dueDate:today(),status:'Unpaid',sourceQuotation:q.number,items:q.items.map(x=>({...x,id:uid()}))}; state.invoices.push(invoice); q.status='Converted'; saveState(); currentDocument={doc:invoice,type:'invoice'}; currentPage='document'; render(); }

initializeData();










