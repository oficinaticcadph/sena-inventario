import { pageUser } from '@/lib/access';
import { db } from '@/lib/db';
import { Shell } from '@/components/shell';
import { UserManager } from '@/components/user-manager';
export default async function Usuarios() {
  const user = await pageUser(true);
  const users = await db.administrador.findMany({
    select: { id: true, usuario: true, nombre: true, rol: true, activo: true },
    orderBy: { createdAt: 'asc' },
  });
  return (
    <Shell user={user}>
      <div className="page-heading">
        <div>
          <h1>Usuarios y accesos</h1>
          <p>Define quién puede consultar el inventario y quién puede administrarlo.</p>
        </div>
      </div>
      <UserManager users={users} currentId={user.id} />
    </Shell>
  );
}
