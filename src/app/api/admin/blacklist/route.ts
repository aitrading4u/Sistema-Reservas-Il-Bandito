import { fail, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/security/admin-auth";
import {
  createAdminBlacklist,
  listAdminBlacklist,
} from "@/modules/reservations/application/public-booking.service";
import {
  adminBlacklistCreateSchema,
  adminBlacklistListSchema,
} from "@/modules/reservations/application/reservation.schemas";

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const parsed = adminBlacklistListSchema.safeParse({
      restaurantId: admin.restaurantId,
      query: searchParams.get("query") ?? undefined,
    });
    if (!parsed.success) {
      return ok({ error: "Filtro invalido.", details: parsed.error.flatten() }, 400);
    }
    const items = await listAdminBlacklist(parsed.data);
    return ok({ items });
  } catch (error) {
    return fail(error, "api.admin.blacklist.list");
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => null);
    const parsed = adminBlacklistCreateSchema.safeParse({
      ...body,
      restaurantId: admin.restaurantId,
      adminUserId: admin.adminUserId,
    });
    if (!parsed.success) {
      return ok(
        { error: "Datos invalidos para lista negra.", details: parsed.error.flatten() },
        400,
      );
    }
    const result = await createAdminBlacklist(parsed.data);
    return ok(result, 201);
  } catch (error) {
    return fail(error, "api.admin.blacklist.create");
  }
}
