import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Il Bandito <span className="text-sm font-medium text-muted-foreground">Altea</span>
        </Link>
        <nav aria-label="Navegacion principal">
          <ul className="flex items-center gap-2 text-sm">
            <li>
              <Link className="rounded-xl px-3 py-2.5 font-medium hover:bg-muted/70" href="/reservas">
                Reservas
              </Link>
            </li>
            <li>
              <Link className="rounded-xl px-3 py-2.5 font-medium hover:bg-muted/70" href="/mis-reservas">
                Mis reservas
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
