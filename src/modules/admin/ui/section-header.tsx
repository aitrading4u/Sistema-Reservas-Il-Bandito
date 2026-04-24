interface SectionHeaderProps {
  title: string;
  description?: string;
}

export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
      {description ? <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
    </div>
  );
}
