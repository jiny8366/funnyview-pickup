'use client';

import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

/**
 * 제품 바코드(Code128) SVG 렌더 — 팩리스트 인쇄/스캔용.
 * value(GTIN/UDI-DI 등)를 스캐너로 읽을 수 있는 1D 바코드로 출력.
 */
export function Barcode({ value, height = 40 }: { value: string; height?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        height,
        width: 1.5,
        margin: 4,
        fontSize: 11,
        displayValue: true,
      });
    } catch {
      /* 유효하지 않은 값 — 무시 */
    }
  }, [value, height]);
  return <svg ref={ref} className="block" />;
}
