// Users (staff / librarian / admin): member records with borrow and
// attendance history. Staff edits apply directly and are recorded in the
// activity log; there is no approval request workflow.
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../hooks/auth/useAuth.js";
import { findMembers } from "../../../services/borrow/borrowService.js";
import { getMemberOptions } from "../../../services/users/userService.js";
import {
  WorkspaceHeader,
  WorkspacePanel,
  heroPrimary,
} from "../../../components/attendance/WorkspaceUi.jsx";
import {
  inputClass,
  buttonClass,
  tableButton,
} from "../../../components/attendance/StaffUi.jsx";
import Modal from "../../../components/ui/Modal.jsx";
import MemberDetails from "../../../components/users/MemberDetails.jsx";
import MemberEditForm from "../../../components/users/MemberEditForm.jsx";
import AddUserDialog from "../../../components/users/AddUserDialog.jsx";
import Avatar from "../../../components/ui/Avatar.jsx";
import { useToast } from "../../../hooks/shared/useToast.js";

export default function Users() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deepLinkMember = searchParams.get("member");

  // Member search + selection
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [memberRevision, setMemberRevision] = useState(0);
  const [editingProfile, setEditingProfile] = useState(null);
  const [adding, setAdding] = useState(false);

  // Options for the edit form.
  const [options, setOptions] = useState(null);

  useEffect(() => {
    let active = true;
    getMemberOptions()
      .then((data) => {
        if (active) setOptions(data);
      })
      .catch(() => {
        // The selects fall back to Unassigned only.
      });
    return () => {
      active = false;
    };
  }, []);

  // Deep link support: /users?member=<id> opens that record.
  useEffect(() => {
    if (!deepLinkMember || !/^\d+$/.test(deepLinkMember)) return;
    const timer = window.setTimeout(() => {
      setSelected({ id: Number(deepLinkMember) });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [deepLinkMember]);

  async function runSearch(query) {
    if (busy) return;
    setBusy(true);
    try {
      const rows = await findMembers(query);
      setMembers(rows);
      setSelected(null);
    } catch (error) {
      toast.error(error.message, "Search failed");
    } finally {
      setBusy(false);
    }
  }

  function find(event) {
    event.preventDefault();
    void runSearch(search);
  }

  // After adding a user, refresh an open member search.
  async function userAdded() {
    if (members !== null) await runSearch(search);
  }

  function editSaved() {
    setEditingProfile(null);
    setMemberRevision((value) => value + 1);
  }

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title="Users"
        description="Member records with borrow and attendance history. Staff edits apply directly and are recorded in the activity log."
        actions={
          isAdmin ? (
            <button
              type="button"
              className={heroPrimary}
              onClick={() => setAdding(true)}
            >
              Add User
            </button>
          ) : null
        }
      />

      {selected ? (
        <WorkspacePanel
          title="Member record"
          description="Details, borrow history and attendance history."
        >
          <div className="px-5 py-5 sm:px-6">
            <MemberDetails
              key={`${selected.id}-${memberRevision}`}
              member={selected}
              onBack={() => {
                setSelected(null);
                if (deepLinkMember) navigate("/users", { replace: true });
              }}
              onEdit={(profile) => setEditingProfile(profile)}
            />
          </div>
        </WorkspacePanel>
      ) : (
        <WorkspacePanel
          title="Find a member"
          description="Search by name or library card to open a record."
        >
          <form
            onSubmit={find}
            className="flex flex-wrap items-end gap-3 border-b border-slate-100 px-5 py-4 sm:px-6"
          >
            <label className="min-w-60 flex-1">
              <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
                Name or library card
              </span>
              <input
                className={inputClass}
                maxLength="120"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="For example: Dela Cruz or 23-00123"
              />
            </label>
            <button type="submit" disabled={busy} className={buttonClass}>
              {busy ? "Searching…" : "Search"}
            </button>
          </form>
          <div className="px-5 py-4 sm:px-6">
            {members === null ? (
              <p className="text-xs text-slate-500">
                Search a member to see their record.
              </p>
            ) : members.length === 0 ? (
              <p className="text-xs text-slate-500">
                No member matched. Check the spelling or the card number.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {members.map((member) => (
                  <li
                    key={member.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar src={member.avatar_url} className="h-10 w-10" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">
                          {member.full_name}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {member.library_id} ·{" "}
                          {member.role.replaceAll("_", " ")} ·{" "}
                          {member.active_loans} active loan
                          {member.active_loans === 1 ? "" : "s"}
                          {member.overdue_loans > 0
                            ? ` · ${member.overdue_loans} overdue`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={tableButton}
                      onClick={() => setSelected(member)}
                    >
                      Open record
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </WorkspacePanel>
      )}

      {editingProfile && (
        <Modal
          title="Edit member details"
          description={`${editingProfile.full_name} · ${editingProfile.library_id}`}
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z M13.5 6.5l4 4" />
            </svg>
          }
          size="lg"
          onClose={() => setEditingProfile(null)}
          dismissOnBackdrop={false}
        >
          <MemberEditForm
            profile={editingProfile}
            options={options}
            onCancel={() => setEditingProfile(null)}
            onSaved={editSaved}
          />
        </Modal>
      )}

      {adding && (
        <AddUserDialog
          onClose={() => setAdding(false)}
          onSaved={userAdded}
        />
      )}
    </div>
  );
}
