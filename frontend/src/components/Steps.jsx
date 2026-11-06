// Cart > Checkout > Order placed progress line
export default function Steps({ current }) {
  const steps = ["Cart", "Checkout", "Order placed"];
  return (
    <ol className="mx-auto mb-8 flex max-w-[520px] items-center justify-center gap-3 text-sm">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current, active = n === current;
        return (
          <li key={label} className="flex items-center gap-3">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold ${done ? "border-gold bg-gold" : active ? "border-ink bg-ink text-cream" : "border-line bg-card text-muted"}`}>{n}</span>
            <span className={active ? "font-bold" : ""}>{label}</span>
            {n < steps.length && <span className={`h-0.5 w-10 ${done ? "bg-gold" : "bg-line"}`} />}
          </li>
        );
      })}
    </ol>
  );
}
