// Name or card search for the borrow lookup. Typing a name (any word order,
// a middle initial first, small typos) shows matching members right under the
// box; picking one fills the library card and opens their borrow summary.
// Scanning a card still works: Enter looks the card up directly when the
// search has no matches yet (scanners type digits + Enter).
import { useEffect, useId, useRef, useState } from "react";
import { searchMembers } from "../../services/borrow/borrowService.js";
import { inputClass } from "../attendance/StaffUi.jsx";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 220;

export default function MemberSearchField({
  id,
  value,
  onChange,
  onPick,
  onLookupCard,
  holdOpen = false,
  inputRef,
}) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const wrapRef = useRef(null);
  const selectedValue = useRef(null);
  const holdOpenRef = useRef(holdOpen);
  const listId = useId();
  const query = value.trim();

  useEffect(() => {
    holdOpenRef.current = holdOpen;
  }, [holdOpen]);

  useEffect(() => {
    // Selecting a member fills the card number; that is not a new search.
    if (selectedValue.current !== null) {
      if (value === selectedValue.current) return undefined;
      selectedValue.current = null;
    }

    // Short or empty text is cleared in the change handler; no search.
    if (query.length < MIN_CHARS) return undefined;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const rows = await searchMembers(query, controller.signal);
        if (controller.signal.aborted) return;
        setItems(rows);
        setActiveIndex(rows.length ? 0 : -1);
        setSearched(true);
        setError(null);
        // A scan that is already being looked up keeps the list closed.
        if (!holdOpenRef.current) setOpen(true);
      } catch (failure) {
        if (controller.signal.aborted) return;
        setItems([]);
        setActiveIndex(-1);
        setError(failure.message);
        setOpen(true);
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, value]);

  // Clicking anywhere else closes the list.
  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function pick(member) {
    selectedValue.current = member.library_id;
    setOpen(false);
    setItems([]);
    setActiveIndex(-1);
    setSearched(false);
    onPick(member);
  }

  function handleChange(text) {
    setError(null);
    if (text.trim().length < MIN_CHARS) {
      setItems([]);
      setOpen(false);
      setSearched(false);
    }
    onChange(text);
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!items.length) return;
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex(
        (index) => (index + step + items.length) % items.length,
      );
      return;
    }

    if (event.key !== "Enter" || !query) return;

    if (open && items.length) {
      event.preventDefault();
      const member = items[activeIndex >= 0 ? activeIndex : 0];
      if (member) pick(member);
      return;
    }

    // No match yet: a card scan (digits, no spaces) opens the card directly.
    if (/\d/.test(query) && !/\s/.test(query)) {
      event.preventDefault();
      onLookupCard?.(query);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        id={id}
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
        }
        aria-label="Name or library card"
        className={inputClass}
        value={value}
        autoComplete="off"
        maxLength="120"
        placeholder="Type a name (e.g. Villanueva) or scan the card"
        onChange={(event) => {
          handleChange(event.target.value);
        }}
        onFocus={() => {
          if (items.length && query.length >= MIN_CHARS) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />

      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-slate-300 bg-surface shadow-[0_12px_30px_rgba(11,19,48,0.16)]">
          {error ? (
            <p role="alert" className="px-3 py-2.5 text-xs text-red-700">
              {error}
            </p>
          ) : items.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-slate-500">
              {searched
                ? "No member matched. Check the spelling or scan the card."
                : "Type a name to see matching members."}
            </p>
          ) : (
            <ul
              id={listId}
              role="listbox"
              aria-label="Matching members"
              className="max-h-64 overflow-y-auto py-1"
            >
              {items.map((member, index) => {
                const on = index === activeIndex;
                const role = (member.role ?? "").replaceAll("_", " ");
                const loans = Number(member.active_loans) || 0;
                const overdue = Number(member.overdue_loans) || 0;
                return (
                  <li
                    key={member.id}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={on}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pick(member)}
                    className={`cursor-pointer px-3 py-2 transition-colors ${
                      on ? "bg-tint" : ""
                    }`}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-ink">
                        {member.full_name}
                      </span>
                      <span className="shrink-0 text-[11px] font-semibold text-slate-500">
                        {member.library_id}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      {role}
                      {loans > 0
                        ? ` · ${loans} active loan${loans === 1 ? "" : "s"}`
                        : ""}
                      {overdue > 0 ? (
                        <span className="font-semibold text-rose-600">
                          {` · ${overdue} overdue`}
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
