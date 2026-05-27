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
  // 기존 기록 수정 시 그 기록의 recordedAt (ISO). 미지정이면 신규 저장.
  replaceAt: z.string().nullable().optional(),
});

/** 최적화 렌즈 추천 입력 (도수 + 생활환경). */
export const recommendSchema = z.object({
  dose: z.object({
    sphere: z.number(),
    cylinder: z.number().nullable(),
    addPower: z.number().nullable(),
  }),
  lifestyle: z.object({
    daysPerWeek: z.number().nullable(),
    hoursPerDay: z.number().nullable(),
    discomforts: z.array(z.string()),
    features: z.array(z.string()),
    ignoreLifestyle: z.boolean(),
  }),
});
