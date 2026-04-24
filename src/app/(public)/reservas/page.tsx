import type { Metadata } from "next";
import { ilBanditoConfig } from "@/config/il-bandito.config";
import { PublicReservationFlow } from "@/modules/reservations/ui/public-reservation-flow";

const seo = ilBanditoConfig.seo.reservations;
const canonicalUrl = "https://reservas.ilbanditoaltea.es/reservas";

export const metadata: Metadata = {
  metadataBase: new URL("https://reservas.ilbanditoaltea.es"),
  title: seo.title,
  description: seo.description,
  keywords: [...seo.keywords],
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title: seo.ogTitle,
    description: seo.ogDescription,
    url: canonicalUrl,
    siteName: ilBanditoConfig.restaurant.name,
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: seo.ogTitle,
    description: seo.ogDescription,
  },
};

export default function ReservasPage() {
  return <PublicReservationFlow />;
}
