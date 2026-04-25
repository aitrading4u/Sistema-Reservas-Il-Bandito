import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isDemoMode } from "@/lib/demo-mode";
import { AdminLogoutButton } from "@/modules/admin/ui/admin-logout-button";

const links = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/calendario", label: "Calendario" },
  { href: "/admin/reservas", label: "Reservas" },
  { href: "/admin/mesas", label: "Mesas" },
  { href: "/admin/horarios", label: "Horarios" },
  { href: "/admin/bloqueos", label: "Bloqueos" },
  { href: "/admin/lista-negra", label: "Lista negra" },
  { href: "/admin/contactos", label: "Contactos" },
  { href: "/admin/ajustes", label: "Ajustes" },
];

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const demoMode = isDemoMode();
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_access_token")?.value;
  if (!token) {
    redirect("/admin/login");
  }

  if (!demoMode) {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      redirect("/admin/login");
    }
  } else if (token !== "demo-session") {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Panel interno</p>
              <h1 className="text-lg font-semibold tracking-tight">Il Bandito</h1>
            </div>
            <AdminLogoutButton />
          </div>
          <nav aria-label="Navegacion admin" className="mt-3">
            <ul className="flex flex-wrap items-center gap-2 text-sm">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    className="whitespace-nowrap rounded-xl px-3 py-2 font-medium hover:bg-muted/70"
                    href={link.href}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
