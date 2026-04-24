import { fail, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/security/admin-auth";
import {
  createAdminBlock,
  listAdminBlocks,
} from "@/modules/reservations/application/public-booking.service";
import { adminBlockCreateSchema } from "@/modules/reservations/application/reservation.schemas";

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? undefined;
    const items = await listAdminBlocks(admin.restaurantId, date);
    return ok({ items });
  } catch (error) {
    return fail(error, "api.admin.blocks.list");
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => null);
    const parsed = adminBlockCreateSchema.safeParse({
      ...body,
      restaurantId: admin.restaurantId,
      adminUserId: admin.adminUserId,
    });

    if (!parsed.success) {
      return ok(
        { error: "Datos de bloqueo invalidos.", details: parsed.error.flatten() },
        400,
      );
    }

    await createAdminBlock(parsed.data);
    return ok({ status: "created" }, 201);
  } catch (error) {
    return fail(error, "api.admin.blocks.create");
  }
}
