"use client";

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import type { PortalProduct } from "@/lib/orders";

export type CartItem = PortalProduct & { quantity: number };

type CartContextValue = {
  items: CartItem[];
  add: (product: PortalProduct, quantity: number) => void;
  setQuantity: (partId: string, quantity: number) => void;
  remove: (partId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

/**
 * Carrinho do portal, guardado no navegador (localStorage) por usuário. É só uma conveniência:
 * preços e disponibilidade são recalculados no servidor ao enviar o pedido.
 */
export function CartProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const key = `spj_cart_${userId}`;
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(key);
      if (saved) setItems(JSON.parse(saved) as CartItem[]);
    } catch {
      // armazenamento indisponível: segue com carrinho vazio
    }
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(items));
    } catch {
      // ignora: o carrinho só não persiste entre recarregamentos
    }
  }, [key, items, loaded]);

  const value: CartContextValue = {
    items,
    add: (product, quantity) =>
      setItems((prev) => {
        const existing = prev.find((i) => i.partId === product.partId);
        if (existing) {
          return prev.map((i) =>
            i.partId === product.partId ? { ...i, quantity: i.quantity + quantity } : i,
          );
        }
        return [...prev, { ...product, quantity }];
      }),
    setQuantity: (partId, quantity) =>
      setItems((prev) =>
        prev.map((i) => (i.partId === partId ? { ...i, quantity: Math.max(1, quantity) } : i)),
      ),
    remove: (partId) => setItems((prev) => prev.filter((i) => i.partId !== partId)),
    clear: () => setItems([]),
  };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("useCart fora do CartProvider");
  return cart;
}
