import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceEnv } from "@/lib/supabase/config";

export function createSupabaseAdminClient() {
  const env = getSupabaseServiceEnv();

  return createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getDefaultRestaurantId() {
  const env = getSupabaseServiceEnv();
  return env.defaultRestaurantId;
}
