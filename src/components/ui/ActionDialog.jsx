import Modal from "./Modal.jsx";
const appearances = {
  confirm: ["?", "bg-[#F0EDFA] text-[#3B4A86]"],
  success: ["✓", "bg-green-50 text-green-700"],
  error: ["!", "bg-red-50 text-red-700"],
  info: ["i", "bg-blue-50 text-blue-700"],
  warning: ["!", "bg-amber-50 text-amber-800"],
};
export default function ActionDialog({
  title,
  message,
  variant = "info",
  actions,
  onChoose,
}) {
  const [symbol, color] = appearances[variant] ?? appearances.info;
  return (
    <Modal
      title={title}
      description={message}
      onClose={() => onChoose(null)}
      dismissOnBackdrop={false}
    >
      <div className="p-6">
        <span
          aria-hidden="true"
          className={`mb-6 flex h-12 w-12 items-center justify-center rounded-full text-2xl font-bold ${color}`}
        >
          {symbol}
        </span>
        <div className="flex flex-wrap justify-end gap-3">
          {actions.map((action) => (
            <button
              key={String(action.value)}
              type="button"
              autoFocus={action.autoFocus}
              data-modal-autofocus={action.autoFocus ? "true" : undefined}
              onClick={() => onChoose(action.value)}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4A86] ${action.primary ? "bg-[#0B1330] text-white hover:bg-[#3B4A86]" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
