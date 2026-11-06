import { Link } from "react-router-dom";
import { useAuth } from "../../auth";

export default function SellerApplication() {
  const { user } = useAuth();
  const status = user?.seller_status || "pending";
  const rejected = status === "rejected";
  return <div className="mx-auto max-w-2xl rounded-2xl border border-line bg-card p-8 text-center shadow-sm">
    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gold/20 text-3xl">{rejected ? "!" : "✓"}</div>
    <p className="text-sm font-bold uppercase tracking-wider text-gold-dark">Seller application</p>
    <h1 className="mt-2 font-display text-3xl">{rejected ? "Application not approved" : "Application under review"}</h1>
    <p className="mt-3 text-muted">{rejected ? "Your seller application was not approved. Please contact UrbanCart support for the next steps." : "Thank you for applying to sell on UrbanCart. Your application is awaiting administrator review. Seller tools will be available after approval."}</p>
    <div className="mt-6 rounded-lg bg-cream p-4"><span className="text-sm text-muted">Current status</span><p className="mt-1 text-lg font-bold capitalize">{status}</p></div>
    <Link className="btn-outline mt-6" to="/login">Back to login</Link>
  </div>;
}
