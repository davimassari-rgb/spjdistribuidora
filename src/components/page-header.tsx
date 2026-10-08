import type { ReactNode } from "react";

/** Cabeçalho padrão: título, descrição curta e ações à direita. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {description && <div className="mt-1 max-w-3xl text-sm text-ink-subtle">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
