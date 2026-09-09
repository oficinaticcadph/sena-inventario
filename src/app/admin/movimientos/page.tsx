import Link from 'next/link';
import { Prisma, TipoMovimiento } from '@prisma/client';
import { pageUser } from '@/lib/access';
import { db } from '@/lib/db';
import { Shell } from '@/components/shell';
export default async function Movimientos({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await pageUser(true);
  const p = await searchParams;
  const page = Math.max(1, Math.floor(Number(p.p) || 1));
  const where: Prisma.MovimientoWhereInput = {
    ...(p.q ? { equipo: { placaSena: { contains: p.q.slice(0, 80), mode: 'insensitive' } } } : {}),
    ...(p.tipo && Object.values(TipoMovimiento).includes(p.tipo as TipoMovimiento)
      ? { tipo: p.tipo as TipoMovimiento }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.movimiento.findMany({
      where,
      include: { equipo: { select: { placaSena: true } }, autor: { select: { nombre: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
      skip: (page - 1) * 30,
    }),
    db.movimiento.count({ where }),
  ]);
  const url = (n: number) =>
    `/admin/movimientos?${new URLSearchParams({ q: p.q || '', tipo: p.tipo || '', p: String(n) })}`;
  return (
    <Shell user={user}>
      <div className="page-heading">
        <div>
          <h1>Bitácora de cambios</h1>
          <p>Historial de acciones realizadas sobre los equipos.</p>
        </div>
        <span className="badge gray">{total} registros</span>
      </div>
      <section className="panel">
        <form className="panel-body search-row">
          <label className="field flex-1">
            Placa SENA
            <input name="q" defaultValue={p.q} placeholder="Buscar placa" />
          </label>
          <label className="field filter">
            Tipo de movimiento
            <select name="tipo" defaultValue={p.tipo}>
              <option value="">Todos</option>
              {Object.values(TipoMovimiento).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <button className="button">Filtrar</button>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>FECHA</th>
                <th>PLACA</th>
                <th>MOVIMIENTO</th>
                <th>AUTOR</th>
                <th>DETALLE</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td>{m.createdAt.toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</td>
                  <td>
                    <Link className="plate" href={`/equipos/${m.equipoId}`}>
                      {m.equipo.placaSena}
                    </Link>
                  </td>
                  <td>
                    <span className="badge gray">{m.tipo}</span>
                  </td>
                  <td>{m.autor.nombre}</td>
                  <td className="min-w-64 max-w-xl whitespace-normal">{m.detalle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <div className="empty">No hay movimientos para los filtros seleccionados.</div>
        )}
        <div className="table-footer">
          <span>
            {total} registros · Página {page}
          </span>
          <div className="pagination">
            {page > 1 && <Link href={url(page - 1)}>Anterior</Link>}
            {page * 30 < total && <Link href={url(page + 1)}>Siguiente</Link>}
          </div>
        </div>
      </section>
    </Shell>
  );
}
