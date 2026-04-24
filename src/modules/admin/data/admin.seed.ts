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

/** Inventario de códigos para el plano admin (Sala, barra y terraza). */
export const floorTableInventory = {
  sala: ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11"],
  barra: ["B1", "B2", "B3", "B4"],
  terraza: [
    "T1",
    "T2",
    "T3",
    "T4",
    "T5",
    "T6",
    "T7",
    "T8",
    "T9",
    "T10",
    "T11",
    "T12",
    "T13",
    "T14",
    "T15",
  ],
} as const;

export const tableSeed: AdminTable[] = [
  ...floorTableInventory.sala.map((code, i) => ({
    id: `seed-${code}`,
    code,
    area: "Interior" as const,
    minCapacity: 2,
    maxCapacity: 4,
    isActive: true,
  })),
  ...floorTableInventory.barra.map((code) => ({
    id: `seed-${code}`,
    code,
    area: "Interior" as const,
    minCapacity: 1,
    maxCapacity: 2,
    isActive: true,
  })),
  ...floorTableInventory.terraza.map((code) => ({
    id: `seed-${code}`,
    code,
    area: "Terraza" as const,
    minCapacity: 2,
    maxCapacity: 4,
    isActive: true,
  })),
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
