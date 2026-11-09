'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download } from 'lucide-react';

export function PdfDownload({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  return (
    <form
      className="w-full"
      onSubmit={async (event) => {
        event.preventDefault();
        const nombre = String(new FormData(event.currentTarget).get('nombre') || '').trim();
        setBusy(true);
        setError('');
        try {
          const response = await fetch(`/api/equipos/${id}/pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre }),
          });
          if (!response.ok)
            throw new Error((await response.json()).error || 'No fue posible generar el PDF.');
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download =
            response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ||
            'HOJA_DE_VIDA.pdf';
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : 'No fue posible descargar.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="search-row mt-4">
        <label className="field flex-1">
          Nombre de quien descarga
          <input
            name="nombre"
            required
            minLength={3}
            maxLength={120}
            autoComplete="name"
            placeholder="Escribe tu nombre completo"
            disabled={busy}
          />
        </label>
        <button type="submit" className="button" disabled={busy}>
          <Download size={18} />
          {busy ? 'Generando PDF…' : 'Descargar hoja de vida en PDF'}
        </button>
      </div>
      <p className="muted text-sm mt-3">
        Tu nombre y la fecha quedarán visibles en el historial público como nombre declarado, sin
        verificación de identidad.
      </p>
      {error && (
        <p role="alert" className="error mt-3">
          {error}
        </p>
      )}
    </form>
  );
}
