// Users (staff / librarian / admin): member records with borrow and
// attendance history, and profile edit requests.
//
// Tabs: "Member details" for everyone. Admins get "Pending requests" to
// approve or reject edits; staff/librarian get Pending / Approved / Rejected
// tabs for their own requests.
//
// Notifications deep-link here as /users?request=<id> and open that exact
// request in a window.
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../hooks/auth/useAuth.js";
import { useNotifications } from "../../../hooks/shared/useNotifications.js";
import { findMembers } from "../../../services/borrow/borrowService.js";
import {
  getMemberChangeRequests,
  getMemberOptions,
} from "../../../services/users/userService.js";
import { displayTime } from "../../../services/attendance/attendanceRules.js";
import {
  WorkspaceHeader,
  WorkspacePanel,
  StatusBadge,
  heroPrimary,
} from "../../../components/attendance/WorkspaceUi.jsx";
import {
  inputClass,
  buttonClass,
  tableButton,
} from "../../../components/attendance/StaffUi.jsx";
import Modal from "../../../components/ui/Modal.jsx";
import { LoadingBlock } from "../../../components/ui/Loading.jsx";
import MemberDetails from "../../../components/users/MemberDetails.jsx";
import MemberEditForm from "../../../components/users/MemberEditForm.jsx";
import MemberRequestModal from "../../../components/users/MemberRequestModal.jsx";
import AddUserDialog from "../../../components/users/AddUserDialog.jsx";
import Avatar from "../../../components/ui/Avatar.jsx";
import { useToast } from "../../../hooks/shared/useToast.js";

export default function Users() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const toast = useToast();
  const notifications = useNotifications();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deepLinkId = searchParams.get("request");
  const deepLinkMember = searchParams.get("member");

  // Both roles use the same four lists. Admins see every request and can
  // approve inside the window; staff see their own.
  const tabs = [
    { id: "members", label: "Member details" },
    { id: "pending", label: "Pending requests" },
    { id: "approved", label: "Approved requests" },
    { id: "rejected", label: "Rejected requests" },
  ];
  // Short descriptions so the request tabs explain themselves.
  const requestInfo = {
    pending: {
      description:
        "Waiting for approval — approving saves the edit; rejecting keeps the member record as it is.",
      empty: "Nothing is waiting for approval right now.",
    },
    approved: {
      description: "Approved edits — already saved to the member record.",
      empty: "No approved edits yet.",
    },
    rejected: {
      description: "Rejected edits — the member record stayed the same.",
      empty: "No rejected edits yet.",
    },
  };
  const [tab, setTab] = useState("members");

  // Member search + selection
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [memberRevision, setMemberRevision] = useState(0);
  const [editingProfile, setEditingProfile] = useState(null);
  const [adding, setAdding] = useState(false);

  // Options for the edit form and request names
  const [options, setOptions] = useState(null);

  // Change requests + the open request window
  const [requests, setRequests] = useState(null);
  const [requestRevision, setRequestRevision] = useState(0);
  const [reviewing, setReviewing] = useState(null);

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

  useEffect(() => {
    let active = true;
    getMemberChangeRequests(!isAdmin)
      .then((rows) => {
        if (active) setRequests(rows);
      })
      .catch(() => {
        if (active) setRequests([]);
      });
    return () => {
      active = false;
    };
  }, [isAdmin, requestRevision]);

  // Deep link from a notification: open that exact request.
  useEffect(() => {
    if (!deepLinkId || !requests) return;
    const hit = requests.find((row) => String(row.id) === String(deepLinkId));
    if (!hit) return;
    const timer = window.setTimeout(() => {
      setReviewing(hit);
      setTab(hit.status);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [deepLinkId, requests, isAdmin]);

  // Deep link support: /users?member=<id> opens that record.
  useEffect(() => {
    if (!deepLinkMember || !/^\d+$/.test(deepLinkMember)) return;
    const timer = window.setTimeout(() => {
      setTab("members");
      setSelected({ id: Number(deepLinkMember) });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [deepLinkMember]);

  function closeReview() {
    setReviewing(null);
    if (deepLinkId) navigate("/users", { replace: true });
  }

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

  async function editSaved() {
    setEditingProfile(null);
    setMemberRevision((value) => value + 1);
    setRequestRevision((value) => value + 1);
    await notifications.refresh();
    if (!isAdmin) setTab("pending");
  }

  async function requestReviewed() {
    closeReview();
    setRequestRevision((value) => value + 1);
    setMemberRevision((value) => value + 1);
    await notifications.refresh();
  }

  const visibleRequests = (requests ?? []).filter((row) => row.status === tab);
  const pendingCount = (requests ?? []).filter(
    (row) => row.status === "pending",
  ).length;

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title="Users"
        description="Member records with borrow and attendance history. Profile edits go through admin approval."
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

      <div className="space-y-2.5">
        <div className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong ${
                tab === item.id
                  ? "bg-navy text-white"
                  : "border border-slate-400 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-ink"
              }`}
            >
              {item.label}
              {item.id === "pending" && pendingCount > 0 && (
                <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
        {tab !== "members" && (
          <p className="px-1 text-[11px] leading-relaxed text-slate-400">
            Edit requests are changes to a member's details — an admin approves
            them before they are saved.
          </p>
        )}
      </div>

      {tab === "members" &&
        (selected ? (
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
        ))}

      {tab !== "members" && (
        <WorkspacePanel
          title={tabs.find((item) => item.id === tab)?.label ?? "Requests"}
          description={requestInfo[tab]?.description}
        >
          <div className="px-5 py-4 sm:px-6">
            {requests === null ? (
              <LoadingBlock label="Loading requests…" className="min-h-[8rem]" />
            ) : visibleRequests.length === 0 ? (
              <p className="text-xs text-slate-500">
                {requestInfo[tab]?.empty ?? "No requests yet."}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {visibleRequests.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">
                        {row.member} · {row.member_card}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {isAdmin ? `Requested by ${row.requested_by} · ` : ""}
                        {displayTime(row.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {row.status !== "pending" && (
                        <StatusBadge
                          tone={row.status === "approved" ? "success" : "muted"}
                        >
                          {row.status === "approved" ? "Approved" : "Rejected"}
                        </StatusBadge>
                      )}
                      <button
                        type="button"
                        className={tableButton}
                        onClick={() => {
                          setReviewing(row);
                          setTab(row.status);
                        }}
                      >
                        {isAdmin && row.status === "pending" ? "Review" : "View"}
                      </button>
                    </div>
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
            isAdmin={isAdmin}
            onCancel={() => setEditingProfile(null)}
            onSaved={editSaved}
          />
        </Modal>
      )}

      {reviewing && (
        <Modal
          title={
            isAdmin && reviewing.status === "pending"
              ? "Review edit request"
              : "Edit request details"
          }
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M9 4h6v3H9z M9 5.5H6.5A1.5 1.5 0 0 0 5 7v12a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V7a1.5 1.5 0 0 0-1.5-1.5H15 M9 13l2 2 4-4" />
            </svg>
          }
          size="lg"
          onClose={closeReview}
          dismissOnBackdrop={false}
        >
          <MemberRequestModal
            request={reviewing}
            options={options}
            isAdmin={isAdmin}
            onClose={closeReview}
            onReviewed={requestReviewed}
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
