"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatCents } from "@/lib/format";
import type { PortalProduct } from "@/lib/orders";
import { unitPriceForQuantity } from "@/lib/price-math";
import { placeOrderAction } from "./actions";
import { useCart } from "./cart";

export function CartLink() {
  const { items } = useCart();
  return (
    <Link href="/portal/carrinho" className="btn-primary">
      Carrinho ({items.reduce((sum, i) => sum + i.quantity, 0)})
    </Link>
  );
}

/** Quantidade + botão "Adicionar" em cada produto do catálogo. */
export function AddToCart({ product }: { product: PortalProduct }) {
  const { add, items } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const inCart = items.find((i) => i.partId === product.partId)?.quantity ?? 0;
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={1}
        value={quantity}
        onChange={(e) => setQuantity(Math.max(1, Number(e.currentTarget.value) || 1))}
        className="input w-20"
        aria-label={`Quantidade de ${product.description}`}
      />
      <button
        type="button"
        className="btn-primary"
        onClick={() => {
          add(product, quantity);
          setAdded(true);
          setTimeout(() => setAdded(false), 1500);
        }}
      >
        {added ? "Adicionado ✓" : "Adicionar"}
      </button>
      {inCart > 0 && <span className="text-xs text-slate-500">{inCart} no carrinho</span>}
    </div>
  );
}

/** Carrinho com total estimado e envio do pedido. */
export function CartView() {
  const { items, setQuantity, remove, clear } = useCart();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const lines = items.map((item) => {
    const unit = unitPriceForQuantity(item, item.quantity, 0);
    return { ...item, unit, total: unit === null ? null : unit * item.quantity };
  });
  const total = lines.reduce((sum, l) => sum + (l.total ?? 0), 0);
  const hasUnpriced = lines.some((l) => l.unit === null);

  if (items.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-slate-500">
        Seu carrinho está vazio.{" "}
        <Link href="/portal" className="text-blue-600 underline">
          Escolher produtos
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="card divide-y divide-slate-100">
        {lines.map((line) => (
          <li key={line.partId} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{line.description}</div>
              <div className="text-xs text-slate-500">
                {line.code}
                {line.brand && ` · ${line.brand}`}
              </div>
            </div>
            <input
              type="number"
              min={1}
              value={line.quantity}
              onChange={(e) => setQuantity(line.partId, Number(e.currentTarget.value) || 1)}
              className="input w-20"
              aria-label={`Quantidade de ${line.description}`}
            />
            <div className="w-32 text-right">
              <div>{formatCents(line.unit)} un.</div>
              <div className="font-semibold">
                {line.total === null ? "a cotar" : formatCents(line.total)}
              </div>
            </div>
            <button
              type="button"
              className="text-xs text-red-600 hover:underline"
              onClick={() => remove(line.partId)}
            >
              remover
            </button>
          </li>
        ))}
      </ul>

      <div className="card space-y-3 p-4">
        <label className="label" htmlFor="notes">
          Observações para a entrega (opcional)
        </label>
        <textarea
          id="notes"
          className="input min-h-20"
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
          placeholder="Ex.: entregar pela manhã, falar com o João"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-slate-500">Total estimado</div>
            <div className="text-2xl font-semibold">{formatCents(total, "R$ 0,00")}</div>
            {hasUnpriced && (
              <div className="text-xs text-amber-700">
                Itens “sob consulta” serão cotados pela SPJ.
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={clear} disabled={pending}>
              Esvaziar
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const result = await placeOrderAction({
                    items: items.map((i) => ({ partId: i.partId, quantity: i.quantity })),
                    notes,
                  });
                  if (!result.ok) return setError(result.error);
                  clear();
                  router.push(`/portal/pedidos/${result.id}?enviado=1`);
                });
              }}
            >
              {pending ? "Enviando…" : "Enviar pedido"}
            </button>
          </div>
        </div>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <p className="text-xs text-slate-500">
          Os preços são confirmados no envio. A SPJ recebe o pedido na hora e organiza a entrega.
        </p>
      </div>
    </div>
  );
}
