import { db } from '@/lib/db';
import { apiError, HttpError, checkOrigin, currentUser, body } from '@/lib/access';
import { generatePublicPdf, publicPdfSelect } from '@/lib/public-pdf';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(req);
    const user = await currentUser();
    const input = z
      .object({
        nombre: z
          .string()
          .trim()
          .max(120)
          .refine((value) => !value || value.length >= 3)
          .optional(),
      })
      .strict()
      .parse(await body(req));
    const { id } = await params;
    const equipo = await db.equipo.findUnique({
      where: { id },
      select: { ...publicPdfSelect, version: true },
    });
    if (!equipo) throw new HttpError(404, 'Equipo no encontrado.');
    const bytes = await generatePublicPdf(equipo);
    await db.$transaction(
      async (tx) => {
        const current = await tx.equipo.findUnique({ where: { id }, select: { version: true } });
        if (current?.version !== equipo.version)
          throw new HttpError(409, 'El equipo cambió. Recarga la ficha antes de descargar.');
        await tx.movimiento.create({
          data: {
            equipoId: id,
            tipo: 'generacion',
            autorId: user?.id ?? null,
            solicitante: user ? null : input.nombre || null,
            formato: 'PDF',
            detalle: 'Hoja de vida PDF generada para descarga.',
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    const filename = `HOJA_DE_VIDA_${equipo.placaSena.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
