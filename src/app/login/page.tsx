import { LoginForm } from '@/components/login-form';
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
          <LoginForm />
        </div>
      </section>
    </div>
  );
}
