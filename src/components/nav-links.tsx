"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/catalogo", label: "Catálogo" },
  { href: "/fornecedores", label: "Fornecedores" },
  { href: "/clientes", label: "Clientes" },
  { href: "/comercial", label: "Comercial" },
  { href: "/prospeccao", label: "Prospecção" },
  { href: "/farmer", label: "Farmer" },
  { href: "/usuarios", label: "Usuários" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${
              active ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
