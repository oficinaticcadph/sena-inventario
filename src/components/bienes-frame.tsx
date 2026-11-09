'use client';
import { useEffect, useRef, useState } from 'react';
export function BienesFrame() {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(1500);
  const viewport = () =>
    ref.current?.contentWindow?.postMessage(
      { kind: 'bienes-viewport', height: window.innerHeight },
      location.origin,
    );
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== ref.current?.contentWindow) return;
      if (event.data?.kind === 'bienes-height' && Number.isFinite(event.data.height))
        setHeight(Math.max(600, Math.min(60000, event.data.height)));
      if (event.data?.kind === 'bienes-top')
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    addEventListener('message', receive);
    addEventListener('resize', viewport);
    return () => {
      removeEventListener('message', receive);
      removeEventListener('resize', viewport);
    };
  }, []);
  return (
    <iframe
      ref={ref}
      onLoad={viewport}
      src="/bienes/formulario.html"
      title="Control de Entrada y Salida de Bienes"
      style={{ width: '100%', height, border: 0, display: 'block' }}
    />
  );
}
