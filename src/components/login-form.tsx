'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { ArrowRight, LoaderCircle, LockKeyhole } from 'lucide-react';
export function LoginForm() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        const data = new FormData(e.currentTarget);
        try {
          const result = await signIn('credentials', {
            usuario: data.get('usuario'),
            password: data.get('password'),
            redirect: false,
          });
          if (result?.error)
            setError(
              'No fue posible ingresar. Revisa tus credenciales o espera 15 minutos si has realizado varios intentos.',
            );
          else window.location.assign('/');
        } catch {
          setError('No hay conexión con el servicio. Inténtalo de nuevo.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="eyebrow">Acceso institucional</div>
      <h2>Bienvenido de nuevo</h2>
      <p className="muted">
        Ingresa para gestionar los equipos, editar el software y generar sus hojas de vida.
      </p>
      {error && (
        <div className="error mt-5" role="alert">
          {error}
        </div>
      )}
      <label className="field">
        Usuario
        <input
          name="usuario"
          required
          autoComplete="username"
          placeholder="Tu usuario institucional"
          maxLength={80}
        />
      </label>
      <label className="field">
        Contraseña
        <input
          name="password"
          required
          type="password"
          autoComplete="current-password"
          placeholder="Ingresa tu contraseña"
          maxLength={72}
        />
      </label>
      <button className="button" disabled={busy}>
        {busy ? (
          <LoaderCircle size={17} className="spin" />
        ) : (
          <>
            Ingresar
            <ArrowRight size={17} />
          </>
        )}
      </button>
      <div className="login-foot flex gap-2">
        <LockKeyhole size={16} />
        <span>
          La edición y la descarga en Excel requieren una cuenta autorizada. La consulta y la
          descarga en PDF son públicas.
        </span>
      </div>
    </form>
  );
}
