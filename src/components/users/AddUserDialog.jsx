// Add User window: one member with the form (Individual) or many at once
// with a CSV file (Bulk CSV Upload). Both tabs use the same rules; the
// database checks everything again on save.
import { useState } from "react";
import Modal from "../ui/Modal.jsx";
import AddUserForm from "./AddUserForm.jsx";
import BulkUserUpload from "./BulkUserUpload.jsx";

const TABS = [
  { id: "individual", label: "Individual" },
  { id: "bulk", label: "Bulk CSV Upload" },
];

export default function AddUserDialog({ onClose, onSaved }) {
  const [tab, setTab] = useState("individual");
  return (
    <Modal
      title="Add User"
      description="Add one member with the form, or many at once with a CSV file."
      icon={
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <circle cx="9" cy="8" r="3.5" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0 M18 8v6 M15 11h6" />
        </svg>
      }
      size="xl"
      dismissOnBackdrop={false}
      onClose={onClose}
    >
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4A86] ${
                tab === item.id
                  ? "bg-[#0B1330] text-white"
                  : "border border-slate-400 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-[#0B1330]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {/* Both tabs stay mounted so switching never loses typed input. */}
        <div className={tab === "individual" ? "" : "hidden"}>
          <AddUserForm onClose={onClose} onSaved={onSaved} />
        </div>
        <div className={tab === "bulk" ? "" : "hidden"}>
          <BulkUserUpload onSaved={onSaved} />
        </div>
      </div>
    </Modal>
  );
}
