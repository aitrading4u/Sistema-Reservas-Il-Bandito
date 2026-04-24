export const ilBanditoConfig = {
  restaurant: {
    name: "Il Bandito",
    legalName: "Restaurante Il Bandito",
    address: "Av. de la Nucia 11, 03590 Altea, Alicante, Espana",
    phone: "+34 686 60 95 53",
    website: "https://www.ilbanditoaltea.es",
    timezone: "Europe/Madrid",
  },
  services: {
    lunch: {
      label: "Comida",
      openTime: "13:00",
      closeTime: "16:00",
      enabled: true,
    },
    dinner: {
      label: "Cena",
      openTime: "19:30",
      closeTime: "23:30",
      enabled: true,
    },
  },
  diningAreas: [
    {
      id: "interior",
      name: "Interior",
      tables: [
        { code: "I1", minCapacity: 2, maxCapacity: 2, active: true },
        { code: "I2", minCapacity: 2, maxCapacity: 4, active: true },
        { code: "I3", minCapacity: 2, maxCapacity: 4, active: true },
        { code: "I4", minCapacity: 4, maxCapacity: 6, active: true },
        { code: "I5", minCapacity: 4, maxCapacity: 8, active: true },
      ],
    },
    {
      id: "terraza",
      name: "Terraza",
      tables: [
        { code: "T1", minCapacity: 2, maxCapacity: 2, active: true },
        { code: "T2", minCapacity: 2, maxCapacity: 4, active: true },
        { code: "T3", minCapacity: 2, maxCapacity: 4, active: true },
        { code: "T4", minCapacity: 4, maxCapacity: 6, active: true },
        { code: "T5", minCapacity: 4, maxCapacity: 8, active: true },
      ],
    },
  ],
  tableCombinations: [
    { name: "I2+I3", tableCodes: ["I2", "I3"], active: true },
    { name: "T2+T3", tableCodes: ["T2", "T3"], active: true },
    { name: "I4+I5", tableCodes: ["I4", "I5"], active: true },
  ],
  durationRules: [
    { minPartySize: 1, maxPartySize: 2, durationMinutes: 90 },
    { minPartySize: 3, maxPartySize: 4, durationMinutes: 105 },
    { minPartySize: 5, maxPartySize: 6, durationMinutes: 120 },
    { minPartySize: 7, maxPartySize: 8, durationMinutes: 135 },
    { minPartySize: 9, maxPartySize: 12, durationMinutes: 150 },
  ],
  buffers: {
    beforeMinutes: 0,
    afterMinutes: 15,
  },
  publicTexts: {
    reservationTitle: "Reserva tu mesa",
    reservationSubtitle:
      "Cocina italiana con alma sarda en el centro de Altea. Reserva en pocos pasos, sin llamadas ni esperas.",
    reservationSupport:
      "Si no encuentras la hora exacta, te propondremos alternativas cercanas disponibles.",
    contactHint: "Tambien puedes reservar por telefono si lo prefieres.",
    contactPhoneLabel: "Telefono de reservas",
  },
  confirmationTexts: {
    successHeadline: "Reserva confirmada",
    successBody:
      "Grazie mille. Hemos enviado tu confirmacion por email con todos los detalles.",
    defaultInstructions:
      "Si necesitas modificar o cancelar tu reserva, contacta con el restaurante con la maxima antelacion posible.",
    cancellationBody:
      "Tu reserva ha sido cancelada correctamente. Si quieres volver a reservar, estaremos encantados de recibirte.",
  },
  seo: {
    reservations: {
      title: "Reservas | Il Bandito Altea",
      description:
        "Reserva online en Il Bandito Altea. Sistema rapido y claro para comida y cena, con confirmacion inmediata.",
      canonicalPath: "/reservas",
      ogTitle: "Reserva mesa en Il Bandito Altea",
      ogDescription:
        "Reserva en Il Bandito: cocina italiana creativa con tradicion sarda en el corazon de Altea.",
      keywords: [
        "reservas il bandito",
        "restaurante italiano altea",
        "pizzeria altea",
        "reserva mesa altea",
      ],
    },
  },
} as const;

export type IlBanditoConfig = typeof ilBanditoConfig;
