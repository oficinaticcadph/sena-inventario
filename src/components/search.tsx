'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, ArrowRight } from 'lucide-react';
export function SearchForm({
  initial = '',
  group = '',
  status = 'activos',
}: {
  initial?: string;
  group?: string;
  status?: string;
}) {
  const [q, setQ] = useState(initial),
    [suggestions, setSuggestions] = useState<
      { id: string; placaSena: string; componente: string; marca: string }[]
    >([]),
    [focus, setFocus] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    const t = setTimeout(async () => {
      if (q.trim().length < 1) {
        setSuggestions([]);
        return;
      }
      try {
        const r = await fetch(`/api/equipos?q=${encodeURIComponent(q)}`, { signal: abort.signal });
        setSuggestions(r.ok ? await r.json() : []);
      } catch {}
    }, 220);
    return () => {
      clearTimeout(t);
      abort.abort();
    };
  }, [q]);
  return (
    <form action="/" className="search-row">
      <div className="search-box">
        <label htmlFor="plate-search" className="sr-only">
          Buscar por Placa SENA
        </label>
        <Search size={18} className="search-icon" />
        <input
          className="input"
          id="plate-search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(false), 180)}
          placeholder="Buscar por Placa SENA…"
          autoComplete="off"
          maxLength={80}
        />
        {focus && suggestions.length > 0 && (
          <div className="suggestions" aria-label="Sugerencias de equipos">
            {suggestions.map((s) => (
              <Link key={s.id} href={`/equipos/${s.id}`}>
                <strong>{s.placaSena}</strong>
                <span>
                  {s.componente} · {s.marca}
                </span>
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
        )}
      </div>
      <label className="field filter">
        <span className="sr-only">Grupo de inventario</span>
        <select name="grupo" defaultValue={group}>
          <option value="">Todos los grupos</option>
          <option>Funcionarios</option>
          <option>FORMACION</option>
          <option>ELECTRONICOS</option>
          <option>Manual</option>
        </select>
      </label>
      <label className="field filter">
        <span className="sr-only">Estado del registro</span>
        <select name="estado" defaultValue={status}>
          <option value="activos">Activos</option>
          <option value="bajas">Dados de baja</option>
          <option value="todos">Todos los estados</option>
        </select>
      </label>
      <button className="button" type="submit">
        <Search size={16} />
        Buscar
      </button>
    </form>
  );
}
