import { ReservationDetailClient } from "@/modules/admin/ui/reservation-detail-client";

interface ReservationDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReservationDetailPage({ params }: ReservationDetailPageProps) {
  const { id } = await params;
  return <ReservationDetailClient id={id} />;
}
