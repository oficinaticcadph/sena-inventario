import { z } from 'zod';
import { coreFields, manualFields, normalizePlate } from './fields';
const text = z.string().trim().max(500);
export const fichaSchema = z
  .object(Object.fromEntries(Object.keys(manualFields).map((k) => [k, text.optional()])))
  .strict();
const coreShape = Object.fromEntries(
  Object.keys(coreFields).map((k) => [k, text.default('')]),
) as Record<keyof typeof coreFields, z.ZodDefault<z.ZodString>>;
export const equipoSchema = z
  .object({
    placaSena: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .transform(normalizePlate)
      .refine((v) => !!v, 'Placa obligatoria'),
    ...coreShape,
    nombreUsuario: text.default(''),
    contacto: text.default(''),
    ficha: fichaSchema.default({}),
    grupo: z.enum(['Funcionarios', 'FORMACION', 'ELECTRONICOS', 'Manual']).default('Manual'),
  })
  .strict();
export const editSchema = z
  .object({
    version: z.number().int().positive(),
    datos: equipoSchema,
    detalle: z.string().trim().min(4).max(1000),
  })
  .strict();
export const passwordSchema = z
  .string()
  .min(12)
  .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Máximo 72 bytes');
export const usuarioSchema = z
  .object({
    usuario: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9._-]{3,80}$/),
    nombre: z.string().trim().min(2).max(120),
    password: passwordSchema,
    rol: z.enum(['admin', 'consulta']),
  })
  .strict();
