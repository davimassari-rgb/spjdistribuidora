import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { CartView } from "../portal-ui";

export const metadata: Metadata = { title: "Carrinho" };

export default function CartPage() {
  return (
    <>
      <PageHeader title="Carrinho" description="Revise as quantidades e envie o pedido." />
      <CartView />
    </>
  );
}
