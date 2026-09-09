import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Monitor, History, Download } from 'lucide-react';
import { db } from '@/lib/db';
import { Shell } from './shell';

const movementLabels: Record<string, string> = {
  alta: 'Equipo registrado en el inventario',
  asignacion: 'Equipo asignado',
  reasignacion: 'Cambio de asignación del equipo',
  devolucion: 'Devolución del equipo',
  edicion: 'Actualización u observación registrada',
  baja: 'Equipo dado de baja',
  generacion: 'Hoja de vida generada',
};

export async function PublicEquipment({ id }: { id: string }) {
  // Lista explícita: no consultar responsables, contacto, autoría, notas ni diferencias privadas.
  const equipo = await db.equipo.findUnique({
    where: { id },
    select: {
      placaSena: true,
      componente: true,
      marca: true,
      modelo: true,
      serial: true,
      sede: true,
      disco: true,
      procesador: true,
      ram: true,
      grupo: true,
      activo: true,
      movimientos: {
        select: { id: true, tipo: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!equipo) notFound();
  const fields = {
    'Placa SENA': equipo.placaSena,
    Componente: equipo.componente,
    Marca: equipo.marca,
    Modelo: equipo.modelo,
    Serial: equipo.serial,
    Sede: equipo.sede,
    'Disco duro': equipo.disco,
    Procesador: equipo.procesador,
    'Memoria RAM': equipo.ram,
    Grupo: equipo.grupo,
  };
  return (
    <Shell user={null}>
      <Link href="/" className="text-sm text-forest flex gap-2 items-center mb-6">
        <ArrowLeft size={16} />
        Volver al inventario
      </Link>
      <div className="page-heading">
        <div className="record-heading">
          <div className="device-icon">
            <Monitor size={29} />
          </div>
          <div>
            <div className="eyebrow mb-2">Consulta del equipo</div>
            <h1>Placa {equipo.placaSena}</h1>
            <p>
              {equipo.componente} · {equipo.marca} {equipo.modelo}
            </p>
          </div>
        </div>
        <span className={`badge ${equipo.activo ? '' : 'gray'}`}>
          {equipo.activo ? 'Equipo activo' : 'Dado de baja'}
        </span>
      </div>
      <section className="panel">
        <div className="panel-body flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2>Hoja de vida en PDF</h2>
            <p className="muted text-sm mt-2">
              Descarga el formato GTI-F-132 con los datos técnicos del equipo.
            </p>
          </div>
          <a href={`/api/equipos/${id}/pdf`} className="button" download>
            <Download size={18} />
            Descargar hoja de vida en PDF
          </a>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2>Detalles del equipo</h2>
        </div>
        <div className="panel-body">
          <dl className="context-grid">
            {Object.entries(fields).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || 'Sin información'}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2 className="flex items-center gap-2">
            <History size={19} />
            Historial de movimientos
          </h2>
          <span className="badge gray">{equipo.movimientos.length} registros</span>
        </div>
        <div className="panel-body">
          {equipo.movimientos.length ? (
            <ol className="timeline">
              {equipo.movimientos.map((m) => (
                <li key={m.id} className="event">
                  <h3>{movementLabels[m.tipo] || 'Movimiento registrado'}</h3>
                  <time className="muted text-sm block mt-2" dateTime={m.createdAt.toISOString()}>
                    {m.createdAt.toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">Este equipo aún no tiene movimientos registrados.</p>
          )}
          <p className="muted text-sm mt-5">
            Los nombres de responsables, los contactos y las notas internas requieren una cuenta
            autorizada.
          </p>
        </div>
      </section>
    </Shell>
  );
}
