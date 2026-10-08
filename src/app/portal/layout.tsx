import { eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "@/db/client";
import { clients } from "@/db/schema";
import { requireCustomer } from "@/lib/auth/current-user";
import { segmentLabel } from "@/lib/segments";
import { logout } from "../login/actions";
import { CartProvider } from "./cart";
import { CartLink, PortalNav, PortalUserMenu } from "./portal-ui";

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
        <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:gap-6">
            <Link href="/portal" className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-ui bg-brand-600 text-sm font-bold text-white">
                SPJ
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-sm font-semibold text-ink">SPJ Distribuidora</span>
                <span className="block text-xs text-ink-subtle">
                  {segmentLabel(client?.segment ?? "")}
                </span>
              </span>
            </Link>
            <PortalNav />
            <div className="ml-auto flex items-center gap-3">
              <CartLink />
              <PortalUserMenu
                name={user.name}
                clientName={client?.tradeName ?? user.name}
                logout={logout}
              />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">{children}</main>
        <footer className="border-t border-line py-4 text-center text-xs text-ink-subtle">
          SPJ Distribuidora e Serviço · pedidos sujeitos à confirmação de disponibilidade
        </footer>
      </div>
    </CartProvider>
  );
}
