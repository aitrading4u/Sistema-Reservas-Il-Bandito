import { headers } from "next/headers";
import { isDemoMode } from "@/lib/demo-mode";
import { AppError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface AdminContext {
  adminUserId: string;
  role: string;
  restaurantId: string;
}

export async function requireAdmin(): Promise<AdminContext> {
  const demoMode = isDemoMode();
  const requestHeaders = await headers();
  const authorization = requestHeaders.get("authorization");
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const rawCookieToken = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("admin_access_token="))
    ?.slice("admin_access_token=".length);
  const tokenFromCookie = rawCookieToken ? decodeURIComponent(rawCookieToken) : null;
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : tokenFromCookie ?? null;

  if (!token) {
    throw new AppError("No autorizado.", 401, "UNAUTHORIZED");
  }

  if (demoMode && token === "demo-session") {
    return {
      adminUserId: "demo-admin",
      role: "manager",
      restaurantId: "550e8400-e29b-41d4-a716-446655440000",
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    throw new AppError("Token admin invalido.", 401, "INVALID_TOKEN");
  }

  const { data: adminUser, error: adminError } = await supabase
    .from("admin_users")
    .select("id, role, restaurant_id")
    .eq("auth_user_id", userData.user.id)
    .is("deleted_at", null)
    .eq("is_active", true)
    .maybeSingle();

  if (adminError || !adminUser) {
    throw new AppError("Acceso admin denegado.", 403, "FORBIDDEN");
  }

  return {
    adminUserId: adminUser.id,
    role: adminUser.role,
    restaurantId: adminUser.restaurant_id,
  };
}
