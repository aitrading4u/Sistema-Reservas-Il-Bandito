import { fail, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/security/admin-auth";
import { deleteAdminContact, listAdminContacts } from "@/modules/reservations/application/public-booking.service";
import { adminContactDeleteSchema, adminContactListSchema } from "@/modules/reservations/application/reservation.schemas";

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const parsed = adminContactListSchema.safeParse({
      restaurantId: admin.restaurantId,
      query: searchParams.get("query") ?? undefined,
    });
    if (!parsed.success) {
      return ok({ error: "Filtro invalido.", details: parsed.error.flatten() }, 400);
    }
    const items = await listAdminContacts(parsed.data);
    return ok({ items });
  } catch (error) {
    return fail(error, "api.admin.contacts.list");
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => null);
    const parsed = adminContactDeleteSchema.safeParse({
      restaurantId: admin.restaurantId,
      adminUserId: admin.adminUserId,
      customerEmail: body?.customerEmail,
      customerPhone: body?.customerPhone,
    });
    if (!parsed.success) {
      return ok({ error: "Datos de contacto invalidos.", details: parsed.error.flatten() }, 400);
    }
    await deleteAdminContact(parsed.data);
    return ok({ status: "deleted" });
  } catch (error) {
    return fail(error, "api.admin.contacts.delete");
  }
}
