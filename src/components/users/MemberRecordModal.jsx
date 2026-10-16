// A member's record as a window — the same record the Users page shows,
// wrapped in the shared Modal so statistics and Path Finder shortcuts open it
// in place instead of navigating away from the page.
import Modal from "../ui/Modal.jsx";
import MemberDetails from "./MemberDetails.jsx";

function PersonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}

export default function MemberRecordModal({ memberId, onClose }) {
  return (
    <Modal
      title="Member record"
      description="Details, borrow history and attendance history."
      icon={<PersonIcon />}
      size="xl"
      onClose={onClose}
    >
      <div className="px-5 py-5 sm:px-6">
        <MemberDetails member={{ id: memberId }} showActions={false} />
      </div>
    </Modal>
  );
}
