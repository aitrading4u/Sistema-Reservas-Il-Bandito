import { Card } from "@/components/ui/card";
import { durationRulesSeed } from "@/modules/admin/data/admin.seed";
import { SectionHeader } from "@/modules/admin/ui/section-header";

export default function AdminDuracionPage() {
  return (
    <section className="space-y-5">
      <SectionHeader
        title="Reglas de duracion"
        description="Controla tiempo de ocupacion segun numero de comensales."
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Min pax</th>
                <th className="px-3 py-3">Max pax</th>
                <th className="px-3 py-3">Duracion</th>
                <th className="px-3 py-3">Resumen</th>
              </tr>
            </thead>
            <tbody>
              {durationRulesSeed.map((rule) => (
                <tr key={rule.id} className="border-t">
                  <td className="px-3 py-3">{rule.minParty}</td>
                  <td className="px-3 py-3">{rule.maxParty}</td>
                  <td className="px-3 py-3">{rule.durationMinutes} min</td>
                  <td className="px-3 py-3 text-muted-foreground">
                    Grupos {rule.minParty}-{rule.maxParty}: {rule.durationMinutes} minutos
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
