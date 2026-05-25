import { z } from 'zod';

/** 도수 입력/저장 공통 검증 스키마 (admin / customer / store API 공용). */
export const prescriptionEyeSchema = z.object({
  sphere: z.string().min(1),
  cylinder: z.string().nullable().optional(),
  axis: z.number().int().min(0).max(180).nullable().optional(),
  addPower: z.string().nullable().optional(),
});

export const prescriptionPostSchema = z.object({
  kind: z.enum(['glasses', 'contact']),
  source: z.string().nullable().optional(),
  left: prescriptionEyeSchema.nullable().optional(),
  right: prescriptionEyeSchema.nullable().optional(),
});
