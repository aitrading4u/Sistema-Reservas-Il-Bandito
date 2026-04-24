import { z } from "zod";
import { getPublicEnv, getServerEnv } from "@/lib/env";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  RESERVATIONS_DEFAULT_RESTAURANT_ID: z.string().uuid().optional(),
});

export function getSupabasePublicEnv() {
  const publicEnv = getPublicEnv();
  return envSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    RESERVATIONS_DEFAULT_RESTAURANT_ID: process.env.RESERVATIONS_DEFAULT_RESTAURANT_ID,
  });
}

export function getSupabaseServiceEnv() {
  const serverEnv = getServerEnv();

  return {
    url: serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    defaultRestaurantId: serverEnv.RESERVATIONS_DEFAULT_RESTAURANT_ID,
  };
}
