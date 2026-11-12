import type { ReactNode } from 'react';

export function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`mt-0.5 text-sm text-slate-800 ${mono ? 'break-all font-mono text-xs' : ''}`}>
        {value || '-'}
      </dd>
    </div>
  );
}
