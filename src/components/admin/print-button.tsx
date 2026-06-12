'use client';

// 공용 PrintButton(단일 소스) 의 admin 다크 변형 래퍼 — 중복 구현 제거.
import { PrintButton as BasePrintButton } from '@/components/ui/print-button';

export function PrintButton() {
  return <BasePrintButton variant="dark" label="🖨 인쇄 / PDF 저장" />;
}
