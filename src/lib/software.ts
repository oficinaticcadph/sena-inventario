import type { Ficha } from './fields';

// Valores base solicitados por el usuario, tomados de E26:L33 del formato original.
// Son editables por equipo y no representan una inspección del software instalado.
export const softwareDefaults: Ficha = {
  so: 'Windows 11',
  soVersion: '24H2',
  soLicencia: 'SI',
  office: 'Office 365',
  officeVersion: '2603',
  officeLicencia: 'SI',
  antivirus: 'Windows Defender',
  antivirusVersion: '1000.26100.0.1',
  antivirusLicencia: 'SI',
  adobe: 'Adobe Acrobat',
  adobeVersion: '2026',
  adobeLicencia: 'SI',
  laps: 'MICROSOFT INTUNE',
  lapsVersion: 'Gratuita',
  lapsLicencia: '',
  zip: 'Gratuita',
  zipVersion: 'Gratuita',
  zipLicencia: '',
  vpn: 'NO APLICA',
  vpnVersion: '',
  vpnLicencia: '',
  jafm: 'NO APLICA',
  jafmVersion: '',
  jafmLicencia: '',
};
export const softwareRows = [
  ['so', 'Edición S.O.'],
  ['office', 'Edición Office'],
  ['antivirus', 'Antivirus'],
  ['adobe', 'Edición Adobe Pro'],
  ['laps', 'LAPS'],
  ['zip', '7-Zip'],
  ['vpn', 'VPN'],
  ['jafm', 'JAFM PRO'],
] as const;
export function withSoftwareDefaults(ficha: Ficha = {}): Ficha {
  // Una cadena vacía guardada es una decisión explícita y no se sustituye.
  return { ...softwareDefaults, ...ficha };
}
