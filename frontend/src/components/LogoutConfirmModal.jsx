function LogoutConfirmModal({ isOpen, onCancel, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        {/* Close Button */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
          >
            <span className="text-xl font-bold">✕</span>
          </button>
        </div>

        {/* Logout Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
          <span className="text-3xl">↪</span>
        </div>

        {/* Message */}
        <div className="mt-5 text-center">
          <h2 className="text-xl font-bold text-gray-900">Confirm Logout</h2>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            Are you sure you want to log out of your UrbanCart account?
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mt-7 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-gray-300 px-4 py-3 font-semibold text-gray-700 transition hover:bg-gray-100"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white transition hover:bg-red-700"
          >
            Yes, Logout
          </button>
        </div>
      </div>
    </div>
  );
}

export default LogoutConfirmModal;
