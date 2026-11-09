// Interfaz conectada: los datos y la autorización residen en el servidor.
let admin = false,
  current = null,
  code = '',
  busy = false,
  stale = false,
  creationKey = crypto.randomUUID(),
  historyTotal = 0,
  historyPages = 1;
const REMEMBER = 'cadph_bienes_tracking';
const safeText = esc;
const receipt = document.createElement('section');
receipt.className = 'panel request-followup';
receipt.innerHTML = `<div class="panel-head"><div><h2>Seguimiento y documento firmado</h2><p id="follow-help">Guarda la solicitud para habilitar las descargas y el firmado.</p></div><span class="badge gray" id="follow-status">Sin guardar</span></div><div class="panel-body"><div id="receipt-info" hidden><strong id="receipt-number"></strong><label class="field mt-3" id="code-field">Código de seguimiento<input id="tracking-code" readonly></label><p id="code-help" class="muted small mt-3">Conserva este código en privado. Permite consultar tu solicitud y adjuntar el firmado desde otro dispositivo.</p><div class="actions mt-3"><button type="button" class="button secondary" id="copy-code">Copiar código</button><button type="button" class="button secondary saved-download" id="saved-pdf">Descargar PDF</button><button type="button" class="button secondary saved-download" id="saved-excel">Descargar Excel (.xlsx)</button></div></div><div id="signed-controls" hidden><h3 class="mt-3">Adjuntar documento firmado</h3><label class="field mt-3">Archivo PDF, JPG o PNG de hasta 10 MB<input id="signed-file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"></label><button type="button" class="button secondary mt-3" id="upload-signed">Adjuntar documento firmado</button><p class="muted small mt-3">El archivo se guarda aparte. No se verifica electrónicamente la firma.</p><progress id="file-progress" class="upload-progress mt-3" value="0" max="100" hidden></progress><p id="file-progress-label" class="muted small" role="status"></p><div id="signed-files"></div><div id="request-events"></div></div></div>`;
form.insertAdjacentElement('afterend', receipt);
const recover = document.createElement('section');
recover.className = 'panel';
recover.innerHTML = `<div class="panel-body"><h2>Volver a una solicitud guardada</h2><p class="muted small mt-3">Introduce el código de seguimiento para consultar la solicitud, descargar o adjuntar el firmado.</p><div class="search-row mt-3"><label class="field flex-1">Código de seguimiento<input id="recover-code" maxlength="160" autocomplete="off"></label><button class="button secondary" type="button" id="recover-request">Recuperar solicitud</button></div></div>`;
receipt.insertAdjacentElement('afterend', recover);
const gate = document.createElement('div');
gate.className = 'receipt-box';
gate.innerHTML =
  '<strong>Primero guarda tu solicitud.</strong><p class="muted small mt-3">Después podrás descargar el formato y adjuntar el documento firmado. El administrador podrá revisar la solicitud y su trazabilidad.</p>';
$('#view-form .toolbar').insertAdjacentElement('afterend', gate);
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value;
const dataKey = (data) =>
  JSON.stringify(
    Object.fromEntries(
      [...fieldNames, 'classification', 'members', 'items'].map((key) => [
        key,
        canonical(data[key] ?? ''),
      ]),
    ),
  );
function saved() {
  return !!current && !stale && dataKey(current.data) === dataKey(getData());
}
function signedStatus(record) {
  return (record.attachments || []).some((file) => file.version === record.version)
    ? 'Firmado adjunto'
    : 'Pendiente de firmado';
}
function authHeaders(jsonBody = false) {
  return {
    ...(jsonBody ? { 'Content-Type': 'application/json' } : {}),
    ...(code ? { 'x-bienes-code': code } : {}),
  };
}
async function api(path, method = 'GET', body, options = {}) {
  const response = await fetch('/api/bienes/' + path, {
    method,
    headers: { ...authHeaders(body !== undefined), ...options.headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: options.signal,
  });
  if (!response.ok) {
    let text = 'No se pudo completar la operación.';
    try {
      text = (await response.json()).error || text;
    } catch {}
    if (response.status === 409 && current) {
      stale = true;
      updateControls();
    }
    throw Error(text);
  }
  return response;
}
async function apiJson(path, method = 'GET', body) {
  return (await api(path, method, body)).json();
}
const baseNotify = notify;
notify = (text, error = false) => {
  baseNotify(text, error);
  if (current && !error) {
    const jump = document.createElement('button');
    jump.type = 'button';
    jump.className = 'text-button';
    jump.textContent = 'Ver seguimiento y adjuntar firmado';
    jump.onclick = () => receipt.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('#notice').appendChild(jump);
  }
  resize();
};
function fileHtml(record) {
  return record.attachments.length
    ? record.attachments
        .map(
          (file) =>
            `<div class="signed-file-row"><div><strong>${esc(file.name)}</strong><small>${(file.size / 1024).toFixed(0)} KB · Versión ${file.version} · ${stamp(file.date)}</small><small>Adjuntado por ${esc(file.by)}</small></div><button class="button secondary" type="button" data-signed="${esc(file.id)}" data-request="${record.id}">Descargar firmado</button></div>`,
        )
        .join('')
    : '<p class="muted small mt-3">Aún no hay documentos firmados adjuntos.</p>';
}
function eventsHtml(record) {
  return `<h3 class="mt-3">Trazabilidad de la solicitud</h3><ol class="timeline">${record.events
    .slice()
    .reverse()
    .map(
      (event) =>
        `<li class="event"><h3>${esc(event.action)}</h3><p>${esc(event.detail)}</p><small>${esc(event.by)} · ${stamp(event.date)} · Versión ${event.version}</small></li>`,
    )
    .join('')}</ol>`;
}
function updateControls() {
  const ready = saved();
  $('#pdf-current').disabled = busy || !ready;
  $('#excel-current').disabled = busy || !ready;
  $('#save-request').disabled = busy;
  $('#save-request').innerHTML = busy
    ? 'Procesando…'
    : ready
      ? 'Solicitud guardada'
      : 'Guardar solicitud';
  gate.hidden = ready;
  $('#follow-status').textContent = !current
    ? 'Sin guardar'
    : !ready
      ? 'Cambios sin guardar o solicitud desactualizada'
      : signedStatus(current);
  $('#follow-help').textContent = !current
    ? 'Guarda la solicitud antes de descargarla.'
    : !ready
      ? 'Guarda los cambios. Si otro usuario la modificó, recupérala antes de continuar.'
      : 'El administrador puede consultar la solicitud y sus adjuntos.';
  $('#receipt-info').hidden = !current;
  $('#signed-controls').hidden = !current;
  $('.saved-download')?.classList.toggle('ready', ready);
  $$('.saved-download').forEach((b) => (b.disabled = busy || !ready));
  $('#signed-file').disabled = busy || !ready;
  $('#upload-signed').disabled = busy || !ready;
  $('#recover-request').disabled = busy;
  if (current) {
    $('#receipt-number').textContent = `Solicitud #${current.id} · Versión ${current.version}`;
    $('#tracking-code').value = code;
    $('#code-field').hidden = !code;
    $('#copy-code').hidden = !code;
    $('#code-help').hidden = !code;
    $('#signed-files').innerHTML = fileHtml(current);
    $('#request-events').innerHTML = eventsHtml(current);
  }
  resize();
}
form.addEventListener('input', updateControls);
form.addEventListener('change', updateControls);
form.addEventListener('click', () => queueMicrotask(updateControls));
const basicClear = clearForm;
function resetRequest() {
  current = null;
  editId = null;
  code = '';
  stale = false;
  creationKey = crypto.randomUUID();
  sessionStorage.removeItem(REMEMBER);
  basicClear();
  $('#signed-file').value = '';
  updateControls();
}
function loadRequest(record, duplicate = false) {
  current = duplicate ? null : record;
  editId = duplicate ? null : record.id;
  stale = false;
  basicClear();
  for (const name of fieldNames) form.elements[name].value = record.data[name] || '';
  form.elements.classification.value = record.data.classification;
  items = structuredClone(record.data.items);
  members = record.data.members.length
    ? structuredClone(record.data.members)
    : [blankMember(), blankMember(), blankMember()];
  renderItems();
  renderMembers();
  dependencies();
  $('#record-status').textContent = duplicate
    ? `Copia de #${record.id} · Sin guardar`
    : `Solicitud #${record.id} · Versión ${record.version}`;
  if (duplicate) {
    code = '';
    creationKey = crypto.randomUUID();
    sessionStorage.removeItem(REMEMBER);
  }
  $('#signed-file').value = '';
  view('form');
  updateControls();
}
form.onsubmit = async (event) => {
  event.preventDefault();
  if (busy) return;
  const data = getData();
  if (!validate(data)) return;
  if (saved()) {
    notify(`La solicitud #${current.id} ya está guardada.`);
    return;
  }
  busy = true;
  updateControls();
  try {
    const result = current
      ? await apiJson('requests/' + current.id, 'PATCH', { version: current.version, data })
      : await apiJson('requests', 'POST', { data, key: creationKey });
    if (result.code) {
      code = result.code;
      sessionStorage.setItem(REMEMBER, code);
    }
    current = result;
    editId = result.id;
    stale = false;
    $('#record-status').textContent = `Solicitud #${result.id} · Versión ${result.version}`;
    notify(
      `Solicitud #${result.id} guardada. Ya puedes descargar el formato. Conserva tu código para adjuntar el firmado después.`,
    );
    window.parent.postMessage({ kind: 'bienes-top' }, location.origin);
  } catch (error) {
    notify(error.message, true);
  } finally {
    busy = false;
    updateControls();
  }
};
$('#new-request').onclick = () => {
  if (
    confirm(
      '¿Iniciar una solicitud nueva? Conserva el código de la solicitud anterior. Los cambios sin guardar se descartarán.',
    )
  ) {
    resetRequest();
    notify('Nueva solicitud lista para diligenciar.');
  }
};
$('#copy-code').onclick = async () => {
  try {
    await navigator.clipboard.writeText(code);
    notify('Código copiado. Consérvalo en privado.');
  } catch {
    $('#tracking-code').select();
    notify('Selecciona y copia tu código de seguimiento.');
  }
};
$('#recover-request').onclick = async () => {
  if (busy) return;
  busy = true;
  updateControls();
  const oldCode = code;
  try {
    const entered = $('#recover-code').value.trim();
    const record = await apiJson('recover', 'POST', { code: entered });
    code = entered;
    sessionStorage.setItem(REMEMBER, code);
    loadRequest(record);
    notify(`Solicitud #${record.id} recuperada.`);
  } catch (error) {
    code = oldCode;
    notify(error.message, true);
  } finally {
    busy = false;
    updateControls();
  }
};
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function refreshCurrent(id) {
  const record = await apiJson('requests/' + id);
  if (current?.id === id) {
    current = record;
    updateControls();
  }
  return record;
}
async function exportDocument(record, format) {
  if (busy) return;
  busy = true;
  updateControls();
  try {
    const response = await api('requests/' + record.id + '/documents', 'POST', {
      version: record.version,
      format,
    });
    const name =
      response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ||
      'GIL-F-014.' + (format === 'PDF' ? 'pdf' : 'xlsx');
    downloadBlob(await response.blob(), name);
    const latest = await refreshCurrent(record.id);
    if (detailRecord?.id === record.id) renderDetail(latest);
    notify(
      `Documento ${format} generado. El evento quedó registrado en la solicitud #${record.id}.`,
    );
  } catch (error) {
    notify(error.message, true);
  } finally {
    busy = false;
    updateControls();
  }
}
$('#pdf-current').onclick = () => saved() && exportDocument(current, 'PDF');
$('#excel-current').onclick = () => saved() && exportDocument(current, 'XLSX');
$('#saved-pdf').onclick = () => $('#pdf-current').click();
$('#saved-excel').onclick = () => $('#excel-current').click();
async function checkedFile(file) {
  if (!file || !file.size) throw Error('Selecciona el documento firmado.');
  if (file.size > 10 * 1024 * 1024) throw Error('El archivo supera 10 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-',
    png = [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v),
    jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const type = pdf ? 'application/pdf' : png ? 'image/png' : jpg ? 'image/jpeg' : null;
  if (
    !type ||
    !(
      (pdf && /\.pdf$/i.test(file.name)) ||
      (png && /\.png$/i.test(file.name)) ||
      (jpg && /\.jpe?g$/i.test(file.name))
    )
  )
    throw Error('Selecciona un PDF, JPG o PNG válido.');
  return {
    bytes,
    type,
    sha256: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join(''),
  };
}
function progress(value, label) {
  $('#file-progress').hidden = false;
  $('#file-progress').value = value;
  $('#file-progress-label').textContent = label;
}
$('#upload-signed').onclick = async () => {
  if (busy || !saved()) return;
  const record = current;
  busy = true;
  updateControls();
  let upload;
  try {
    const file = $('#signed-file').files[0],
      checked = await checkedFile(file);
    upload = await apiJson(`requests/${record.id}/attachments`, 'POST', {
      version: record.version,
      name: file.name,
      size: file.size,
      type: checked.type,
      sha256: checked.sha256,
    });
    const total = Math.ceil(file.size / upload.chunkSize);
    for (let i = 0; i < total; i++) {
      const response = await fetch(
        `/api/bienes/requests/${record.id}/attachments/${upload.id}/chunks/${i}`,
        {
          method: 'PUT',
          headers: { ...authHeaders(), 'Content-Type': 'application/octet-stream' },
          body: checked.bytes.slice(i * upload.chunkSize, (i + 1) * upload.chunkSize),
        },
      );
      if (!response.ok)
        throw Error((await response.json()).error || 'No se pudo completar la carga.');
      progress(
        Math.round(((i + 1) / total) * 95),
        `Cargando archivo: ${Math.round(((i + 1) / total) * 95)} %`,
      );
    }
    current = await apiJson(`requests/${record.id}/attachments/${upload.id}/finish`, 'POST', {});
    $('#signed-file').value = '';
    progress(100, 'Archivo firmado guardado.');
    notify(`Documento firmado adjuntado a la solicitud #${record.id}.`);
  } catch (error) {
    if (upload)
      await api(`requests/${record.id}/attachments/${upload.id}`, 'DELETE').catch(() => {});
    notify(error.message, true);
  } finally {
    busy = false;
    updateControls();
  }
};
async function downloadSigned(id, requestId) {
  if (busy) return;
  busy = true;
  updateControls();
  try {
    const meta = await apiJson(`requests/${requestId}/attachments/${id}/download`, 'POST', {}),
      bytes = new Uint8Array(meta.size),
      count = Math.ceil(meta.size / meta.chunkSize);
    for (let i = 0; i < count; i++) {
      const response = await api(`requests/${requestId}/attachments/${id}/chunks/${i}`);
      bytes.set(new Uint8Array(await response.arrayBuffer()), i * meta.chunkSize);
      progress(
        Math.round(((i + 1) / count) * 100),
        `Descargando firmado: ${Math.round(((i + 1) / count) * 100)} %`,
      );
    }
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');
    if (digest !== meta.sha256)
      throw Error('El archivo no superó la comprobación de integridad. Intenta nuevamente.');
    downloadBlob(new Blob([bytes], { type: meta.type }), meta.name);
    const record = await refreshCurrent(Number(requestId));
    if (detailRecord?.id === record.id) renderDetail(record);
  } catch (error) {
    notify(error.message, true);
  } finally {
    busy = false;
    updateControls();
  }
}
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-signed]');
  if (button) downloadSigned(button.dataset.signed, button.dataset.request);
});
function query() {
  return new URLSearchParams({
    q: $('#filter-search').value,
    from: $('#filter-from').value,
    to: $('#filter-to').value,
    movement: $('#filter-movement').value,
    destination: $('#filter-destination').value,
    area: $('#filter-area').value,
    order: $('#filter-order').value,
    page: String(historyPage),
  });
}
let historySeq = 0;
async function renderHistory() {
  if (!admin) return;
  const seq = ++historySeq;
  try {
    const result = await apiJson('requests?' + query());
    if (seq !== historySeq) return;
    storage.records = result.records;
    historyPage = result.page;
    historyTotal = result.total;
    historyPages = result.pages;
    $('#history-count').textContent = result.total;
    $('#history-body').innerHTML = result.records
      .map(
        (record) =>
          `<tr><td>#${record.id}</td><td>${dateLabel(record.date)}</td><td><span class="badge ${esc(record.movement)}">${esc(record.movement)}</span></td><td><strong>${esc(record.holder)}</strong><small>${esc(record.identification)}</small><small>${record.origin === 'PUBLICA' ? 'Consulta pública · ' : ''}${record.attachments.some((a) => a.version === record.version) ? 'Firmado adjunto' : 'Pendiente de firmado'}</small></td><td>${esc(record.destination)}<small>${esc(record.area || 'Sin área')}</small></td><td>${record.items.length}</td><td>${esc(record.registeredBy)}<small>${stamp(record.createdAt)}</small></td><td><div class="history-actions">${[
            ['detail', 'Ver detalle'],
            ['edit', 'Editar'],
            ['duplicate', 'Duplicar'],
            ['pdf', 'PDF'],
            ['excel', 'Excel'],
            ['delete', 'Eliminar'],
          ]
            .map(
              ([action, label]) =>
                `<button data-action="${action}" data-id="${record.id}">${label}</button>`,
            )
            .join('')}</div></td></tr>`,
      )
      .join('');
    $('#history-empty').hidden = !!result.records.length;
    $('#history-empty h3').textContent = result.total
      ? 'No hay resultados en esta página'
      : 'No hay movimientos para estos filtros';
    $('#history-total').textContent = `${result.total} registros`;
    $('#page-number').textContent = `Página ${result.page} de ${result.pages}`;
    $('#previous-page').disabled = result.page <= 1;
    $('#next-page').disabled = result.page >= result.pages;
    resize();
  } catch (error) {
    storage.records = [];
    $('#history-body').innerHTML = '';
    notify(error.message, true);
  }
}
let filterTimer;
for (const input of $$('.filters input,.filters select'))
  input.oninput = () => {
    historyPage = 1;
    clearTimeout(filterTimer);
    filterTimer = setTimeout(renderHistory, 250);
  };
$('#reset-filters').onclick = () => {
  $$('.filters input').forEach((input) => (input.value = ''));
  $$('.filters select').forEach((input) => (input.selectedIndex = 0));
  historyPage = 1;
  renderHistory();
};
$('#previous-page').onclick = () => {
  historyPage--;
  renderHistory();
};
$('#next-page').onclick = () => {
  historyPage++;
  renderHistory();
};
function renderDetail(record) {
  detailRecord = record;
  $('#dialog-title').textContent =
    `Solicitud #${record.id} · ${record.data.movement} · Versión ${record.version}`;
  const d = record.data;
  const labels = {
    date: 'Fecha solicitud',
    movement: 'Movimiento',
    area: 'Área',
    head: 'Jefe o coordinador',
    holderType: 'Tipo de cuentadante',
    holder: 'Cuentadante',
    identification: 'Identificación',
    destination: 'Destino',
    group: 'Ficha',
    classification: 'Clasificación',
    authorizer: 'Quien autoriza',
    position: 'Cargo',
    signature: 'Firma declarada',
  };
  $('#document-preview').innerHTML =
    `<div class="section-heading"><h3>Documentos firmados</h3><span class="badge gray">${signedStatus(record)}</span></div>${fileHtml(record)}${eventsHtml(record)}<h3>Datos de la solicitud</h3><dl class="request-detail-grid mt-3">${Object.entries(
      labels,
    )
      .map(
        ([key, label]) =>
          `<div><dt>${label}</dt><dd>${esc(key === 'date' ? dateLabel(d[key]) : d[key] || 'Sin información')}</dd></div>`,
      )
      .join(
        '',
      )}</dl>${d.members.length ? `<h3 class="mt-3">Integrantes</h3><ul>${d.members.map((m) => `<li>${esc(m.name)} · ${esc(m.identification)}</li>`).join('')}</ul>` : ''}<h3 class="mt-3">Bienes solicitados</h3><div class="table-wrap"><table><thead><tr><th>ÍTEM</th><th>CÓDIGO</th><th>DESCRIPCIÓN</th><th>UNIDAD</th><th>SOLICITADA</th><th>ENTREGADA</th><th>OBSERVACIONES</th></tr></thead><tbody>${d.items.map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.code)}</td><td>${esc(i.description)}</td><td>${esc(i.unit)}</td><td>${esc(i.requested)}</td><td>${esc(i.delivered)}</td><td>${esc(i.observations)}</td></tr>`).join('')}</tbody></table></div>`;
}
$('#close-dialog').onclick = () => $('#detail-dialog').close();
$('#detail-dialog').onclick = (event) => {
  if (event.target === $('#detail-dialog')) event.target.close();
};
$('#detail-pdf').onclick = () => detailRecord && exportDocument(detailRecord, 'PDF');
$('#detail-excel').onclick = () => detailRecord && exportDocument(detailRecord, 'XLSX');
$('#history-body').onclick = async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button || busy) return;
  try {
    const record = await apiJson('requests/' + button.dataset.id);
    switch (button.dataset.action) {
      case 'detail':
        renderDetail(record);
        $('#detail-dialog').showModal();
        window.parent.postMessage({ kind: 'bienes-top' }, location.origin);
        break;
      case 'edit':
        loadRequest(record);
        break;
      case 'duplicate':
        loadRequest(record, true);
        break;
      case 'pdf':
        await exportDocument(record, 'PDF');
        break;
      case 'excel':
        await exportDocument(record, 'XLSX');
        break;
      case 'delete':
        if (
          confirm(
            `¿Eliminar la solicitud #${record.id}? Se retirará del historial activo y se conservará su auditoría.`,
          )
        ) {
          await api('requests/' + record.id, 'DELETE', { version: record.version });
          if (current?.id === record.id) resetRequest();
          renderHistory();
          notify('Solicitud retirada del historial activo.');
        }
        break;
    }
  } catch (error) {
    notify(error.message, true);
  }
};
$('#export-history').onclick = async () => {
  if (busy) return;
  busy = true;
  updateControls();
  try {
    const response = await api('requests/export?' + query());
    downloadBlob(await response.blob(), 'HISTORIAL_BIENES.xlsx');
    notify('Se exportó el historial filtrado completo, con una fila por ítem.');
  } catch (error) {
    notify(error.message, true);
  } finally {
    busy = false;
    updateControls();
  }
};
function resize() {
  window.parent.postMessage(
    { kind: 'bienes-height', height: Math.ceil(document.body.getBoundingClientRect().height) + 2 },
    location.origin,
  );
}
window.addEventListener('message', (event) => {
  if (
    event.origin === location.origin &&
    event.source === parent &&
    event.data?.kind === 'bienes-viewport'
  )
    document.documentElement.style.setProperty(
      '--screen-height',
      Math.max(320, Number(event.data.height) || 800) + 'px',
    );
});
new ResizeObserver(resize).observe(document.body);
window.addEventListener('resize', resize);
async function boot() {
  basicClear();
  updateControls();
  try {
    const session = await apiJson('session');
    admin = session.admin;
    $('#tab-history').hidden = !admin;
    if (admin) renderHistory();
    const remembered = sessionStorage.getItem(REMEMBER);
    if (remembered) {
      try {
        const record = await apiJson('recover', 'POST', { code: remembered });
        code = remembered;
        loadRequest(record);
      } catch {
        sessionStorage.removeItem(REMEMBER);
      }
    }
  } catch (error) {
    notify(error.message, true);
  }
  updateControls();
}
boot();
