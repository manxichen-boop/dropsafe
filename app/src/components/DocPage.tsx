export function DocPage({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-4xl font-semibold">{title}</h1>
      <ul className="mt-6 list-disc space-y-3 pl-5 leading-relaxed">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
