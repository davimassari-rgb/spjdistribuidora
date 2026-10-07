import Link from "next/link";
import { NavLinks } from "@/components/nav-links";
import { requireUser } from "@/lib/auth/current-user";
import { logout } from "../login/actions";

// Todas as rotas deste grupo exigem login.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 py-2 md:flex-row md:items-center md:gap-6">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="font-semibold whitespace-nowrap text-blue-700">
              SPJ Distribuidora
            </Link>
            <form action={logout} className="md:hidden">
              <button type="submit" className="text-sm text-slate-500 hover:text-slate-800">
                Sair
              </button>
            </form>
          </div>
          <NavLinks />
          <div className="ml-auto hidden items-center gap-3 text-sm md:flex">
            <span className="whitespace-nowrap text-slate-500">{user.name}</span>
            <form action={logout}>
              <button type="submit" className="text-slate-500 hover:text-slate-800">
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
