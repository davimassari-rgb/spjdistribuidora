"use client";

import {
  Building2,
  ChevronsLeft,
  ChevronsUpDown,
  Kanban,
  KeyRound,
  Layers,
  LogOut,
  type LucideIcon,
  Menu,
  Package,
  ShoppingCart,
  Sprout,
  Target,
  Truck,
  UserCog,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { SEGMENT_IDS, SEGMENTS, type Segment } from "@/lib/segments";

type NavItem = { href: string; label: string; icon: LucideIcon };

const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Operação",
    items: [
      { href: "/catalogo", label: "Catálogo", icon: Package },
      { href: "/pedidos", label: "Pedidos", icon: ShoppingCart },
      { href: "/fornecedores", label: "Fornecedores", icon: Truck },
    ],
  },
  {
    title: "Vendas",
    items: [
      { href: "/comercial", label: "Comercial", icon: Kanban },
      { href: "/prospeccao", label: "Prospecção", icon: Target },
      { href: "/farmer", label: "Farmer", icon: Sprout },
      { href: "/clientes", label: "Clientes", icon: Users },
    ],
  },
  { title: "Admin", items: [{ href: "/usuarios", label: "Usuários", icon: UserCog }] },
];

const STORAGE_KEY = "spj_sidebar_collapsed";

/** Estrutura da área interna: sidebar fixa (recolhível) + conteúdo em largura total. */
export function AppShell({
  user,
  segment,
  setSegment,
  logout,
  children,
}: {
  user: { name: string; email: string };
  segment: Segment;
  setSegment: (formData: FormData) => Promise<void>;
  logout: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // sem armazenamento: começa expandida
    }
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: fecha o menu móvel ao navegar
  useEffect(() => setMobileOpen(false), [pathname]);

  function toggle() {
    setCollapsed((value) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, value ? "0" : "1");
      } catch {
        // ignora
      }
      return !value;
    });
  }

  const compact = collapsed && !mobileOpen;

  return (
    <div className="min-h-screen">
      {/* Barra superior só no celular/tablet */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface px-4 py-2 lg:hidden">
        <button
          type="button"
          className="btn-icon"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
        >
          <Menu className="size-5" aria-hidden />
        </button>
        <span className="font-semibold text-brand-700">SPJ Distribuidora</span>
        <span className="badge-brand ml-auto">{SEGMENTS[segment].label}</span>
      </div>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-line bg-surface transition-all duration-200 ${
          compact ? "w-16" : "w-[var(--sidebar-width)]"
        } ${mobileOpen ? "translate-x-0 shadow-modal" : "-translate-x-full lg:translate-x-0"}`}
        aria-label="Menu principal"
      >
        <div className="flex items-center gap-2 px-3 pt-3">
          {!compact && (
            <span className="flex-1 px-1 text-sm font-semibold text-brand-700">
              SPJ Distribuidora
            </span>
          )}
          <button
            type="button"
            className="btn-icon hidden lg:inline-flex"
            onClick={toggle}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            <ChevronsLeft
              className={`size-4 transition ${collapsed ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
          <button
            type="button"
            className="btn-icon lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="px-3 pt-3">
          <SegmentSwitcher current={segment} action={setSegment} compact={compact} />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {GROUPS.map((group) => (
            <div key={group.title} className="mb-4">
              {!compact && (
                <p className="mb-1 px-2 text-[11px] font-semibold tracking-wider text-ink-subtle uppercase">
                  {group.title}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={compact ? item.label : undefined}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-ui px-2 py-2 text-sm font-medium transition ${
                          active
                            ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
                            : "text-ink-muted hover:bg-surface-sunken hover:text-ink"
                        } ${compact ? "justify-center" : ""}`}
                      >
                        <Icon
                          className={`size-4 shrink-0 ${active ? "text-brand-600" : ""}`}
                          aria-hidden
                        />
                        {!compact && item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-line p-3">
          <UserMenu user={user} logout={logout} compact={compact} />
        </div>
      </aside>

      <div
        className={`transition-all duration-200 ${collapsed ? "lg:pl-16" : "lg:pl-[var(--sidebar-width)]"}`}
      >
        <main className="w-full px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

/** Dropdown com fechamento ao clicar fora (usado no seletor de segmento e no menu do usuário). */
function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

function SegmentSwitcher({
  current,
  action,
  compact,
}: {
  current: Segment;
  action: (formData: FormData) => Promise<void>;
  compact: boolean;
}) {
  const { open, setOpen, ref } = useDropdown();
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={compact ? `Segmento: ${SEGMENTS[current].label}` : undefined}
        className={`flex w-full items-center gap-2 rounded-ui border border-line bg-surface-muted p-2 text-left transition hover:border-line-strong ${compact ? "justify-center" : ""}`}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-600 text-white">
          <Layers className="size-4" aria-hidden />
        </span>
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] text-ink-subtle">Segmento</span>
              <span className="block truncate text-sm font-semibold text-ink">
                {SEGMENTS[current].label}
              </span>
            </span>
            <ChevronsUpDown className="size-4 text-ink-subtle" aria-hidden />
          </>
        )}
      </button>
      {open && (
        <form
          action={async (formData) => {
            setOpen(false);
            await action(formData);
          }}
          className="absolute top-full left-0 z-10 mt-1 w-56 rounded-ui border border-line bg-surface p-1 shadow-pop"
        >
          {SEGMENT_IDS.map((id) => (
            <button
              key={id}
              type="submit"
              name="segment"
              value={id}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-surface-sunken ${id === current ? "font-semibold text-brand-700" : "text-ink-muted"}`}
            >
              <Building2 className="size-4" aria-hidden />
              {SEGMENTS[id].label}
              {id === current && <span className="badge-brand ml-auto">atual</span>}
            </button>
          ))}
        </form>
      )}
    </div>
  );
}

function UserMenu({
  user,
  logout,
  compact,
}: {
  user: { name: string; email: string };
  logout: () => Promise<void>;
  compact: boolean;
}) {
  const { open, setOpen, ref } = useDropdown();
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex w-full items-center gap-2 rounded-ui p-1.5 text-left hover:bg-surface-sunken ${compact ? "justify-center" : ""}`}
      >
        <Avatar name={user.name} />
        {!compact && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{user.name}</span>
            <span className="block truncate text-xs text-ink-subtle">{user.email}</span>
          </span>
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-10 mb-1 w-56 rounded-ui border border-line bg-surface p-1 shadow-pop"
        >
          <Link
            role="menuitem"
            href="/usuarios?senha=1"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            <KeyRound className="size-4" aria-hidden />
            Alterar senha
          </Link>
          <form action={logout}>
            <button
              role="menuitem"
              type="submit"
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-danger hover:bg-danger-bg"
            >
              <LogOut className="size-4" aria-hidden />
              Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
