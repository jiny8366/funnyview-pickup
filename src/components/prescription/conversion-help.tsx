'use client';

import { useState } from 'react';

/**
 * 안경↔콘택트 도수 변환 가정 고객 도움말 (작업 #1 — JINY 지시).
 * 접힌 토글로 제공 — 제품상세 '내 도수 선택'과 마이페이지 도수정보에서 재사용.
 * 내용은 lib/prescription/convert.ts 의 실제 변환 로직과 일치하게 유지할 것.
 */
export function ConversionHelp({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-gray-400 underline-offset-2 hover:text-gray-600 hover:underline"
      >
        {open ? '▴ 안경 도수가 콘택트와 다른 이유 (변환 안내)' : '▾ 안경 도수가 콘택트와 다른 이유 (변환 안내)'}
      </button>

      {open && (
        <div className="animate-fade-in mt-2 space-y-2 rounded-xl bg-gray-50 p-4 text-xs leading-relaxed text-gray-600">
          <p>
            <b className="text-gray-800">안경 도수와 콘택트렌즈 도수는 같지 않습니다.</b>{' '}
            안경은 눈에서 약 12mm 떨어져 있고 콘택트렌즈는 눈 위에 바로 놓이기 때문에,
            같은 시력을 교정하더라도 필요한 도수가 달라집니다. (도수가 높을수록 차이가 커집니다)
          </p>
          <div>
            <p className="font-semibold text-gray-800">안경 도수만 저장되어 있을 때, 이렇게 자동 변환합니다</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>정점거리(12mm) 보정 공식으로 환산 — 아큐브 등 제조사 도수변환표와 같은 원리입니다.</li>
              <li>결과는 콘택트 처방 단위인 0.25D 로 반올림합니다.</li>
              <li>난시(CYL)는 두 주경선을 각각 보정한 뒤, 토릭 렌즈가 제공하는 단계로 맞춥니다.</li>
              <li>난시가 약하면(0.5D 미만) 구면등가로 합산해 일반(구면) 렌즈 도수로 안내합니다.</li>
              <li>돋보기(ADD) 값은 멀티포컬(다초점) 렌즈를 고를 때만 사용됩니다.</li>
            </ul>
          </div>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
            ⚠️ 자동 변환은 <b>참고용</b>입니다. 처음 콘택트렌즈를 쓰시거나 도수가 높다면,
            픽업 가맹점(안경원)에서 <b>안경사 상담·시착 후 최종 도수를 확인</b>하는 것을 권장합니다 —
            픽업 시 무료로 상담받을 수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
}
