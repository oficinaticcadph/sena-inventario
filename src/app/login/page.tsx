import { LoginForm } from '@/components/login-form';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
export default function LoginPage() {
  return (
    <div className="login">
      <section className="login-brand">
        <img src="/sena-negativo.png" alt="SENA" />
        <div>
          <div className="line" />
          <h1>
            La historia de cada equipo,
            <br />
            en un solo lugar.
          </h1>
          <p>
            Consulta el inventario, registra sus cambios y genera la hoja de vida oficial de tus
            equipos.
          </p>
        </div>
        <small>
          Servicio Nacional de Aprendizaje
          <br />
          Gestión de Tecnologías de la Información
        </small>
      </section>
      <section className="login-form">
        <div className="login-card">
          <Link href="/" className="button secondary mb-6">
            <ArrowLeft size={17} aria-hidden="true" />
            Volver a consulta pública
          </Link>
          <LoginForm />
        </div>
      </section>
    </div>
  );
}
