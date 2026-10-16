// Path Finder — recommended books for every subject in the curriculum.
// Students browse their program's subjects and open the books in the OPAC.
// Faculty suggest books for review; librarians add books directly and
// review the suggestions.
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../../hooks/auth/useAuth.js";
import { useDialog } from "../../../hooks/shared/useDialog.js";
import { useToast } from "../../../hooks/shared/useToast.js";
import { usePathFinder } from "../../../hooks/pathfinder/usePathFinder.js";
import { ROLES } from "../../../routes/roles.js";
import { Spinner } from "../../../components/ui/Loading.jsx";
import {
  WorkspaceHeader,
  heroSecondary,
} from "../../../components/attendance/WorkspaceUi.jsx";
import CurriculumPanel from "../../../components/pathfinder/CurriculumPanel.jsx";
import SuggestionsPanel from "../../../components/pathfinder/SuggestionsPanel.jsx";
import AcquisitionsPanel from "../../../components/pathfinder/AcquisitionsPanel.jsx";
import AiRecommendModal from "../../../components/pathfinder/AiRecommendModal.jsx";
import BookPickerModal from "../../../components/pathfinder/BookPickerModal.jsx";
import BookDetails from "../../../components/catalog/BookDetails.jsx";
import { removeRecommendation } from "../../../services/pathfinder/pathFinderService.js";

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
        active
          ? "bg-navy text-white"
          : "text-slate-600 hover:bg-slate-100 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export default function PathFinder() {
  const { role } = useAuth();
  const canCurate = role === ROLES.LIBRARIAN || role === ROLES.ADMIN;
  const canSuggest = role === ROLES.FACULTY;
  const withSuggestions = canCurate || canSuggest;

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab =
    ["suggestions", "acquisitions"].includes(tabParam) && withSuggestions
      ? tabParam
      : "curriculum";

  const dialog = useDialog();
  const toast = useToast();
  const [picker, setPicker] = useState(null);
  const [bookId, setBookId] = useState(null);
  const [aiSubject, setAiSubject] = useState(null);

  const pathFinder = usePathFinder({ withSuggestions });

  const pendingCount = useMemo(() => {
    const data = pathFinder.suggestions.data;
    if (!data) return 0;
    if (data.role === "operator") return (data.pending ?? []).length;
    return (data.mine ?? []).filter((item) => item.status === "pending").length;
  }, [pathFinder.suggestions.data]);

  function showTab(next) {
    setSearchParams(
      next === "curriculum" ? {} : { tab: next },
      { replace: true },
    );
  }

  async function removeBook(subject, book) {
    const ok = await dialog.confirm({
      title: "Remove the recommended book?",
      message: `“${book.book_name}” will be taken off ${subject.course_code}'s list.`,
      confirmLabel: "Remove",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await removeRecommendation(book.recommendation_id);
      toast.success("Book removed from the subject's list.");
      pathFinder.refresh();
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title="Path Finder"
        description="Recommended books for every subject in the curriculum."
        actions={
          <button
            type="button"
            className={heroSecondary}
            onClick={pathFinder.refresh}
            disabled={pathFinder.curriculum.updating}
          >
            {pathFinder.curriculum.updating ? <Spinner size="sm" /> : null}
            Refresh
          </button>
        }
      >
        <span>
          Open a subject to see its books — borrow any title from the OPAC.
        </span>
        {canSuggest && (
          <span>Suggest a book on any subject; librarians review it first.</span>
        )}
        {canCurate && (
          <span>Add books directly, or review what faculty suggested.</span>
        )}
      </WorkspaceHeader>

      {withSuggestions && (
        <div
          role="tablist"
          aria-label="Path Finder sections"
          className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-surface p-1.5 shadow-[0_1px_2px_rgba(11,19,48,0.05)]"
        >
          <TabButton
            active={tab === "curriculum"}
            onClick={() => showTab("curriculum")}
          >
            Curriculum
          </TabButton>
          <TabButton
            active={tab === "suggestions"}
            onClick={() => showTab("suggestions")}
          >
            {canSuggest ? "My suggestions" : "Suggestions to review"}
            {pendingCount > 0 && (
              <span className="rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-navy">
                {pendingCount}
              </span>
            )}
          </TabButton>
          <TabButton
            active={tab === "acquisitions"}
            onClick={() => showTab("acquisitions")}
          >
            Acquisitions
          </TabButton>
        </div>
      )}

      {tab === "curriculum" ? (
        <CurriculumPanel
          programs={pathFinder.programs}
          programId={pathFinder.programId}
          onSelectProgram={pathFinder.selectProgram}
          curriculum={pathFinder.curriculum}
          canCurate={canCurate}
          canSuggest={canSuggest}
          onAdd={(subject) => setPicker({ subject, mode: "add" })}
          onSuggest={(subject) => setPicker({ subject, mode: "suggest" })}
          onRemove={removeBook}
          onOpenBook={setBookId}
          onAiPicks={setAiSubject}
        />
      ) : tab === "suggestions" ? (
        <SuggestionsPanel
          suggestions={pathFinder.suggestions}
          canCurate={canCurate}
          onRefresh={pathFinder.refresh}
          onOpenBook={setBookId}
        />
      ) : (
        <AcquisitionsPanel
          canCurate={canCurate}
          canSuggest={canSuggest}
        />
      )}

      {picker && (
        <BookPickerModal
          subject={picker.subject}
          mode={picker.mode}
          existingBookIds={(picker.subject.books ?? []).map(
            (book) => book.book_id,
          )}
          onClose={() => setPicker(null)}
          onDone={pathFinder.refresh}
        />
      )}

      {bookId && (
        <BookDetails id={bookId} canEdit={false} onClose={() => setBookId(null)} />
      )}

      {aiSubject && (
        <AiRecommendModal
          subject={aiSubject}
          onClose={() => setAiSubject(null)}
          onOpenBook={setBookId}
        />
      )}
    </div>
  );
}
