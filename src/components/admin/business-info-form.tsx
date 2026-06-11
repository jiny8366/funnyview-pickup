'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const FIELDS: { key: string; label: string; ph?: string }[] = [
  { key: 'companyName', label: '상호 (회사명)', ph: '예: (주)퍼니뷰' },
  { key: 'serviceName', label: '서비스명 (명세서·송장 표기)', ph: '예: 퍼니뷰 예약시스템' },
  { key: 'bizNo', label: '사업자등록번호', ph: '000-00-00000' },
  { key: 'ceo', label: '대표자' },
  { key: 'address', label: '영업소 소재지' },
  { key: 'phone', label: '연락처', ph: '02-000-0000' },
  { key: 'email', label: '이메일' },
  { key: 'mailOrderNo', label: '통신판매업 신고번호', ph: '제0000-지역-0000호' },
  { key: 'privacyOfficer', label: '개인정보보호책임자' },
  { key: 'sealUrl', label: '직인 이미지 URL', ph: 'https://… (거래명세서 직인)' },
];

export function BusinessInfoForm() {
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/business-info')
      .then((r) => r.json())
      .then((d) => {
        const b = (d.businessInfo ?? {}) as Record<string, string | null>;
        const f: Record<string, string> = {};
        for (const { key } of FIELDS) f[key] = b[key] ?? '';
        setForm(f);
      })
      .catch(() => setMsg('불러오기 실패'))
      .finally(() => setLoading(false));
  }, []);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/business-info', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      setMsg(res.ok ? '✅ 저장되었습니다 — 거래명세서·송장 발행자에 즉시 반영됩니다.' : '저장 실패');
    } catch {
      setMsg('저장 실패');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-gray-500">불러오는 중…</p>;

  return (
    <div className="max-w-xl space-y-3">
      {FIELDS.map(({ key, label, ph }) => (
        <Input
          key={key}
          name={key}
          label={label}
          placeholder={ph}
          value={form[key] ?? ''}
          onChange={(e) => set(key, e.target.value)}
        />
      ))}
      {msg && <p className="text-sm text-gray-600">{msg}</p>}
      <Button onClick={save} disabled={saving}>
        {saving ? '저장 중…' : '저장'}
      </Button>
    </div>
  );
}
