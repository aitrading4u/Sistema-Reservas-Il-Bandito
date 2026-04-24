import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateReservation } from "@/modules/reservations/domain/reservation.types";

export class ReservationRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(input: CreateReservation) {
    void input;
    // Placeholder repository method. Hook here to RPC or table inserts.
    return { ok: true };
  }

  get client() {
    return this.supabase;
  }
}
