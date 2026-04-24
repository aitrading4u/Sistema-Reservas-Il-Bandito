import { ReservationsRepository } from "@/modules/reservations/infrastructure/reservations.repository";
import type {
  AdminBlockCreateInput,
  AdminCalendarQueryInput,
  AdminCalendarMonthQueryInput,
  AdminCreateReservationInput,
  AdminListReservationsInput,
  AdminUpdateReservationInput,
  AdminSettingsUpdateInput,
  AdminBlacklistCreateInput,
  AdminBlacklistListInput,
  AdminBlacklistUpdateInput,
  AdminContactListInput,
  AdminContactDeleteInput,
  AvailabilityRequest,
  CreatePublicReservationInput,
  PublicCustomerReservationsLookupInput,
} from "@/modules/reservations/application/reservation.schemas";
function repository() {
  return new ReservationsRepository();
}

export async function getPublicAvailability(query: AvailabilityRequest) {
  return repository().getAvailability(query);
}

export async function createPublicReservation(input: CreatePublicReservationInput) {
  return repository().createReservation(input);
}

export async function createAdminReservation(input: AdminCreateReservationInput) {
  return repository().createReservation(input);
}

export async function listAdminReservations(input: AdminListReservationsInput) {
  return repository().listReservations(input);
}

export async function updateAdminReservation(input: AdminUpdateReservationInput) {
  return repository().updateReservation(input);
}

export async function cancelAdminReservation(id: string, restaurantId: string) {
  return repository().cancelReservation(id, restaurantId);
}

export async function deleteAdminReservationPermanent(id: string, restaurantId: string) {
  return repository().deleteReservationPermanent(id, restaurantId);
}

export async function createAdminBlock(input: AdminBlockCreateInput) {
  return repository().createBlock(input);
}

export async function listAdminBlocks(restaurantId: string, date?: string) {
  return repository().listBlocks(restaurantId, date);
}

export async function removeAdminBlock(id: string, restaurantId: string) {
  return repository().removeBlock(id, restaurantId);
}

export async function readAdminCalendar(input: AdminCalendarQueryInput) {
  return repository().readCalendar(input);
}

export async function readAdminCalendarMonthSummary(input: AdminCalendarMonthQueryInput) {
  return repository().readCalendarMonthSummary(input);
}

export async function readAdminReservationById(id: string, restaurantId: string) {
  return repository().getReservationById(id, restaurantId);
}

export async function readAdminSettings(restaurantId: string) {
  return repository().getAdminSettings(restaurantId);
}

export async function updateAdminSettings(input: AdminSettingsUpdateInput) {
  return repository().updateAdminSettings(input);
}

export async function listAdminBlacklist(input: AdminBlacklistListInput) {
  return repository().listBlacklist(input);
}

export async function createAdminBlacklist(input: AdminBlacklistCreateInput) {
  return repository().createBlacklist(input);
}

export async function updateAdminBlacklist(input: AdminBlacklistUpdateInput) {
  return repository().updateBlacklist(input);
}

export async function listAdminBlacklistHistory(id: string, restaurantId: string) {
  return repository().listBlacklistHistory(id, restaurantId);
}

export async function listAdminContacts(input: AdminContactListInput) {
  return repository().listContacts(input);
}

export async function deleteAdminContact(input: AdminContactDeleteInput) {
  return repository().deleteContact(input);
}

export async function listPublicCustomerReservations(input: PublicCustomerReservationsLookupInput) {
  return repository().listPublicCustomerReservations(input);
}

export async function purgeRestaurantOperationalData(restaurantId: string) {
  return repository().purgeRestaurantOperationalData(restaurantId);
}
