function LogoutConfirmModal({ isOpen, onCancel, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl bg-card border border-line p-6 shadow-2xl relative text-body animate-scale-up">
        {/* Close Button */}
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted hover:bg-neutral-200/50 hover:text-ink transition-colors"
        >
          <span className="text-xl font-bold leading-none">✕</span>
        </button>

        {/* Logout Icon */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 border border-amber-200">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </div>

        {/* Message */}
        <div className="mt-4 text-center">
          <h2 className="font-display text-2xl font-bold text-ink">Confirm Logout</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Are you sure you want to log out of your UrbanCart account?
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-line bg-card px-5 py-3 font-bold text-ink transition hover:bg-neutral-100"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition hover:bg-red-700 shadow-sm"
          >
            Yes, Logout
          </button>
        </div>
      </div>
    </div>
  );
}

export default LogoutConfirmModal;
