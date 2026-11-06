export default function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).slice(
    Math.max(0, page - 3),
    page + 2,
  );
  const base = "min-w-[40px] h-10 rounded-lg px-3 text-sm";
  return (
    <div className="mt-8 flex flex-wrap gap-2">
      {nums.map((n) => (
        <button
          key={n}
          onClick={() => onPage(n)}
          className={`${base} ${n === page ? "bg-gold font-bold" : "border border-line bg-card"}`}
        >
          {n}
        </button>
      ))}
      {page < pages && (
        <button
          onClick={() => onPage(page + 1)}
          className={`${base} border border-line bg-card font-bold`}
        >
          Next
        </button>
      )}
    </div>
  );
}
