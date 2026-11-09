import { z } from 'zod';
const text = (max: number) => z.string().trim().max(max);
const needed = (max: number, label: string) => text(max).min(1, `Completa ${label}.`);
const qty = z
  .string()
  .trim()
  .max(32)
  .refine(
    (v) => v !== '' && Number.isFinite(Number(v)) && Number(v) > 0,
    'La cantidad solicitada debe ser mayor que cero.',
  );
export const solicitudBienSchema = z
  .object({
    movement: z.enum(['SALIDA', 'INGRESO']),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((v) => {
        const d = new Date(v + 'T00:00:00Z');
        return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === v;
      }, 'Fecha de solicitud inválida.'),
    area: text(160),
    head: needed(160, 'el nombre del jefe o coordinador'),
    holderType: z.enum(['MÚLTIPLE', 'UNIPERSONAL']),
    holder: needed(180, 'el nombre del cuentadante'),
    identification: needed(60, 'la identificación'),
    destination: z.enum(['Área administrativa', 'Formación']),
    group: text(100),
    classification: z.enum(['Pública', 'Pública Clasificada', 'Pública Reservada']),
    authorizer: text(160),
    position: text(160),
    signature: text(160),
    members: z
      .array(
        z
          .object({
            name: needed(160, 'el nombre de cada integrante'),
            identification: needed(60, 'la identificación de cada integrante'),
          })
          .strict(),
      )
      .max(100),
    items: z
      .array(
        z
          .object({
            code: text(100),
            description: needed(500, 'la descripción del bien'),
            unit: text(100),
            requested: qty,
            delivered: text(32).refine(
              (v) => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0),
              'La cantidad entregada debe ser igual o mayor que cero.',
            ),
            observations: text(500),
          })
          .strict(),
      )
      .min(1, 'Agrega al menos un ítem.')
      .max(200),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.holderType === 'MÚLTIPLE' && !data.members.length)
      ctx.addIssue({
        code: 'custom',
        path: ['members'],
        message: 'Agrega al menos un integrante del cuentadante múltiple.',
      });
  })
  .transform((data) => ({
    ...data,
    group: data.destination === 'Formación' ? data.group : '',
    members: data.holderType === 'MÚLTIPLE' ? data.members : [],
  }));
export type SolicitudBienData = z.infer<typeof solicitudBienSchema>;
export const normalizarBienes = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export function indiceBienes(data: SolicitudBienData) {
  return {
    fechaSolicitud: new Date(data.date + 'T00:00:00Z'),
    movimiento: data.movement,
    destino: data.destination,
    area: data.area,
    cuentadante: data.holder,
    identificacion: data.identification,
    busqueda: normalizarBienes(
      [
        data.holder,
        data.identification,
        ...data.items.flatMap((i) => [i.code, i.description]),
      ].join(' '),
    ),
  };
}
