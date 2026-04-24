import type {
  EmailLocale,
  EmailMessage,
  ReservationEmailPayload,
} from "@/modules/notifications/domain/email.types";

type Dictionary = {
  confirmationSubject: string;
  cancellationSubject: string;
  greeting: string;
  confirmationIntro: string;
  cancellationIntro: string;
  date: string;
  time: string;
  guests: string;
  phone: string;
  comments: string;
  bookingCode: string;
  instructionsTitle: string;
  defaultInstructions: string;
  footer: string;
};

const dictionary: Record<EmailLocale, Dictionary> = {
  es: {
    confirmationSubject: "Tu reserva en Il Bandito esta confirmada",
    cancellationSubject: "Tu reserva en Il Bandito ha sido cancelada",
    greeting: "Hola",
    confirmationIntro: "Gracias por reservar con nosotros. Aqui tienes los detalles:",
    cancellationIntro: "Confirmamos la cancelacion de tu reserva. Detalles:",
    date: "Fecha",
    time: "Hora",
    guests: "Personas",
    phone: "Telefono",
    comments: "Observaciones",
    bookingCode: "Codigo de reserva",
    instructionsTitle: "Instrucciones",
    defaultInstructions:
      "Si necesitas modificar la reserva, contacta con el restaurante con antelacion.",
    footer: "Il Bandito · Altea, Espana",
  },
  en: {
    confirmationSubject: "Your reservation at Il Bandito is confirmed",
    cancellationSubject: "Your reservation at Il Bandito has been cancelled",
    greeting: "Hello",
    confirmationIntro: "Thank you for your reservation. Here are your booking details:",
    cancellationIntro: "Your reservation has been cancelled. Booking details:",
    date: "Date",
    time: "Time",
    guests: "Guests",
    phone: "Phone",
    comments: "Notes",
    bookingCode: "Reservation code",
    instructionsTitle: "Instructions",
    defaultInstructions:
      "If you need to modify your reservation, please contact the restaurant in advance.",
    footer: "Il Bandito · Altea, Spain",
  },
  it: {
    confirmationSubject: "La tua prenotazione da Il Bandito e confermata",
    cancellationSubject: "La tua prenotazione da Il Bandito e stata cancellata",
    greeting: "Ciao",
    confirmationIntro: "Grazie per la prenotazione. Ecco i dettagli:",
    cancellationIntro: "Confermiamo la cancellazione della prenotazione. Dettagli:",
    date: "Data",
    time: "Ora",
    guests: "Persone",
    phone: "Telefono",
    comments: "Note",
    bookingCode: "Codice prenotazione",
    instructionsTitle: "Istruzioni",
    defaultInstructions:
      "Per modificare la prenotazione, contatta il ristorante con anticipo.",
    footer: "Il Bandito · Altea, Spagna",
  },
};

function formatDate(iso: string, locale: EmailLocale) {
  const localeMap: Record<EmailLocale, string> = {
    es: "es-ES",
    en: "en-GB",
    it: "it-IT",
  };
  return new Intl.DateTimeFormat(localeMap[locale], {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));
}

function baseTemplate(title: string, content: string, footer: string) {
  return `
  <div style="background:#f7f4f1;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#231f1c;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #ece4de;">
      <div style="height:6px;background:linear-gradient(90deg,#0b6b3a 0%, #ffffff 50%, #b4372f 100%);"></div>
      <div style="padding:24px 24px 18px;">
        <h1 style="margin:0 0 8px 0;font-size:22px;line-height:1.2;">${title}</h1>
        ${content}
      </div>
      <div style="border-top:1px solid #f0ebe7;padding:14px 24px;color:#776f68;font-size:12px;">
        ${footer}
      </div>
    </div>
  </div>`;
}

function reservationDetails(d: Dictionary, payload: ReservationEmailPayload) {
  const comments = payload.comments?.trim()
    ? `<p style="margin:4px 0;"><strong>${d.comments}:</strong> ${payload.comments}</p>`
    : "";

  const instructions = payload.instructions?.trim() || d.defaultInstructions;

  return `
    <p style="margin:0 0 14px 0;">${d.greeting} ${payload.customerName},</p>
    <div style="background:#fbf8f5;border:1px solid #eee5de;border-radius:10px;padding:14px 16px;margin:0 0 16px 0;">
      <p style="margin:4px 0;"><strong>${d.bookingCode}:</strong> ${payload.reservationCode}</p>
      <p style="margin:4px 0;"><strong>${d.date}:</strong> ${formatDate(payload.startAtISO, payload.locale)}</p>
      <p style="margin:4px 0;"><strong>${d.time}:</strong> ${formatTime(payload.startAtISO)}</p>
      <p style="margin:4px 0;"><strong>${d.guests}:</strong> ${payload.partySize}</p>
      <p style="margin:4px 0;"><strong>${d.phone}:</strong> ${payload.customerPhone}</p>
      ${comments}
    </div>
    <p style="margin:0 0 8px 0;font-weight:600;">${d.instructionsTitle}</p>
    <p style="margin:0;color:#4d4742;">${instructions}</p>
  `;
}

function reservationDetailsText(d: Dictionary, payload: ReservationEmailPayload) {
  const lines = [
    `${d.bookingCode}: ${payload.reservationCode}`,
    `${d.date}: ${formatDate(payload.startAtISO, payload.locale)}`,
    `${d.time}: ${formatTime(payload.startAtISO)}`,
    `${d.guests}: ${payload.partySize}`,
    `${d.phone}: ${payload.customerPhone}`,
  ];
  if (payload.comments?.trim()) {
    lines.push(`${d.comments}: ${payload.comments}`);
  }
  lines.push(`${d.instructionsTitle}: ${payload.instructions || d.defaultInstructions}`);
  return lines.join("\n");
}

export function buildConfirmationEmail(payload: ReservationEmailPayload): EmailMessage {
  const d = dictionary[payload.locale];
  const intro = `<p style="margin:0 0 14px 0;color:#4d4742;">${d.confirmationIntro}</p>`;
  return {
    subject: d.confirmationSubject,
    html: baseTemplate(
      d.confirmationSubject,
      `${intro}${reservationDetails(d, payload)}`,
      d.footer,
    ),
    text: `${d.confirmationSubject}\n\n${d.confirmationIntro}\n${reservationDetailsText(d, payload)}`,
  };
}

export function buildCancellationEmail(payload: ReservationEmailPayload): EmailMessage {
  const d = dictionary[payload.locale];
  const intro = `<p style="margin:0 0 14px 0;color:#4d4742;">${d.cancellationIntro}</p>`;
  return {
    subject: d.cancellationSubject,
    html: baseTemplate(
      d.cancellationSubject,
      `${intro}${reservationDetails(d, payload)}`,
      d.footer,
    ),
    text: `${d.cancellationSubject}\n\n${d.cancellationIntro}\n${reservationDetailsText(d, payload)}`,
  };
}
