import { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";

const ModalContext = createContext(null);

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return ctx;
}

export function ModalProvider({ children }) {
  const [modalState, setModalState] = useState(null);
  const [formValues, setFormValues] = useState({});
  const resolveRef = useRef(null);
  const inputRef = useRef(null);

  const close = useCallback((result) => {
    if (resolveRef.current) {
      resolveRef.current(result);
      resolveRef.current = null;
    }
    setModalState(null);
    setFormValues({});
  }, []);

  const open = useCallback((config) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      const initialValues = {};
      if (config.fields) {
        config.fields.forEach((f) => {
          initialValues[f.name] = f.defaultValue || "";
        });
      } else if (config.isPrompt) {
        initialValues.value = config.defaultValue || "";
      }
      setFormValues(initialValues);
      setModalState(config);
    });
  }, []);

  const confirm = useCallback(
    (opts) => {
      const config = typeof opts === "string" ? { message: opts } : opts;
      return open({
        title: config.title || "Confirm Action",
        message: config.message || "Are you sure you want to proceed?",
        confirmText: config.confirmText || "Confirm",
        cancelText: config.cancelText || "Cancel",
        type: config.type || "warning",
        isConfirm: true,
      });
    },
    [open]
  );

  const alert = useCallback(
    (opts) => {
      const config = typeof opts === "string" ? { message: opts } : opts;
      return open({
        title: config.title || "Notification",
        message: config.message || "",
        confirmText: config.confirmText || "OK",
        type: config.type || "info",
        isAlert: true,
      });
    },
    [open]
  );

  const prompt = useCallback(
    (opts) => {
      const config = typeof opts === "string" ? { message: opts } : opts;
      return open({
        title: config.title || "Input Required",
        message: config.message || "",
        placeholder: config.placeholder || "",
        defaultValue: config.defaultValue || "",
        confirmText: config.confirmText || "Submit",
        cancelText: config.cancelText || "Cancel",
        type: config.type || "info",
        isPrompt: true,
        fields: config.fields || null,
        validate: config.validate || null,
      });
    },
    [open]
  );

  // Keyboard accessibility: Escape to cancel
  useEffect(() => {
    if (!modalState) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(modalState.isPrompt ? null : false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalState, close]);

  // Auto-focus input when prompt opens
  useEffect(() => {
    if (modalState?.isPrompt && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [modalState]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (modalState.fields) {
      close(formValues);
    } else if (modalState.isPrompt) {
      close(formValues.value ?? "");
    } else {
      close(true);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case "danger":
      case "delete":
        return (
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 border border-red-200">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
        );
      case "warning":
      case "logout":
        return (
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 border border-amber-200">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        );
      case "success":
        return (
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case "info":
      default:
        return (
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F1E6C8] text-[#7A5F10] border border-line">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  const getConfirmButtonClass = (type) => {
    switch (type) {
      case "danger":
      case "delete":
        return "flex-1 rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition hover:bg-red-700 shadow-sm";
      case "warning":
        return "flex-1 rounded-xl bg-amber-600 px-5 py-3 font-bold text-white transition hover:bg-amber-700 shadow-sm";
      case "success":
        return "flex-1 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white transition hover:bg-emerald-700 shadow-sm";
      case "info":
      default:
        return "flex-1 btn-gold py-3 text-[15px] font-bold shadow-sm";
    }
  };

  const ctxValue = {
    confirm,
    alert,
    prompt,
    success: (title, message) => alert({ title, message, type: "success" }),
    error: (title, message) => alert({ title, message, type: "danger" }),
    warning: (title, message) => alert({ title, message, type: "warning" }),
    info: (title, message) => alert({ title, message, type: "info" }),
  };

  return (
    <ModalContext.Provider value={ctxValue}>
      {children}

      {modalState && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm animate-fade-in"
          onClick={() => close(modalState.isPrompt ? null : false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card border border-line p-6 shadow-2xl animate-scale-up text-body relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close cross button */}
            <button
              type="button"
              onClick={() => close(modalState.isPrompt ? null : false)}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted hover:bg-neutral-200/50 hover:text-ink transition-colors"
            >
              <span className="text-xl font-bold leading-none">✕</span>
            </button>

            {/* Icon */}
            {getIcon(modalState.type)}

            {/* Title & Message */}
            <div className="mt-4 text-center">
              <h2 className="font-display text-2xl font-bold text-ink">
                {modalState.title}
              </h2>
              {modalState.message && (
                <p className="mt-2 text-sm leading-relaxed text-muted whitespace-pre-line">
                  {modalState.message}
                </p>
              )}
            </div>

            {/* Prompt form / inputs */}
            {modalState.isPrompt && (
              <form onSubmit={handleSubmit} className="mt-4 space-y-3">
                {modalState.fields ? (
                  modalState.fields.map((f, idx) => (
                    <div key={f.name}>
                      <label className="block text-xs font-semibold text-body mb-1">
                        {f.label} {f.required && <span className="text-red-600">*</span>}
                      </label>
                      {f.type === "textarea" ? (
                        <textarea
                          ref={idx === 0 ? inputRef : undefined}
                          className="input !min-h-[70px] py-2 text-sm"
                          rows={3}
                          placeholder={f.placeholder}
                          value={formValues[f.name] || ""}
                          onChange={(e) =>
                            setFormValues({
                              ...formValues,
                              [f.name]: e.target.value,
                            })
                          }
                          required={f.required}
                        />
                      ) : (
                        <input
                          ref={idx === 0 ? inputRef : undefined}
                          className="input !min-h-[42px] text-sm"
                          type={f.type || "text"}
                          placeholder={f.placeholder}
                          value={formValues[f.name] || ""}
                          onChange={(e) =>
                            setFormValues({
                              ...formValues,
                              [f.name]: e.target.value,
                            })
                          }
                          required={f.required}
                        />
                      )}
                    </div>
                  ))
                ) : (
                  <div>
                    <input
                      ref={inputRef}
                      className="input !min-h-[44px] text-sm"
                      placeholder={modalState.placeholder}
                      value={formValues.value || ""}
                      onChange={(e) =>
                        setFormValues({ ...formValues, value: e.target.value })
                      }
                      autoFocus
                    />
                  </div>
                )}

                {/* Actions inside form for prompts */}
                <div className="mt-6 flex gap-3">
                  {!modalState.isAlert && (
                    <button
                      type="button"
                      onClick={() => close(null)}
                      className="flex-1 rounded-xl border border-line bg-card px-5 py-3 font-bold text-ink transition hover:bg-neutral-100"
                    >
                      {modalState.cancelText || "Cancel"}
                    </button>
                  )}
                  <button
                    type="submit"
                    className={getConfirmButtonClass(modalState.type)}
                  >
                    {modalState.confirmText || "Submit"}
                  </button>
                </div>
              </form>
            )}

            {/* Actions for Alerts & Confirms */}
            {!modalState.isPrompt && (
              <div className="mt-6 flex gap-3">
                {!modalState.isAlert && (
                  <button
                    type="button"
                    onClick={() => close(false)}
                    className="flex-1 rounded-xl border border-line bg-card px-5 py-3 font-bold text-ink transition hover:bg-neutral-100"
                  >
                    {modalState.cancelText || "Cancel"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => close(true)}
                  className={getConfirmButtonClass(modalState.type)}
                  autoFocus
                >
                  {modalState.confirmText || "OK"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}
