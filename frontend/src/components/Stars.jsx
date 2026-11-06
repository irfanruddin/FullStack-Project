// Shows a rating like ★★★★☆ 4.5 (12). Used on cards and the product page.
export function Stars({ value = 0, count, big = false }) {
  const full = Math.round(value);
  return (
    <span className={`inline-flex items-center gap-1 ${big ? "text-xl" : "text-sm"}`}>
      <span className="text-gold-dark" aria-label={`${value} out of 5`}>{"★".repeat(full)}{"☆".repeat(5 - full)}</span>
      {count !== undefined && <span className="text-xs text-muted">{value ? value : "No ratings"} {count ? `(${count})` : ""}</span>}
    </span>
  );
}
