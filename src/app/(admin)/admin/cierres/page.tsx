import { Card } from "@/components/ui/card";
import { closureSeed } from "@/modules/admin/data/admin.seed";
import { SectionHeader } from "@/modules/admin/ui/section-header";

export default function AdminCierresPage() {
  return (
    <section className="space-y-5">
      <SectionHeader
        title="Cierres especiales"
        description="Vacaciones, festivos y excepciones operativas."
      />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Fecha</th>
                <th className="px-3 py-3">Tipo</th>
                <th className="px-3 py-3">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {closureSeed.map((closure) => (
                <tr key={closure.id} className="border-t">
                  <td className="px-3 py-3 font-medium">{closure.date}</td>
                  <td className="px-3 py-3">{closure.fullDay ? "Dia completo" : "Parcial"}</td>
                  <td className="px-3 py-3">{closure.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
