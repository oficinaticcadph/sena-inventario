import Link from 'next/link';
import {
  Monitor,
  Users,
  GraduationCap,
  HardDrive,
  Plus,
  ArrowUpRight,
  SearchX,
} from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { currentUser } from '@/lib/access';
import { db } from '@/lib/db';
import { maskPII } from '@/lib/fields';
import { Shell } from '@/components/shell';
import { SearchForm } from '@/components/search';
export const dynamic = 'force-dynamic';
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await currentUser();
  const params = await searchParams;
  const q = (params.q || '').trim().slice(0, 80),
    group = params.grupo || '',
    status = params.estado || 'activos';
  const page = Math.max(1, Math.min(10000, Math.floor(Number(params.p) || 1)));
  const where: Prisma.EquipoWhereInput = {
    ...(q ? { placaSena: { contains: q, mode: 'insensitive' } } : {}),
    ...(group ? { grupo: group } : {}),
    ...(status === 'todos' ? {} : { activo: status !== 'bajas' }),
  };
  const [rows, total, counts] = await Promise.all([
    db.equipo.findMany({
      where,
      include: { cuentadante: true },
      orderBy: { placaSena: 'asc' },
      skip: (page - 1) * 12,
      take: 12,
    }),
    db.equipo.count({ where }),
    db.equipo.groupBy({ by: ['grupo'], _count: true, where: { activo: true } }),
  ]);
  const totalActive = counts.reduce((s, c) => s + c._count, 0);
  const count = (g: string) => counts.find((c) => c.grupo === g)?._count || 0;
  const pages = Math.max(1, Math.ceil(total / 12));
  const pageUrl = (p: number) =>
    `/?${new URLSearchParams({ q, grupo: group, estado: status, p: String(p) })}`;
  return (
    <Shell user={user}>
      <div className="page-heading">
        <div>
          <div className="eyebrow mb-2">Inventario institucional</div>
          <h1>Equipos y hojas de vida</h1>
          <p>Consulta tus equipos y mantén al día su información técnica.</p>
        </div>
        {user?.rol === 'admin' && (
          <Link href="/admin/nuevo" className="button">
            <Plus size={17} />
            Agregar equipo
          </Link>
        )}
      </div>
      <div className="stats">
        {[
          {
            label: 'Total de equipos',
            value: totalActive,
            detail: 'Registros activos',
            icon: Monitor,
          },
          {
            label: 'Funcionarios',
            value: count('Funcionarios'),
            detail: 'Inventario administrativo',
            icon: Users,
          },
          {
            label: 'Formación',
            value: count('FORMACION'),
            detail: 'Equipos para la formación',
            icon: GraduationCap,
          },
          {
            label: 'Electrónicos',
            value: count('ELECTRONICOS'),
            detail: 'Inventario electrónico',
            icon: HardDrive,
          },
        ].map(({ label, value, detail, icon: Icon }) => (
          <div className="stat" key={label}>
            <div className="stat-top">
              {label}
              <span className="stat-icon">
                <Icon size={17} />
              </span>
            </div>
            <strong>{value.toLocaleString('es-CO')}</strong>
            <small>{detail}</small>
          </div>
        ))}
      </div>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Buscar equipo</h2>
            <p>Encuentra la ficha y el historial a partir de su Placa SENA.</p>
          </div>
          <span className="badge gray">{total} resultados</span>
        </div>
        <div className="panel-body">
          <SearchForm initial={q} group={group} status={status} />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>PLACA SENA</th>
                <th>EQUIPO</th>
                <th>MARCA / MODELO</th>
                {user && <th>CUENTADANTE</th>}
                <th>GRUPO</th>
                <th>ESTADO</th>
                <th>
                  <span className="sr-only">Ver ficha</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link className="plate" href={`/equipos/${e.id}`}>
                      {e.placaSena}
                    </Link>
                  </td>
                  <td>
                    <div className="equipment-name">
                      <span className="device-icon">
                        <Monitor size={17} />
                      </span>
                      {e.componente || 'Sin especificar'}
                    </div>
                  </td>
                  <td>
                    <div>{e.marca || '—'}</div>
                    <small className="text-xs">{e.modelo || '—'}</small>
                  </td>
                  {user && (
                    <td
                      className="max-w-[220px] truncate"
                      title={
                        user.rol === 'consulta'
                          ? maskPII(e.cuentadante?.nombre || '')
                          : e.cuentadante?.nombre
                      }
                    >
                      {user.rol === 'consulta'
                        ? maskPII(e.cuentadante?.nombre || 'Sin asignar')
                        : e.cuentadante?.nombre || 'Sin asignar'}
                    </td>
                  )}
                  <td>
                    <span className="badge blue">
                      {e.grupo === 'FORMACION'
                        ? 'Formación'
                        : e.grupo === 'ELECTRONICOS'
                          ? 'Electrónicos'
                          : e.grupo}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${e.activo ? '' : 'gray'}`}>
                      {e.activo ? 'Activo' : 'De baja'}
                    </span>
                  </td>
                  <td>
                    <Link
                      href={`/equipos/${e.id}`}
                      title={`Ver equipo ${e.placaSena}`}
                      className="text-forest"
                    >
                      <ArrowUpRight size={18} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <div className="empty">
            <SearchX size={32} />
            <h2>No se encontraron equipos</h2>
            <p>Prueba con otra placa o cambia los filtros de búsqueda.</p>
          </div>
        )}
        <div className="table-footer">
          <span>
            {total
              ? `${(page - 1) * 12 + 1}–${Math.min(page * 12, total)} de ${total} equipos`
              : '0 equipos'}
          </span>
          <div className="pagination">
            {page > 1 && <Link href={pageUrl(page - 1)}>Anterior</Link>}
            <span>
              Página {page} de {pages}
            </span>
            {page < pages && <Link href={pageUrl(page + 1)}>Siguiente</Link>}
          </div>
        </div>
      </section>
      <div className="info-strip">
        <Monitor size={19} />
        <span>
          Selecciona un equipo para consultar su ficha, revisar los movimientos y descargar el
          formato oficial GTI-F-132.
        </span>
      </div>
    </Shell>
  );
}
