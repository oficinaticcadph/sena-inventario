export const coreFields = {
  componente: 'Componente',
  marca: 'Marca',
  modelo: 'Modelo',
  serial: 'Serial',
  sede: 'Sede',
  disco: 'Disco duro',
  procesador: 'Procesador',
  ram: 'Memoria RAM',
  dominio: 'Nombre del dominio',
  hostname: 'Hostname',
} as const;
export const manualFields = {
  jefe: 'Jefe inmediato',
  tipoParte: 'Tipo de parte',
  numeroParte: 'Número de parte',
  especificacionParte: 'Especificación de parte',
  enrolado: 'Equipo enrolado a dominio',
  observacion: 'Observación',
  incidente: 'Número de incidente',
  requerimiento: 'Número de requerimiento',
  solicitud: 'Descripción de la solicitud',
  so: 'Sistema operativo',
  soVersion: 'Versión S.O.',
  soLicencia: 'Licencia S.O.',
  office: 'Office',
  officeVersion: 'Versión Office',
  officeLicencia: 'Licencia Office',
  antivirus: 'Antivirus',
  antivirusVersion: 'Versión antivirus',
  antivirusLicencia: 'Licencia antivirus',
  adobe: 'Adobe Pro',
  adobeVersion: 'Versión Adobe',
  adobeLicencia: 'Licencia Adobe',
  laps: 'LAPS',
  lapsVersion: 'Versión LAPS',
  lapsLicencia: 'Licencia LAPS',
  zip: '7-Zip',
  zipVersion: 'Versión 7-Zip',
  zipLicencia: 'Licencia 7-Zip',
  vpn: 'VPN',
  vpnVersion: 'Versión VPN',
  vpnLicencia: 'Licencia VPN',
  jafm: 'JAFM PRO',
  jafmVersion: 'Versión JAFM',
  jafmLicencia: 'Licencia JAFM',
  borrado: 'Borrado seguro',
  accion: 'Acción / diagnóstico',
  causas: 'Causas del daño',
  recomendacion: 'Recomendación',
  repuesto: 'Repuesto',
  garantia: 'Garantía',
  siniestro: 'Siniestro',
  concepto: 'Concepto técnico',
  asignacion: 'Asignación',
  reasignacion: 'Reasignación',
  devolucion: 'Devolución',
} as const;
export type Ficha = Record<string, string>;
export const mappedKeys = new Set([
  ...Object.keys(coreFields).filter((k) => k !== 'hostname'),
  'nombreUsuario',
]);
export const isMissing = (value: unknown) =>
  !String(value ?? '').trim() ||
  /^(n\s*\/\s*a|no aplica|null|undefined)$/i.test(String(value).trim());
export const clean = (value: unknown) => (isMissing(value) ? '' : String(value).trim());
export const normalizePlate = (value: unknown) => clean(value).toUpperCase();
export function maskPII(value: string) {
  return value.replace(/\d{5,}/g, (m) => '••••' + m.slice(-2));
}
export function maskObject<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, v) => (typeof v === 'string' ? maskPII(v) : v)));
}
export function bogotaDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
