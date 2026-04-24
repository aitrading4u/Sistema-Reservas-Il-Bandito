import type {
  AdminReservation,
  AdminTable,
  AdminTableCombination,
  DurationRule,
  ManualBlock,
  OpeningHourRule,
  SpecialClosure,
} from "@/modules/admin/domain/admin.types";

const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, "0");
const dd = String(today.getDate()).padStart(2, "0");
const todayISO = `${yyyy}-${mm}-${dd}`;

export const reservationSeed: AdminReservation[] = [
  {
    id: "r1",
    code: "IB-2F93A1",
    customerName: "Maria Torres",
    customerPhone: "+34 600 111 222",
    customerEmail: "maria@example.com",
    partySize: 2,
    date: todayISO,
    time: "13:30",
    status: "confirmed",
    service: "lunch",
    notesInternal: "Prefiere terraza",
    comments: "Sin gluten",
    tableLabel: "T4",
  },
  {
    id: "r2",
    code: "IB-77AA12",
    customerName: "John Miller",
    customerPhone: "+34 600 333 444",
    customerEmail: "john@example.com",
    partySize: 4,
    date: todayISO,
    time: "20:45",
    status: "pending",
    service: "dinner",
    notesInternal: "",
    comments: "Cumpleanos",
    tableLabel: "T8+T9",
  },
  {
    id: "r3",
    code: "IB-1CE883",
    customerName: "Andrea Ruiz",
    customerPhone: "+34 600 999 555",
    customerEmail: "andrea@example.com",
    partySize: 6,
    date: todayISO,
    time: "21:00",
    status: "seated",
    service: "dinner",
    notesInternal: "Cliente habitual",
    comments: "",
    tableLabel: "T10",
  },
];

export const tableSeed: AdminTable[] = [
  { id: "t1", code: "T1", area: "Interior", minCapacity: 2, maxCapacity: 2, isActive: true },
  { id: "t2", code: "T2", area: "Interior", minCapacity: 2, maxCapacity: 4, isActive: true },
  { id: "t3", code: "T3", area: "Terraza", minCapacity: 2, maxCapacity: 4, isActive: true },
  { id: "t4", code: "T4", area: "Terraza", minCapacity: 2, maxCapacity: 2, isActive: true },
  { id: "t5", code: "T10", area: "Interior", minCapacity: 4, maxCapacity: 8, isActive: true },
];

export const combinationSeed: AdminTableCombination[] = [
  {
    id: "c1",
    name: "T8+T9",
    tableCodes: ["T8", "T9"],
    minCapacity: 4,
    maxCapacity: 8,
    isActive: true,
  },
  {
    id: "c2",
    name: "T2+T3",
    tableCodes: ["T2", "T3"],
    minCapacity: 4,
    maxCapacity: 8,
    isActive: true,
  },
];

export const openingHoursSeed: OpeningHourRule[] = [
  { id: "o1", weekday: 2, service: "lunch", openTime: "13:00", closeTime: "16:00", active: true },
  { id: "o2", weekday: 2, service: "dinner", openTime: "19:30", closeTime: "23:30", active: true },
  { id: "o3", weekday: 3, service: "lunch", openTime: "13:00", closeTime: "16:00", active: true },
  { id: "o4", weekday: 3, service: "dinner", openTime: "19:30", closeTime: "23:30", active: true },
];

export const durationRulesSeed: DurationRule[] = [
  { id: "d1", minParty: 1, maxParty: 2, durationMinutes: 90 },
  { id: "d2", minParty: 3, maxParty: 4, durationMinutes: 105 },
  { id: "d3", minParty: 5, maxParty: 6, durationMinutes: 120 },
  { id: "d4", minParty: 7, maxParty: 10, durationMinutes: 135 },
];

export const closureSeed: SpecialClosure[] = [
  { id: "s1", date: "2026-08-15", reason: "Festivo local", fullDay: true },
  { id: "s2", date: "2026-09-01", reason: "Mantenimiento cocina", fullDay: true },
];

export const blockSeed: ManualBlock[] = [
  {
    id: "b1",
    date: todayISO,
    startTime: "20:00",
    endTime: "21:15",
    target: "T3",
    reason: "Bloqueo manual por evento",
  },
];
