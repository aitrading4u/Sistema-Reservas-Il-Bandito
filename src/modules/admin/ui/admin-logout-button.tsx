"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { isDemoMode } from "@/lib/demo-mode";
import { createSupabaseClient } from "@/lib/supabase/client";

export function AdminLogoutButton() {
  const router = useRouter();

  async function logout() {
    document.cookie = "admin_access_token=; Path=/; Max-Age=0; SameSite=Lax";
    if (!isDemoMode()) {
      try {
        const supabase = createSupabaseClient();
        await supabase.auth.signOut();
      } catch {
        // misconfigured env, etc.
      }
    }
    router.push("/admin/login");
  }

  return (
    <Button variant="secondary" size="sm" onClick={logout}>
      Cerrar sesion
    </Button>
  );
}
