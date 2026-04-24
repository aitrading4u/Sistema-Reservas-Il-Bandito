interface ReservationDetailPageProps {
  params: Promise<{ token: string }>;
}

export default async function ReservationDetailPage({
  params,
}: ReservationDetailPageProps) {
  const { token } = await params;

  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">Detalle de reserva</h1>
      <p className="text-sm text-muted-foreground">
        Token de gestión: <span className="font-mono">{token}</span>
      </p>
      <p className="text-sm text-muted-foreground">
        Aquí podrás consultar, modificar o cancelar reservas con enlace seguro.
      </p>
    </section>
  );
}
