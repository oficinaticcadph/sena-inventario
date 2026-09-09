import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Monitor, ArrowLeft } from 'lucide-react';
import { db } from '@/lib/db';
import { currentUser } from '@/lib/access';
import { equipmentData } from '@/lib/equipment';
import { maskObject } from '@/lib/fields';
import { Shell } from '@/components/shell';
import { EquipmentEditor, type EditorData } from '@/components/equipment-editor';
import { PublicEquipment } from '@/components/public-equipment';
export default async function EquipoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const { id } = await params;
  if (!user) return <PublicEquipment id={id} />;
  const equipo = await db.equipo.findUnique({
    where: { id },
    include: {
      cuentadante: true,
      movimientos: {
        include: { autor: { select: { nombre: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!equipo) notFound();
  const history = equipo.movimientos.map((m) => ({
    id: m.id,
    tipo: m.tipo,
    detalle: m.detalle,
    autor: m.autor.nombre,
    fecha: m.createdAt.toISOString(),
    cambios: m.cambios,
  }));
  return (
    <Shell user={user}>
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
            <div className="eyebrow mb-2">Hoja de vida del equipo</div>
            <h1>Placa {equipo.placaSena}</h1>
            <div className="record-meta">
              {equipo.componente} · {equipo.marca} {equipo.modelo}
            </div>
          </div>
        </div>
        <span className={`badge ${equipo.activo ? '' : 'gray'}`}>
          {equipo.activo ? 'Equipo activo' : 'Dado de baja'}
        </span>
      </div>
      <EquipmentEditor
        key={`${id}-${equipo.version}`}
        id={id}
        version={equipo.version}
        initial={equipmentData(equipo, user.rol) as EditorData}
        role={user.rol}
        active={equipo.activo}
        context={
          (user.rol === 'consulta' ? maskObject(equipo.contexto) : equipo.contexto) as Record<
            string,
            string
          >
        }
        history={user.rol === 'consulta' ? maskObject(history) : history}
      />
    </Shell>
  );
}
