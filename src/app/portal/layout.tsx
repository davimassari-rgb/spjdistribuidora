import { eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "@/db/client";
import { clients } from "@/db/schema";
import { requireCustomer } from "@/lib/auth/current-user";
import { segmentLabel } from "@/lib/segments";
import { logout } from "../login/actions";
import { CartProvider } from "./cart";
import { CartLink } from "./portal-ui";

// Portal do cliente final: só acessível a logins de cliente (criados pela equipe).
export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const user = await requireCustomer();
  const [client] = await getDb()
    .select({ tradeName: clients.tradeName, segment: clients.segment })
    .from(clients)
    .where(eq(clients.id, user.clientId));

  return (
    <CartProvider userId={user.id}>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2">
            <Link href="/portal" className="font-semibold text-blue-700">
              SPJ Distribuidora
              <span className="ml-2 text-xs font-normal text-slate-500">
                {segmentLabel(client?.segment ?? "")}
              </span>
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/portal" className="hover:underline">
                Produtos
              </Link>
              <Link href="/portal/pedidos" className="hover:underline">
                Meus pedidos
              </Link>
            </nav>
            <div className="ml-auto flex items-center gap-3 text-sm">
              <span className="hidden text-slate-500 sm:inline">{client?.tradeName}</span>
              <CartLink />
              <form action={logout}>
                <button type="submit" className="text-slate-500 hover:text-slate-800">
                  Sair
                </button>
              </form>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      </div>
    </CartProvider>
  );
}
