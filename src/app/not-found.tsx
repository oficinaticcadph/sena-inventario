import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="max-w-xl mx-auto p-10">
      <h1>Equipo o página no encontrado</h1>
      <p className="my-5">Revisa la dirección o busca nuevamente la Placa SENA.</p>
      <Link className="button" href="/">
        Ir al inventario
      </Link>
    </main>
  );
}
