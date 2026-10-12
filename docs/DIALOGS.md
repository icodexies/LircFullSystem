# Shared action dialogs and top-right alerts

The app uses one small dialog system in the existing navy, white and purple style. It has no animation dependency. Book detail/edit windows share the same modal foundation.

- `src/components/ui/Modal.jsx`: native modal, keyboard focus and background blocking.
- `src/components/ui/ActionDialog.jsx`: icon, message and action buttons.
- `src/context/dialogs/DialogProvider.jsx`: opens one action dialog at a time.
- `src/hooks/shared/useDialog.js`: the helper used by pages and components.

The provider already wraps the app. Import `useDialog`, then call it inside your component:

```jsx
import { useDialog } from "../../hooks/shared/useDialog.js";
const dialog = useDialog();

const accepted = await dialog.confirm({
  title: "Confirm action",
  message: "Continue with this action?",
  confirmLabel: "Accept",
  cancelLabel: "Decline",
});
if (!accepted) return; // Decline, Escape and X never approve an action.

try {
  await saveRecord(); // Your service call goes here.
  await dialog.notify({ variant: "success", message: "Record saved." });
} catch (error) {
  await dialog.notify({ variant: "error", message: error.message });
}
```

`notify` also supports `info` and `warning`, and shows the message as a **top-right alert** (see below) instead of a blocking dialog. `confirm` supports custom labels and a warning style for important actions. Keep a component's busy state true while awaiting confirmation and saving, so repeated clicks cannot send duplicate writes.

For three choices:

```jsx
const choice = await dialog.choose({
  title: "Unsaved changes",
  message: "Save before closing?",
  variant: "warning",
  actions: [
    { label: "Keep editing", value: "cancel", autoFocus: true },
    { label: "Discard changes", value: "discard" },
    { label: "Save changes", value: "save", primary: true },
  ],
});
// Returns "cancel", "discard", "save", or null when dismissed.
```

## Top-right alerts (toasts)

Success and failure messages never appear inside the page. They slide into the top-right corner as alert cards with four states: **success (green), error (red), warning (amber), information (blue)** — each with an icon, a colored border and a × close button.

- `src/components/ui/Toast.jsx`: the alert card design.
- `src/context/toasts/ToastProvider.jsx`: stacks alerts (up to 4), auto-dismisses each after 6 seconds, and keeps the layer above every open modal.
- `src/hooks/shared/useToast.js`: the shared helper.

```jsx
import { useToast } from "../../hooks/shared/useToast.js";
const toast = useToast();

toast.success("Time in recorded.");
toast.error("Library card not found.", "Not recorded");
toast.show({ variant: "info", title: "Information", message: "...", duration: 0 });
```

`duration: 0` keeps the alert open until the reader closes it; the filter help uses this. Scanner time-in/time-out results and table checkout results use the same alerts, so the operator sees the outcome without it interrupting the workflow.

Connected flows: enrollment save, book save, unsaved book close, period save, global semester activation, filter help and scanner results. Declining keeps the form's values. Errors leave the form available for correction. Success is shown after the service reports success.

These dialogs ask the operator what they intend to do. Database permissions and validation still enforce what they are allowed to do.

## Verification on 9 October 2026

Browser checks used an isolated local demo client: cancellation keeps form values, Escape cancels, initial focus goes to Cancel, Tab stays within the modal, confirmation precedes a save, success follows a completed save, and a failed save preserves the form. Accept/decline and information messages were checked. Nested book editing passed Keep editing, Discard and Save-from-close checks. Semester activation passed cancel/confirm checks and shows an outside-date warning. No real records were edited by these browser checks.

Browser testing also found and fixed an enrollment-page loading crash when both the selected student and semester were initially missing. Project rule tests and isolated PostgreSQL checks cover the 1–4 restriction, legacy review, returning students and historical checkout.
