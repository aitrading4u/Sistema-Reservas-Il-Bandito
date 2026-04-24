export type AdminReservationStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "seated"
  | "finished"
  | "no_show";

export type ServicePeriod = "lunch" | "dinner";

export interface AdminReservation {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  partySize: number;
  date: string;
  time: string;
  status: AdminReservationStatus;
  service: ServicePeriod;
  notesInternal: string;
  comments: string;
  tableLabel?: string;
}

export interface AdminTable {
  id: string;
  code: string;
  area: string;
  minCapacity: number;
  maxCapacity: number;
  isActive: boolean;
}

export interface AdminTableCombination {
  id: string;
  name: string;
  tableCodes: string[];
  minCapacity: number;
  maxCapacity: number;
  isActive: boolean;
}

export interface OpeningHourRule {
  id: string;
  weekday: number;
  service: ServicePeriod;
  openTime: string;
  closeTime: string;
  active: boolean;
}

export interface DurationRule {
  id: string;
  minParty: number;
  maxParty: number;
  durationMinutes: number;
}

export interface SpecialClosure {
  id: string;
  date: string;
  reason: string;
  fullDay: boolean;
}

export interface ManualBlock {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  target: string;
  reason: string;
}
