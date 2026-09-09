import { pageUser } from '@/lib/access';
import { Shell } from '@/components/shell';
import { EquipmentEditor } from '@/components/equipment-editor';
export default async function Nuevo() {
  const user = await pageUser(true);
  return (
    <Shell user={user}>
      <div className="page-heading">
        <div>
          <div className="eyebrow mb-2">Inventario institucional</div>
          <h1>Agregar equipo</h1>
          <p>Registra una placa única y completa la información disponible.</p>
        </div>
      </div>
      <EquipmentEditor
        initial={{ placaSena: '', nombreUsuario: '', contacto: '', grupo: 'Manual', ficha: {} }}
        role="admin"
      />
    </Shell>
  );
}
