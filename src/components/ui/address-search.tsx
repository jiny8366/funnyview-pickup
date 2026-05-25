'use client';

import { useCallback } from 'react';

/**
 * 다음(카카오) 우편번호 서비스 연동 버튼.
 * 클릭 시 스크립트를 lazy-load 하고 팝업을 띄워, 선택된 우편번호+도로명 주소를 콜백으로 전달.
 *
 * 사용 예:
 *   <AddressSearchButton onComplete={({ zonecode, address }) => { ... }} />
 */

const SCRIPT_SRC =
  'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

interface DaumPostcodeData {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  buildingName?: string;
}

declare global {
  interface Window {
    daum?: {
      Postcode: new (opts: {
        oncomplete: (data: DaumPostcodeData) => void;
      }) => { open: () => void };
    };
  }
}

function loadPostcodeScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('no window'));
    if (window.daum?.Postcode) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('load error')));
      return;
    }
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('load error'));
    document.head.appendChild(s);
  });
}

export interface AddressResult {
  zonecode: string;
  address: string;
}

export function AddressSearchButton({
  onComplete,
  disabled,
  label = '주소검색',
  className,
}: {
  onComplete: (result: AddressResult) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  const open = useCallback(async () => {
    try {
      await loadPostcodeScript();
    } catch {
      alert('주소검색 서비스를 불러오지 못했습니다. 네트워크를 확인해주세요.');
      return;
    }
    if (!window.daum?.Postcode) return;
    new window.daum.Postcode({
      oncomplete: (data) => {
        const address = data.roadAddress || data.jibunAddress;
        onComplete({ zonecode: data.zonecode, address });
      },
    }).open();
  }, [onComplete]);

  return (
    <button
      type="button"
      onClick={open}
      disabled={disabled}
      className={
        className ??
        'shrink-0 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50'
      }
    >
      {label}
    </button>
  );
}
