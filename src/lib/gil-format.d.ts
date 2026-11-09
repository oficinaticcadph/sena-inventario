import type {SolicitudBienData} from './bienes-validation';
export function originalPdfBytes(data:SolicitudBienData):Promise<Uint8Array>;
export function originalExcelBytes(data:SolicitudBienData):Promise<Uint8Array>;
