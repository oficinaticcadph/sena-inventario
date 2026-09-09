import type { Equipo, Cuentadante } from '@prisma/client';
import { coreFields, maskPII, type Ficha } from './fields';
import { withSoftwareDefaults } from './software';
export function equipmentData(
  e: Equipo & { cuentadante: Cuentadante | null },
  role: 'admin' | 'consulta',
) {
  const data: Record<string, string> = {
    placaSena: e.placaSena,
    nombreUsuario: e.cuentadante?.nombre || '',
    contacto:
      role === 'admin'
        ? e.cuentadante?.contacto || ''
        : e.cuentadante?.contacto
          ? '••••' + e.cuentadante.contacto.slice(-2)
          : '',
  };
  for (const key of Object.keys(coreFields) as (keyof typeof coreFields)[]) data[key] = e[key];
  if (role === 'consulta') data.nombreUsuario = maskPII(data.nombreUsuario);
  return { ...data, grupo: e.grupo, ficha: withSoftwareDefaults(e.ficha as Ficha) };
}
