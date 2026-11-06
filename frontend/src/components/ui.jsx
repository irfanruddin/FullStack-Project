import { useState } from "react";

export function Field({ label, error, children, hint }) {
  return (
    <div className="mb-4">
      {label && <label className="label">{label}</label>}
      {children}
      {hint && !error && <p className="text-xs text-muted mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
    </div>
  );
}

export function PasswordInput({
  value,
  onChange,
  placeholder = "Enter your password",
  autoComplete,
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        className="input pr-16"
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gold-dark"
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}

export function ErrorBox({ children }) {
  if (!children) return null;
  return (
    <div className="mb-4 rounded-lg border border-red-700 bg-[#F4D3D0] px-4 py-3 text-sm font-bold text-red-800">
      {children}
    </div>
  );
}

export function NoticeBox({ children }) {
  if (!children) return null;
  return (
    <div className="mb-4 rounded-lg border border-gold bg-[#F3E2A5] px-4 py-3 text-sm font-bold">
      {children}
    </div>
  );
}
