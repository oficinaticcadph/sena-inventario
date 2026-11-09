import { currentUser } from '@/lib/access';
import { Shell } from '@/components/shell';
import { BienesFrame } from '@/components/bienes-frame';
export const dynamic = 'force-dynamic';
export default async function Bienes() {
  return (
    <Shell user={await currentUser()}>
      <BienesFrame />
    </Shell>
  );
}
