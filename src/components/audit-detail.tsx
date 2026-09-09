import { coreFields, manualFields } from '@/lib/fields';
const labels: Record<string, string> = {
  ...coreFields,
  ...manualFields,
  placaSena: 'Placa SENA',
  nombreUsuario: 'Cuentadante',
  contacto: 'Contacto',
  grupo: 'Grupo',
};
function flat(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries({ ...record, ...((record.ficha as object) || {}) }).filter(
      ([key, v]) => key !== 'ficha' && typeof v === 'string',
    ),
  ) as Record<string, string>;
}
export function AuditDetail({ value }: { value: unknown }) {
  const detail = value as {
    antes?: unknown;
    despues?: unknown;
    camposReporte?: unknown;
    version?: number;
  };
  const before = flat(detail.antes),
    after = flat(detail.despues || detail.camposReporte);
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (k) => before[k] !== after[k],
  );
  return (
    <>
      {detail.version && (
        <p className="muted text-sm">Versión del equipo al generar el reporte: {detail.version}</p>
      )}
      {keys.length ? (
        <div className="table-wrap mt-3">
          <table>
            <thead>
              <tr>
                <th>Campo</th>
                {!!detail.antes && <th>Antes</th>}
                <th>{detail.antes ? 'Después' : 'Valor del reporte'}</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key}>
                  <td>{labels[key] || key}</td>
                  {!!detail.antes && (
                    <td className="whitespace-normal">{before[key] || 'Sin información'}</td>
                  )}
                  <td className="whitespace-normal">{after[key] || 'Sin información'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted text-sm">Sin cambios adicionales en los campos.</p>
      )}
    </>
  );
}
