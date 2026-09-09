import Link from 'next/link';
import { Monitor, History, Users, ArrowRight, Database } from 'lucide-react';
import { pageUser } from '@/lib/access';
import { db } from '@/lib/db';
import { Shell } from '@/components/shell';
export default async function Admin() {
  const user = await pageUser(true);
  const [admins, movements, imports, incidencias] = await Promise.all([
    db.administrador.count({ where: { activo: true } }),
    db.movimiento.count(),
    db.importacion.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    db.incidenciaImportacion.count(),
  ]);
  return (
    <Shell user={user}>
      <div className="page-heading">
        <div>
          <div className="eyebrow mb-2">Administración</div>
          <h1>Gestión del inventario</h1>
          <p>Administra los equipos, sus movimientos y el acceso de tu equipo de trabajo.</p>
        </div>
      </div>
      <div className="flow-grid mb-7">
        {[
          {
            title: 'Equipos',
            text: 'Agrega equipos y actualiza sus datos desde la ficha de inventario.',
            href: '/admin/nuevo',
            label: 'Agregar equipo',
            icon: Monitor,
          },
          {
            title: 'Bitácora de cambios',
            text: `${movements} movimientos registrados con fecha y autoría.`,
            href: '/admin/movimientos',
            label: 'Consultar bitácora',
            icon: History,
          },
          {
            title: 'Usuarios y accesos',
            text: `${admins} cuentas activas. Administra los roles y permisos de acceso.`,
            href: '/admin/usuarios',
            label: 'Gestionar usuarios',
            icon: Users,
          },
        ].map(({ title, text, href, label, icon: Icon }) => (
          <section className="flow-card" key={title}>
            <Icon size={25} className="text-forest" />
            <h2>{title}</h2>
            <p>{text}</p>
            <Link href={href}>
              {label}
              <ArrowRight size={16} className="ml-2" />
            </Link>
          </section>
        ))}
      </div>
      {incidencias > 0 && (
        <div className="info-strip">
          <div>
            <strong>{incidencias} filas del inventario tienen placas repetidas.</strong>
            <p className="mt-2">
              Su información está conservada por separado para evitar asignar una misma placa a
              equipos diferentes.
            </p>
            <Link className="text-forest underline inline-block mt-3" href="/admin/incidencias">
              Revisar placas e información de origen
            </Link>
          </div>
        </div>
      )}
      <section className="panel">
        <div className="panel-head">
          <h2 className="flex gap-2 items-center">
            <Database size={19} />
            Carga inicial del inventario
          </h2>
        </div>
        <div className="panel-body">
          {imports.length ? (
            imports.map((i) => {
              const summary = i.resumen as {
                insertados?: number;
                porHoja?: Record<string, number>;
              };
              return (
                <div key={i.hash}>
                  <p className="text-sm font-medium">
                    {i.archivo} ·{' '}
                    {i.createdAt.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}
                  </p>
                  <p className="muted text-sm mt-2">
                    {summary.insertados || 0} equipos incorporados al inventario.
                  </p>
                  <dl className="context-grid mt-6">
                    {Object.entries(summary.porHoja || {}).map(([grupo, total]) => (
                      <div key={grupo}>
                        <dt>{grupo}</dt>
                        <dd>{total} filas de origen</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })
          ) : (
            <p className="muted">Aún no se ha realizado la carga inicial.</p>
          )}
        </div>
      </section>
    </Shell>
  );
}
