import { db } from '@/lib/db';
import { apiError, HttpError } from '@/lib/access';
import { generatePublicPdf, publicPdfSelect } from '@/lib/public-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const equipo = await db.equipo.findUnique({ where: { id }, select: publicPdfSelect });
    if (!equipo) throw new HttpError(404, 'Equipo no encontrado.');
    const bytes = await generatePublicPdf(equipo);
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
