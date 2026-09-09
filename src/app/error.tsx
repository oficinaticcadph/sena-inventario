'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="max-w-xl mx-auto p-10">
      <h1>No pudimos cargar la información</h1>
      <p className="my-5">Comprueba que la base de datos esté encendida y vuelve a intentarlo.</p>
      <button className="button" onClick={reset}>
        Volver a intentar
      </button>
    </main>
  );
}
