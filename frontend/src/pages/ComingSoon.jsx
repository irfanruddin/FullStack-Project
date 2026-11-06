// Shown for pages that later stages build (cart, orders, seller panel, admin panel...).
import { useLocation } from "react-router-dom";

export default function ComingSoon() {
  const { pathname } = useLocation();
  return (
    <div className="card mx-auto mt-10 max-w-[560px] p-10 text-center">
      <h1 className="font-display text-3xl">Coming in a later stage</h1>
      <p className="mt-3 text-muted">The page <code>{pathname}</code> is not built yet.</p>
    </div>
  );
}
