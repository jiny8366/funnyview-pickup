import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { customerPrescriptions } from '@/db/schema';

export type PrescriptionKind = 'glasses' | 'contact';

export interface EyeInput {
  sphere: string;
  cylinder?: string | null;
  axis?: number | null;
  addPower?: string | null;
}

export interface EyeData {
  sphere: string;
  cylinder: string | null;
  axis: number | null;
  addPower: string | null;
}

export interface PrescriptionGroup {
  recordedAt: string; // ISO — 이력 그룹 키 겸 표시
  kind: PrescriptionKind;
  source: string | null;
  left: EyeData | null;
  right: EyeData | null;
}

export interface SavePrescriptionInput {
  kind: PrescriptionKind;
  source?: string | null;
  left?: EyeInput | null;
  right?: EyeInput | null;
}

/** 한 번의 처방 입력을 좌/우 행으로 저장 (동일 recordedAt 으로 묶음 = 이력 1건). */
export async function savePrescription(
  customerId: string,
  input: SavePrescriptionInput,
): Promise<void> {
  const recordedAt = new Date();
  const rows: (typeof customerPrescriptions.$inferInsert)[] = [];
  const push = (eyeSide: 'left' | 'right', e: EyeInput) => {
    rows.push({
      customerId,
      eyeSide,
      kind: input.kind,
      sphere: e.sphere,
      cylinder: e.cylinder ?? null,
      axis: e.axis ?? null,
      addPower: e.addPower ?? null,
      source: input.source ?? null,
      recordedAt,
    });
  };
  if (input.left) push('left', input.left);
  if (input.right) push('right', input.right);
  if (rows.length === 0) return;
  await db.insert(customerPrescriptions).values(rows);
}

/** 고객의 도수 이력 (좌/우를 묶어 최신순). */
export async function listPrescriptions(
  customerId: string,
): Promise<PrescriptionGroup[]> {
  const rows = await db
    .select()
    .from(customerPrescriptions)
    .where(eq(customerPrescriptions.customerId, customerId))
    .orderBy(desc(customerPrescriptions.recordedAt));

  const map = new Map<string, PrescriptionGroup>();
  for (const r of rows) {
    const iso = r.recordedAt.toISOString();
    const key = `${r.kind}|${iso}`;
    let g = map.get(key);
    if (!g) {
      g = {
        recordedAt: iso,
        kind: (r.kind as PrescriptionKind) ?? 'contact',
        source: r.source,
        left: null,
        right: null,
      };
      map.set(key, g);
    }
    const eye: EyeData = {
      sphere: r.sphere,
      cylinder: r.cylinder,
      axis: r.axis,
      addPower: r.addPower,
    };
    if (r.eyeSide === 'left') g.left = eye;
    else g.right = eye;
  }
  // recordedAt desc 유지 (Map 삽입 순서 = rows 순서 = desc)
  return [...map.values()];
}
