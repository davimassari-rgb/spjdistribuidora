"use client";

import {
  Loader2,
  LogOut,
  Minus,
  Package,
  Plus,
  Search,
  Send,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { formatCents } from "@/lib/format";
import type { PortalProduct } from "@/lib/orders";
import { unitPriceForQuantity } from "@/lib/price-math";
import { placeOrderAction } from "./actions";
import { useCart } from "./cart";

// ------------------------------------------------------------------ cabeçalho

const NAV = [
  { href: "/portal", label: "Produtos", icon: Package, exact: true },
  { href: "/portal/pedidos", label: "Meus pedidos", icon: ShoppingCart, exact: false },
];

export function PortalNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1" aria-label="Portal">
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 rounded-ui px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-brand-50 text-brand-700"
                : "text-ink-muted hover:bg-surface-sunken hover:text-ink"
            }`}
          >
            <Icon className="size-4" aria-hidden />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function CartLink() {
  const { items } = useCart();
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  return (
    <Link
      href="/portal/carrinho"
      className="btn-primary relative"
      aria-label={`Carrinho com ${count} itens`}
    >
      <ShoppingCart className="size-4" aria-hidden />
      <span className="hidden sm:inline">Carrinho</span>
      {count > 0 && (
        <span className="num absolute -top-2 -right-2 flex min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-xs font-bold text-slate-900 ring-2 ring-white">
          {count}
        </span>
      )}
    </Link>
  );
}

export function PortalUserMenu({
  name,
  clientName,
  logout,
}: {
  name: string;
  clientName: string;
  logout: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-ui p-1 hover:bg-surface-sunken"
      >
        <Avatar name={clientName} />
        <span className="hidden text-left md:block">
          <span className="block max-w-40 truncate text-sm font-medium text-ink">{clientName}</span>
          <span className="block max-w-40 truncate text-xs text-ink-subtle">{name}</span>
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-30 mt-1 w-48 rounded-ui border border-line bg-surface p-1 shadow-pop"
        >
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

// ------------------------------------------------------------------ catálogo

/** Busca que aplica enquanto digita (atraso de 350 ms), mantendo o termo na URL. */
export function PortalSearch({ initial }: { initial?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial ?? "");
  const [pending, startTransition] = useTransition();
  const last = useRef(initial ?? "");

  useEffect(() => {
    if (q.trim() === last.current) return;
    const timer = setTimeout(() => {
      last.current = q.trim();
      startTransition(() =>
        router.replace(q.trim() ? `/portal?q=${encodeURIComponent(q.trim())}` : "/portal", {
          scroll: false,
        }),
      );
    }, 350);
    return () => clearTimeout(timer);
  }, [q, router]);

  return (
    <form onSubmit={(e) => e.preventDefault()} className="relative">
      <label htmlFor="portal-search" className="sr-only">
        Buscar produtos
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-subtle"
        aria-hidden
      />
      <input
        id="portal-search"
        type="search"
        className="input h-12 pr-10 pl-12 text-base"
        placeholder="Buscar por código, nome, marca ou aplicação…"
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
      />
      {pending && (
        <Loader2
          className="absolute top-1/2 right-4 size-4 -translate-y-1/2 animate-spin text-ink-subtle"
          aria-label="Buscando"
        />
      )}
    </form>
  );
}

/** Seletor de quantidade com botões − e +. */
export function QuantityStepper({
  value,
  onChange,
  label,
  size = "md",
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  size?: "sm" | "md";
}) {
  const height = size === "sm" ? "h-8" : "h-9";
  return (
    <div
      className={`inline-flex ${height} items-stretch overflow-hidden rounded-ui border border-line-strong bg-surface shadow-ui`}
    >
      <button
        type="button"
        className="px-2.5 text-ink-muted hover:bg-surface-sunken disabled:opacity-40"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        aria-label={`Diminuir ${label}`}
      >
        <Minus className="size-3.5" aria-hidden />
      </button>
      <input
        type="number"
        min={1}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(Math.max(1, Math.floor(Number(e.currentTarget.value) || 1)))}
        className="num w-12 border-x border-line text-center text-sm outline-none [appearance:textfield] focus:bg-brand-50 [&::-webkit-inner-spin-button]:appearance-none"
        aria-label={label}
      />
      <button
        type="button"
        className="px-2.5 text-ink-muted hover:bg-surface-sunken"
        onClick={() => onChange(value + 1)}
        aria-label={`Aumentar ${label}`}
      >
        <Plus className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

/** Quantidade + botão "Adicionar" em cada produto do catálogo. */
export function AddToCart({ product }: { product: PortalProduct }) {
  const { add, items } = useCart();
  const toast = useToast();
  const [quantity, setQuantity] = useState(1);
  const inCart = items.find((i) => i.partId === product.partId)?.quantity ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <QuantityStepper
        value={quantity}
        onChange={setQuantity}
        label={`Quantidade de ${product.description}`}
      />
      <button
        type="button"
        className="btn-primary flex-1"
        onClick={() => {
          add(product, quantity);
          toast("success", `${quantity} × ${product.description} adicionado ao carrinho.`);
          setQuantity(1);
        }}
      >
        <Plus className="size-4" aria-hidden />
        Adicionar
      </button>
      {inCart > 0 && (
        <span className="badge-brand w-full justify-center">
          <ShoppingCart className="size-3" aria-hidden />
          {inCart} no carrinho
        </span>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ carrinho

/** Carrinho com total estimado e envio do pedido. */
export function CartView() {
  const { items, setQuantity, remove, clear } = useCart();
  const toast = useToast();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const lines = items.map((item) => {
    const unit = unitPriceForQuantity(item, item.quantity, 0);
    return { ...item, unit, total: unit === null ? null : unit * item.quantity };
  });
  const total = lines.reduce((sum, l) => sum + (l.total ?? 0), 0);
  const units = lines.reduce((sum, l) => sum + l.quantity, 0);
  const hasUnpriced = lines.some((l) => l.unit === null);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={ShoppingCart}
        title="Seu carrinho está vazio"
        description="Escolha os produtos no catálogo e eles aparecem aqui para você revisar e enviar o pedido."
        action={
          <Link href="/portal" className="btn-primary">
            Ver produtos
          </Link>
        }
      />
    );
  }

  function send() {
    setError(null);
    startTransition(async () => {
      const result = await placeOrderAction({
        items: items.map((i) => ({ partId: i.partId, quantity: i.quantity })),
        notes,
      });
      if (!result.ok) {
        setError(result.error);
        toast("error", result.error);
        return;
      }
      clear();
      toast("success", `Pedido ${result.number} enviado!`);
      router.push(`/portal/pedidos/${result.id}?enviado=1`);
    });
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
      <ul className="card divide-y divide-line">
        {lines.map((line) => {
          // Faixa de volume ainda não atingida: mostra quanto falta para o preço menor.
          const nextTier = line.tiers.find((t) => t.minQuantity > line.quantity);
          return (
            <li key={line.partId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{line.description}</p>
                <p className="caption">
                  <span className="font-mono">{line.code}</span>
                  {line.brand && ` · ${line.brand}`}
                </p>
                {nextTier && (
                  <p className="mt-1 text-xs text-success">
                    Leve {nextTier.minQuantity} un. e pague {formatCents(nextTier.priceCents)} cada
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <QuantityStepper
                  size="sm"
                  value={line.quantity}
                  onChange={(value) => setQuantity(line.partId, value)}
                  label={`Quantidade de ${line.description}`}
                />
                <div className="num w-28 text-right">
                  <div className="caption">
                    {line.unit === null ? "sob consulta" : `${formatCents(line.unit)} un.`}
                  </div>
                  <div className="font-semibold text-ink">
                    {line.total === null ? "a cotar" : formatCents(line.total)}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-icon hover:text-danger"
                  onClick={() => remove(line.partId)}
                  aria-label={`Remover ${line.description}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <aside className="card space-y-4 p-5 lg:sticky lg:top-24">
        <h2 className="section-title">Resumo do pedido</h2>
        <dl className="num space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-subtle">Produtos</dt>
            <dd>{lines.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-subtle">Unidades</dt>
            <dd>{units}</dd>
          </div>
          <div className="flex items-baseline justify-between border-t border-line pt-3">
            <dt className="font-medium text-ink">Total estimado</dt>
            <dd className="text-2xl font-semibold text-ink">{formatCents(total, "R$ 0,00")}</dd>
          </div>
        </dl>
        {hasUnpriced && (
          <p className="rounded-ui border border-warning-border bg-warning-bg px-3 py-2 text-xs text-warning">
            Itens “sob consulta” serão cotados pela SPJ e confirmados com você.
          </p>
        )}
        <div>
          <label className="label" htmlFor="notes">
            Observações para a entrega
          </label>
          <textarea
            id="notes"
            className="input min-h-20"
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
            placeholder="Ex.: entregar pela manhã, falar com o João"
          />
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-ui border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger"
          >
            {error}
          </p>
        )}
        <button
          type="button"
          className="btn-primary h-11 w-full text-base"
          disabled={pending}
          onClick={send}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Send className="size-4" aria-hidden />
          )}
          {pending ? "Enviando…" : "Enviar pedido"}
        </button>
        <div className="flex items-center justify-between">
          <Link href="/portal" className="text-sm font-medium text-brand-700 hover:underline">
            Continuar comprando
          </Link>
          <button
            type="button"
            className="btn-ghost h-8 px-2 text-xs"
            onClick={clear}
            disabled={pending}
          >
            Esvaziar carrinho
          </button>
        </div>
        <p className="caption">
          Os preços são confirmados no envio. A SPJ recebe o pedido na hora e organiza a entrega.
        </p>
      </aside>
    </div>
  );
}
