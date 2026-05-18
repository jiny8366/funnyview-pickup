import Link from 'next/link';

export function Breadcrumb({
  items,
}: {
  items: { href?: string; label: string }[];
}) {
  return (
    <nav className="flex justify-end text-xs text-gray-500">
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center">
          {it.href ? (
            <Link href={it.href} className="hover:text-gray-900">
              {it.label}
            </Link>
          ) : (
            <span className="font-semibold text-gray-900">{it.label}</span>
          )}
          {i < items.length - 1 && (
            <span className="px-1.5 text-gray-300">{'>'}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
