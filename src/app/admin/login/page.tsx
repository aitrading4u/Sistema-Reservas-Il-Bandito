"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isDemoMode } from "@/lib/demo-mode";
import { createSupabaseClient } from "@/lib/supabase/client";

function AdminLoginContent() {
  const demoMode = isDemoMode();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasPublicSupabaseEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  async function signIn() {
    if (!hasPublicSupabaseEnv) {
      setError(
        "Falta configurar NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local",
      );
      return;
    }

    if (!email.trim() || !password.trim()) {
      setError("Introduce email y contraseña.");
      return;
    }

    const supabase = createSupabaseClient();
    setLoading(true);
    setError("");
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (signInError || !data.session?.access_token) {
      setError("Credenciales invalidas o usuario sin acceso.");
      return;
    }

    document.cookie = `admin_access_token=${encodeURIComponent(data.session.access_token)}; Path=/; Max-Age=28800; SameSite=Lax`;
    const next = searchParams.get("next") || "/admin/dashboard";
    router.push(next);
  }

  function enterDemoMode() {
    document.cookie = `admin_access_token=${encodeURIComponent("demo-session")}; Path=/; Max-Age=28800; SameSite=Lax`;
    const next = searchParams.get("next") || "/admin/dashboard";
    router.push(next);
  }

  return (
    <section className="mx-auto max-w-lg py-8">
      <Card className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Acceso admin</h1>
        <p className="text-sm text-muted-foreground">
          {demoMode
            ? "Modo demo activo. Puedes entrar directamente para revisar flujos."
            : "Accede con tu usuario administrador de Supabase Auth."}
        </p>
        {!hasPublicSupabaseEnv ? (
          <p className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
            Configura primero <code>.env.local</code> con{" "}
            <code>NEXT_PUBLIC_SUPABASE_URL</code> y <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
          </p>
        ) : null}
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void signIn();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="admin-email">Email</Label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@ilbanditoaltea.es"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-password">Contraseña</Label>
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Tu contraseña"
            />
          </div>
          {error ? <p className="text-sm text-primary">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading || demoMode}>
            {loading ? "Entrando..." : "Entrar al panel"}
          </Button>
        </form>
        {demoMode ? (
          <Button className="w-full" variant="secondary" onClick={enterDemoMode}>
            Entrar a demo
          </Button>
        ) : null}
      </Card>
    </section>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<section className="mx-auto max-w-lg py-8" />}>
      <AdminLoginContent />
    </Suspense>
  );
}
