type PlaceholderPageProps = {
  title: string;
  description: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
        Coming next
      </p>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-[var(--fg)]">
        {title}
      </h1>
      <p className="text-sm leading-relaxed text-[var(--fg-muted)]">{description}</p>
    </div>
  );
}
