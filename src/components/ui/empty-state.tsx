import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Estado vazio com ícone, título e (opcional) uma ação. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-ink-subtle">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
