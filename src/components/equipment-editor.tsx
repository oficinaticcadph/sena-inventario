'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuditDetail } from './audit-detail';
import { Download, Save, Info, LoaderCircle, History, FileSpreadsheet } from 'lucide-react';
import { coreFields, manualFields, mappedKeys, isMissing, type Ficha } from '@/lib/fields';
import { withSoftwareDefaults } from '@/lib/software';
export interface EditorData {
  [key: string]: string | Ficha;
  ficha: Ficha;
  grupo: string;
  placaSena: string;
  nombreUsuario: string;
  contacto: string;
}
export interface HistoryItem {
  id: string;
  tipo: string;
  detalle: string;
  autor: string;
  fecha: string;
  cambios?: unknown;
}
export function EquipmentEditor({
  id,
  version = 1,
  initial: providedInitial,
  role,
  active = true,
  context = {},
  history = [],
}: {
  id?: string;
  version?: number;
  initial: EditorData;
  role: 'admin' | 'consulta';
  active?: boolean;
  context?: Record<string, string>;
  history?: HistoryItem[];
}) {
  const router = useRouter();
  const initial: EditorData = {
    ...providedInitial,
    ficha: withSoftwareDefaults(providedInitial.ficha),
  };
  const [data, setData] = useState(initial),
    [tab, setTab] = useState('ficha'),
    [busy, setBusy] = useState(''),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [reason, setReason] = useState('');
  const admin = role === 'admin',
    isNew = !id;
  const update = (key: string, value: string, manual = false) =>
    setData((old) =>
      manual ? { ...old, ficha: { ...old.ficha, [key]: value } } : { ...old, [key]: value },
    );
  const field = (key: string, label: string, manual = false) => {
    const value = String(manual ? data.ficha[key] || '' : data[key] || '');
    const missing = mappedKeys.has(key) && isMissing(initial[key]);
    const readonly = !isNew && (!active || (!admin && !manual && key !== 'hostname' && !missing));
    return (
      <label key={key} className={`field ${missing ? 'warning' : ''}`}>
        {label}
        <input
          value={value}
          readOnly={readonly}
          maxLength={500}
          onChange={(e) => update(key, e.target.value, manual)}
          placeholder={readonly ? 'Sin información' : 'Completar información'}
        />
        {missing && <small>No encontrado en inventario</small>}
      </label>
    );
  };
  async function action(kind: 'save' | 'excel' | 'delete' | 'note') {
    setError('');
    setMessage('');
    if (
      ((kind === 'save' && !isNew) || kind === 'delete' || kind === 'note') &&
      reason.trim().length < 4
    ) {
      setError('Escribe un motivo de al menos 4 caracteres para registrar la acción.');
      return;
    }
    if (
      kind === 'delete' &&
      !window.confirm(`¿Dar de baja el equipo ${data.placaSena}? Se conservará su historial.`)
    )
      return;
    setBusy(kind);
    try {
      let url = id ? `/api/equipos/${id}` : '/api/equipos',
        method = isNew ? 'POST' : 'PATCH';
      let payload: unknown = isNew ? data : { datos: data, version, detalle: reason };
      if (kind === 'excel') {
        const campos: Ficha = {};
        for (const [key, value] of Object.entries(data.ficha))
          if (value !== (initial.ficha[key] || '')) campos[key] = value;
        for (const key of [...Object.keys(coreFields), 'nombreUsuario'])
          if (data[key] !== initial[key]) {
            if (key === 'hostname' || isMissing(initial[key])) campos[key] = String(data[key]);
            else
              throw new Error(
                'Guarda primero los cambios del inventario antes de generar el Excel.',
              );
          }
        url += '/excel';
        method = 'POST';
        payload = { version, campos };
      }
      if (kind === 'delete') {
        method = 'DELETE';
        payload = { version, detalle: reason };
      }
      if (kind === 'note') {
        url = '/api/movimientos';
        method = 'POST';
        payload = { equipoId: id, detalle: reason };
      }
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'No se pudo completar la operación.');
      }
      if (kind === 'excel') {
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = `HOJA_DE_VIDA_${String(data.placaSena).replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        setMessage('Hoja de vida generada. La descarga quedó registrada en el historial.');
        router.refresh();
      } else if (isNew) {
        const result = await response.json();
        router.push(`/equipos/${result.id}`);
        router.refresh();
      } else {
        setMessage(
          kind === 'delete' ? 'Equipo dado de baja.' : 'La información se guardó correctamente.',
        );
        setReason('');
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.');
    } finally {
      setBusy('');
    }
  }
  return (
    <>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="success" role="status">
          {message}
        </div>
      )}
      <section className="panel">
        <div className="tabs" role="tablist" aria-label="Secciones de la ficha">
          {[
            { key: 'ficha', label: 'Ficha del equipo' },
            { key: 'software', label: 'Software y diagnóstico' },
            ...(!isNew
              ? [
                  { key: 'contexto', label: 'Datos del inventario' },
                  { key: 'historial', label: 'Historial de movimientos' },
                ]
              : []),
          ].map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              className={`tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="panel-body" role="tabpanel">
          {tab === 'ficha' && (
            <>
              <div className="section-label">01 / Identificación del equipo</div>
              <div className="forms-grid">
                <label className="field">
                  Placa SENA
                  <input
                    value={data.placaSena}
                    readOnly={!isNew}
                    required
                    maxLength={80}
                    onChange={(e) => update('placaSena', e.target.value.toUpperCase())}
                  />
                </label>
                {Object.entries(coreFields)
                  .slice(0, 5)
                  .map(([k, l]) => field(k, l))}
                <label className="field">
                  Grupo
                  <select
                    value={data.grupo}
                    disabled={!admin || !active}
                    onChange={(e) => update('grupo', e.target.value)}
                  >
                    <option>Funcionarios</option>
                    <option>FORMACION</option>
                    <option>ELECTRONICOS</option>
                    <option>Manual</option>
                  </select>
                </label>
              </div>
              <div className="section-label mt-8">02 / Responsable y ubicación</div>
              <div className="forms-grid">
                {field('nombreUsuario', 'Nombre del usuario / cuentadante')}
                {field('jefe', manualFields.jefe, true)}
                {field('contacto', 'Número de contacto')}
              </div>
              <div className="section-label mt-8">03 / Especificaciones técnicas</div>
              <div className="forms-grid">
                {Object.entries(coreFields)
                  .slice(5)
                  .map(([k, l]) => field(k, l))}
                {['tipoParte', 'numeroParte', 'especificacionParte', 'enrolado'].map((k) =>
                  field(k, manualFields[k as keyof typeof manualFields], true),
                )}
              </div>
            </>
          )}
          {tab === 'software' && (
            <>
              <div className="section-label">3. SOFTWARE BASE DE EQUIPO</div>
              <p className="muted text-sm mb-5">
                Se conservan los valores base del formato original. Puedes modificar la edición,
                versión y licencia antes de descargar. Guarda los cambios si deben quedar en la
                ficha del equipo.
              </p>
              {['so', 'office', 'antivirus', 'adobe', 'laps', 'zip', 'vpn', 'jafm'].map((k) => (
                <div className="forms-grid mb-5" key={k}>
                  {[k, k + 'Version', k + 'Licencia'].map((key) =>
                    field(key, manualFields[key as keyof typeof manualFields], true),
                  )}
                </div>
              ))}
              <div className="section-label mt-8">05 / Solicitud y diagnóstico</div>
              <div className="forms-grid">
                {[
                  'observacion',
                  'incidente',
                  'requerimiento',
                  'solicitud',
                  'borrado',
                  'accion',
                  'causas',
                  'recomendacion',
                  'repuesto',
                  'garantia',
                  'siniestro',
                  'concepto',
                  'asignacion',
                  'reasignacion',
                  'devolucion',
                ].map((k) => field(k, manualFields[k as keyof typeof manualFields], true))}
              </div>
            </>
          )}
          {tab === 'contexto' && (
            <>
              <div className="info-strip">
                <Info size={18} />
                Datos de contexto del inventario original. No se incluyen en el Excel generado.
              </div>
              <dl className="context-grid">
                {Object.entries(context).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v || 'Sin información'}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
          {tab === 'historial' && (
            <>
              {history.length ? (
                <div className="timeline">
                  {history.map((h) => (
                    <article key={h.id} className="event">
                      <span className="badge gray">{h.tipo}</span>
                      <p>{h.detalle}</p>
                      <small>
                        {h.autor} ·{' '}
                        {new Date(h.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
                      </small>
                      {h.cambios && Object.keys(h.cambios as object).length > 0 ? (
                        <details>
                          <summary>Ver detalle del registro</summary>
                          <AuditDetail value={h.cambios} />
                        </details>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  <History size={28} />
                  <p>Este equipo aún no tiene movimientos.</p>
                </div>
              )}
              {admin && (
                <>
                  <label className="field">
                    Registrar observación
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={1000}
                      placeholder="Describe la observación para la bitácora"
                    />
                  </label>
                  <button
                    className="button secondary mt-4"
                    disabled={!!busy}
                    onClick={() => action('note')}
                  >
                    Registrar movimiento
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </section>
      {tab !== 'historial' && (
        <section className="panel">
          <div className="panel-body">
            {admin && active && (
              <label className="field mb-5">
                {isNew ? '' : 'Motivo del cambio'}
                {!isNew && (
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={1000}
                    placeholder="Ej. Reasignación del equipo a un nuevo cuentadante"
                  />
                )}
              </label>
            )}
            <div className="actions">
              {admin && active && (
                <button className="button" disabled={!!busy} onClick={() => action('save')}>
                  {busy === 'save' ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <Save size={17} />
                  )}{' '}
                  {isNew ? 'Crear equipo' : 'Guardar cambios'}
                </button>
              )}
              {!isNew && (
                <button
                  className={`button ${admin ? 'secondary' : ''}`}
                  disabled={!!busy}
                  onClick={() => action('excel')}
                >
                  {busy === 'excel' ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <Download size={17} />
                  )}
                  Generar y descargar Excel
                </button>
              )}
              {admin && active && !isNew && (
                <button
                  className="button danger ml-auto"
                  disabled={!!busy}
                  onClick={() => action('delete')}
                >
                  Dar de baja
                </button>
              )}
            </div>
            {!isNew && (
              <p className="muted text-xs mt-4 flex items-start gap-2">
                <FileSpreadsheet size={17} />
                Formato GTI-F-132. La fecha y el autor se registran automáticamente. Las firmas
                quedan disponibles para su diligenciamiento.
              </p>
            )}
            {!admin && (
              <p className="muted text-sm mt-3">
                Los campos que completes se utilizarán solo en esta descarga; el inventario no se
                modificará.
              </p>
            )}
          </div>
        </section>
      )}
    </>
  );
}
