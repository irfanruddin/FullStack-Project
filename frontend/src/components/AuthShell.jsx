import { Link } from "react-router-dom";

// Black panel on the left, form on the right (login, sign up, forgot password)
export default function AuthShell({ title1, title2, sub, foot, children }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-ink text-cream p-20">
        <Link to="/" className="font-display text-3xl font-bold">UrbanCart</Link>
        <div>
          <h1 className="font-display text-5xl leading-tight">{title1}<br />{title2}</h1>
          <p className="mt-6 text-lg text-[#CFC6AE] max-w-md">{sub}</p>
        </div>
        <p className="text-sm text-[#CFC6AE]">{foot}</p>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[440px]">{children}</div>
      </div>
    </div>
  );
}

export function RoleSwitch({ role, setRole }) {
  return (
    <div className="grid grid-cols-2 rounded-xl border border-line bg-card p-1 mb-8">
      {["customer", "seller"].map((r) => (
        <button key={r} type="button" onClick={() => setRole(r)}
          className={`rounded-lg py-2.5 text-[15px] capitalize ${role === r ? "bg-ink text-cream font-bold" : "text-muted font-medium"}`}>
          {r}
        </button>
      ))}
    </div>
  );
}
