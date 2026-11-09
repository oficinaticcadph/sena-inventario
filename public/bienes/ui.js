/* Campos y presentación del formulario institucional. Persistencia: remote.js. */
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const icons = {
  monitor: 'M3 4h18v12H3z M8 21h8 M12 16v5',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  transfer: 'M4 7h16 M16 3l4 4-4 4 M20 17H4 M8 13l-4 4 4 4',
  history: 'M3 4v6h6 M3 10a9 9 0 1 1 2 8 M12 7v5l3 2',
  users:
    'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M17 4a4 4 0 0 1 0 7 M22 21v-3a4 4 0 0 0-3-4',
  shield: 'M12 2l9 4v6c0 5-9 10-9 10S3 17 3 12V6z M8 12l3 3 5-6',
  info: 'M12 8h.01 M12 11v6 M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',
  download: 'M12 3v12 M7 10l5 5 5-5 M4 15v6h16v-6',
  file: 'M14 2H5v20h14V7z M14 2v6h6 M8 12h8 M8 16h8',
  save: 'M4 3h14l3 3v15H3V3z M7 3v6h10V3 M7 21v-8h10v8',
};
function decorate() {
  $$('[data-icon]').forEach(
    (el) =>
      (el.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[el.dataset.icon] || icons.file}"/></svg>`),
  );
}
decorate();
let storage = { records: [] };
let editId = null,
  detailRecord = null,
  historyPage = 1,
  items = [],
  members = [];
const pageSize = 8,
  form = $('#request-form');
const fieldNames = [
  'movement',
  'date',
  'area',
  'head',
  'holderType',
  'holder',
  'identification',
  'destination',
  'group',
  'authorizer',
  'position',
  'signature',
];
const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
const blankItem = () => ({
  code: '',
  description: '',
  unit: '',
  requested: '',
  delivered: '',
  observations: '',
});
const blankMember = () => ({ name: '', identification: '' });
const dateLabel = (v) => {
  const [y, m, d] = String(v).split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
};
const stamp = (v) => new Date(v).toLocaleString('es-CO', { timeZone: 'America/Bogota' });
const norm = (v) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
function notify(text, error = false) {
  const n = $('#notice');
  n.hidden = false;
  n.className = error ? 'error' : 'success';
  n.textContent = text;
}
function view(tab) {
  const isForm = tab === 'form';
  $('#view-form').hidden = !isForm;
  $('#view-history').hidden = isForm;
  for (const [s, on] of [
    ['#tab-form', isForm],
    ['#tab-history', !isForm],
  ]) {
    $(s).classList.toggle('active', on);
    $(s).setAttribute('aria-selected', on);
  }
  if (!isForm) renderHistory();
}
$('#tab-form').onclick = () => view('form');
$('#tab-history').onclick = () => view('history');
function renderMembers() {
  $('#members-body').innerHTML = members
    .map(
      (m, i) =>
        `<tr><td><input aria-label="Nombre del integrante ${i + 1}" data-member="${i}" data-key="name" value="${esc(m.name)}" maxlength="160"></td><td><input aria-label="Identificación del integrante ${i + 1}" data-member="${i}" data-key="identification" value="${esc(m.identification)}" maxlength="60"></td><td><button type="button" class="delete-row" data-delete-member="${i}" aria-label="Eliminar integrante ${i + 1}">×</button></td></tr>`,
    )
    .join('');
}
function renderItems() {
  $('#items-body').innerHTML = items
    .map(
      (v, i) =>
        `<tr><td>${i + 1}</td>${['code', 'description', 'unit', 'requested', 'delivered', 'observations'].map((k) => `<td>${['description', 'observations'].includes(k) ? `<textarea data-item="${i}" data-key="${k}" aria-label="${k === 'description' ? 'Descripción' : 'Observaciones'} del ítem ${i + 1}" maxlength="500">${esc(v[k])}</textarea>` : `<input data-item="${i}" data-key="${k}" aria-label="${{ code: 'Código SENA', unit: 'Unidad de medida', requested: 'Cantidad solicitada', delivered: 'Cantidad entregada' }[k]} del ítem ${i + 1}" ${['requested', 'delivered'].includes(k) ? 'type="number" min="0" step="any" inputmode="decimal"' : 'maxlength="100"'} value="${esc(v[k])}">`}</td>`).join('')}<td><button type="button" class="delete-row" data-delete-item="${i}" aria-label="Eliminar ítem ${i + 1}">×</button></td></tr>`,
    )
    .join('');
  $('#items-count').textContent = `${items.length} ${items.length === 1 ? 'ítem' : 'ítems'}`;
}
$('#items-body').oninput = (e) => {
  if (e.target.dataset.item !== undefined)
    items[Number(e.target.dataset.item)][e.target.dataset.key] = e.target.value;
};
$('#members-body').oninput = (e) => {
  if (e.target.dataset.member !== undefined)
    members[Number(e.target.dataset.member)][e.target.dataset.key] = e.target.value;
};
$('#items-body').onclick = (e) => {
  const b = e.target.closest('[data-delete-item]');
  if (!b) return;
  if (items.length === 1) {
    notify('Debe quedar al menos un ítem.', true);
    return;
  }
  items.splice(Number(b.dataset.deleteItem), 1);
  renderItems();
};
$('#members-body').onclick = (e) => {
  const b = e.target.closest('[data-delete-member]');
  if (!b) return;
  members.splice(Number(b.dataset.deleteMember), 1);
  if (!members.length) members.push(blankMember());
  renderMembers();
};
$('#add-item').onclick = () => {
  items.push(blankItem());
  renderItems();
};
$('#add-member').onclick = () => {
  members.push(blankMember());
  renderMembers();
};
function dependencies() {
  const multiple = form.elements.holderType.value === 'MÚLTIPLE';
  $('#members-section').hidden = !multiple;
  const training = form.elements.destination.value === 'Formación';
  form.elements.group.disabled = !training;
}
form.elements.holderType.onchange = dependencies;
form.elements.destination.onchange = dependencies;
function clearForm() {
  form.reset();
  form.elements.date.value = today();
  items = [blankItem()];
  members = [blankMember(), blankMember(), blankMember()];
  editId = null;
  $('#record-status').textContent = 'Nueva solicitud';
  $('#errors').hidden = true;
  $$('.invalid').forEach((e) => e.classList.remove('invalid'));
  renderItems();
  renderMembers();
  dependencies();
}
function getData() {
  const value = Object.fromEntries(
    fieldNames.map((n) => [n, String(form.elements[n].value).trim()]),
  );
  value.classification = form.elements.classification.value;
  value.group = value.destination === 'Formación' ? value.group : '';
  value.members =
    value.holderType === 'MÚLTIPLE'
      ? members
          .map((m) => ({ name: m.name.trim(), identification: m.identification.trim() }))
          .filter((m) => m.name || m.identification)
      : [];
  value.items = items.map((i) =>
    Object.fromEntries(Object.entries(i).map(([k, v]) => [k, String(v).trim()])),
  );
  return value;
}
function validate(d) {
  const errors = [];
  $$('.invalid').forEach((e) => e.classList.remove('invalid'));
  for (const [key, label] of [
    ['date', 'Fecha solicitud'],
    ['head', 'Jefe o coordinador'],
    ['holderType', 'Tipo de cuentadante'],
    ['holder', 'Nombre del cuentadante'],
    ['identification', 'Identificación del cuentadante'],
    ['destination', 'Destino'],
  ]) {
    if (!d[key]) {
      errors.push(`Completa el campo ${label}.`);
      form.elements[key].classList.add('invalid');
    }
  }
  if (
    d.holderType === 'MÚLTIPLE' &&
    (!d.members.length || d.members.some((m) => !m.name || !m.identification))
  )
    errors.push(
      'Relaciona al menos un integrante y completa nombre e identificación de cada fila utilizada.',
    );
  if (!d.items.length) errors.push('Agrega al menos un ítem.');
  d.items.forEach((i, n) => {
    for (const [key, bad, msg] of [
      ['description', !i.description, 'escribe la descripción del bien'],
      [
        'requested',
        !i.requested || !Number.isFinite(Number(i.requested)) || Number(i.requested) <= 0,
        'la cantidad solicitada debe ser un número mayor que cero',
      ],
      [
        'delivered',
        i.delivered !== '' && (!Number.isFinite(Number(i.delivered)) || Number(i.delivered) < 0),
        'la cantidad entregada debe ser un número igual o mayor que cero',
      ],
    ]) {
      if (bad) {
        errors.push(`Ítem ${n + 1}: ${msg}.`);
        $(`[data-item="${n}"][data-key="${key}"]`)?.classList.add('invalid');
      }
    }
  });
  $('#errors').hidden = !errors.length;
  $('#errors').innerHTML = errors.length
    ? `<strong>Revisa la solicitud antes de continuar</strong><ul>${errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`
    : '';
  if (errors.length) $('#errors').scrollIntoView({ behavior: 'smooth', block: 'center' });
  return !errors.length;
}
