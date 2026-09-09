'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
export function UserManager({
  users,
  currentId,
}: {
  users: { id: string; usuario: string; nombre: string; rol: string; activo: boolean }[];
  currentId: string;
}) {
  const [error, setError] = useState(''),
    [success, setSuccess] = useState(''),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  async function save(data: unknown, method: string) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const r = await fetch('/api/usuarios', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      setSuccess('La cuenta se actualizó correctamente.');
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="success">
          {success}
        </div>
      )}
      <section className="panel">
        <div className="panel-head">
          <h2>Cuentas del sistema</h2>
          <span className="badge gray">{users.length} usuarios</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>USUARIO</th>
                <th>NOMBRE</th>
                <th>ROL</th>
                <th>ESTADO</th>
                <th>ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="plate">{u.usuario}</td>
                  <td>{u.nombre}</td>
                  <td>{u.rol === 'admin' ? 'Administrador' : 'Consulta'}</td>
                  <td>
                    <span className={`badge ${u.activo ? '' : 'gray'}`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    {u.id !== currentId ? (
                      <button
                        disabled={busy}
                        className="button secondary"
                        onClick={() => {
                          if (
                            u.activo &&
                            !confirm(`¿Desactivar a ${u.usuario}? Se cerrarán sus sesiones.`)
                          )
                            return;
                          save({ id: u.id, activo: !u.activo }, 'PATCH');
                        }}
                      >
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    ) : (
                      <small>Tu cuenta</small>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2>Crear usuario</h2>
        </div>
        <form
          className="panel-body"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            if (await save(Object.fromEntries(new FormData(form)), 'POST')) form.reset();
          }}
        >
          <div className="forms-grid">
            <label className="field">
              Usuario
              <input
                name="usuario"
                required
                pattern="[a-z0-9._\-]{3,80}"
                minLength={3}
                maxLength={80}
                autoComplete="off"
                placeholder="nombre.apellido"
              />
            </label>
            <label className="field">
              Nombre completo
              <input name="nombre" required minLength={2} maxLength={120} />
            </label>
            <label className="field">
              Rol
              <select name="rol">
                <option value="consulta">Consulta</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
            <label className="field">
              Contraseña inicial
              <input
                name="password"
                type="password"
                required
                minLength={12}
                maxLength={72}
                autoComplete="new-password"
              />
              <small>Mínimo 12 caracteres. Máximo 72 bytes.</small>
            </label>
          </div>
          <button className="button mt-6" disabled={busy}>
            <UserPlus size={17} />
            Crear usuario
          </button>
        </form>
      </section>
    </>
  );
}
