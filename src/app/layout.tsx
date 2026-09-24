import type { Metadata } from 'next';
import '@fontsource/work-sans/400.css';
import '@fontsource/work-sans/500.css';
import '@fontsource/work-sans/600.css';
import '@fontsource/work-sans/700.css';
import './globals.css';
export const metadata: Metadata = {
  title: 'Hoja de Vida Equipos SENA · CADPH',
  description: 'Inventario y hojas de vida de equipos del Centro Agroempresarial y Desarrollo Pecuario del Huila (CADPH) — SENA.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
