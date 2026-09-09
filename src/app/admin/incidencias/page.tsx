import { pageUser } from '@/lib/access';
import { db } from '@/lib/db';
import { Shell } from '@/components/shell';
import type { ImportRow } from '@/lib/import-inventory';
export default async function Incidencias() {
  const user = await pageUser(true);
  const rows = await db.incidenciaImportacion.findMany({
    orderBy: [{ grupo: 'asc' }, { fila: 'asc' }],
  });
  return (
    <Shell user={user}>
      <div className="page-heading">
        <div>
          <h1>Placas por revisar</h1>
          <p>
            Filas del inventario con placas repetidas. Su información original permanece conservada.
          </p>
        </div>
        <span className="badge gray">{rows.length} filas</span>
      </div>
      <div className="info-strip">
        Estas filas no se mezclaron con los equipos de placa única. Verifica físicamente la placa y
        el serial antes de registrar un equipo desde Administración.
      </div>
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>HOJA / FILA</th>
                <th>PLACA ORIGINAL</th>
                <th>COMPONENTE</th>
                <th>MARCA / MODELO</th>
                <th>SERIAL</th>
                <th>CUENTADANTE</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const data = row.datos as unknown as ImportRow;
                return (
                  <tr key={row.id}>
                    <td>
                      {row.grupo} · {row.fila}
                    </td>
                    <td className="plate">{row.placaSena}</td>
                    <td>{data.componente}</td>
                    <td>
                      {data.marca} {data.modelo}
                    </td>
                    <td>{data.serial || 'Sin información'}</td>
                    <td>{data.nombre || 'Sin información'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </Shell>
  );
}
