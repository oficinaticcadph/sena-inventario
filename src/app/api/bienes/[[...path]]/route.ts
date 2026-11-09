import { handleBienes } from '@/lib/bienes-service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
type Context = { params: Promise<{ path?: string[] }> };
async function handler(req: Request, context: Context) {
  return handleBienes(req, (await context.params).path || []);
}
export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE };
