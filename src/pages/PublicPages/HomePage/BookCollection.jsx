import Reveal from "../../../components/ui/Reveal";
import { useBookCollection } from "../../../hooks/useBookCollection";
import { TABS } from "../../../data/bookCollection";

const GLASS =
  "h-full rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm sm:p-6";

// The updated Reveal wraps children in an inner div that has no height,
// so `h-full` alone no longer stretches the panel. `[&>div]:h-full`
// passes the full height down to that inner wrapper.
const REVEAL_FULL = "h-full [&>div]:h-full";

/* -------------------------------------------------------------------------- */
/*                                Small pieces                                */
/* -------------------------------------------------------------------------- */

function Stars({ rating }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5 text-sm" aria-label={`${rating} out of 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={n <= Math.round(rating) ? "text-[#0B1330]" : "text-slate-300"}>
            ★
          </span>
        ))}
      </div>
      <span className="text-xs text-slate-500">{rating.toFixed(1)}</span>
    </div>
  );
}

function Cover({ book, className = "" }) {
  const base = `aspect-[2/3] rounded-md shadow-lg shadow-slate-900/25 ${className}`;

  if (book.cover) {
    return <img src={book.cover} alt={`${book.title} cover`} className={`${base} object-cover`} />;
  }

  return (
    <div
      role="img"
      aria-label={`${book.title} by ${book.author}`}
      className={`${base} flex flex-col justify-between overflow-hidden p-2.5 text-left`}
      style={{ backgroundImage: `linear-gradient(160deg, ${book.colors[0]}, ${book.colors[1]})` }}
    >
      <span className="line-clamp-4 font-[Fraunces] text-xs font-semibold leading-tight text-white sm:text-sm">
        {book.title}
      </span>
      <span className="line-clamp-1 text-[10px] text-white/70">{book.author}</span>
    </div>
  );
}

function ArrowButton({ dir, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === "prev" ? "Previous book" : "Next book"}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-300 bg-white text-[#0B1330] transition hover:border-[#0B1330] hover:bg-[#0B1330] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1330] sm:h-10 sm:w-10"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={dir === "prev" ? "M15 6l-6 6l6 6" : "M9 6l6 6l-6 6"} />
      </svg>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Carousel                                  */
/* -------------------------------------------------------------------------- */

// The selected book sits in the middle and is the biggest, neighbours shrink.
// Base sizes are the small-screen sizes; `sm:` restores the larger desktop ones.
const SLOTS = [
  { offset: -2, cls: "hidden w-20 opacity-40 sm:block sm:w-28" },
  { offset: -1, cls: "w-14 opacity-70 sm:w-32" },
  { offset: 0, cls: "w-24 sm:w-48" },
  { offset: 1, cls: "w-14 opacity-70 sm:w-32" },
  { offset: 2, cls: "hidden w-20 opacity-40 sm:block sm:w-28" },
];

function Carousel({ books, activeIndex, onSelect, onStep }) {
  const n = books.length;

  return (
    <div className="mx-auto flex w-full max-w-xs items-center justify-center gap-1 sm:max-w-none sm:gap-4">
      <ArrowButton dir="prev" onClick={() => onStep(-1)} />

      <div className="flex flex-1 items-center justify-center gap-2 py-3 sm:gap-6 sm:py-6">
        {SLOTS.map(({ offset, cls }) => {
          const book = books[(activeIndex + offset + n) % n];
          const isActive = offset === 0;

          return (
            <button
              key={book.id}
              type="button"
              onClick={() => onSelect(book.id)}
              aria-label={`Select ${book.title}`}
              aria-current={isActive}
              className={`shrink-0 rounded-md transition-all duration-1000 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1330] ${cls} ${
                isActive ? "shadow-[0_24px_50px_-12px_rgba(11,19,48,0.45)]" : "hover:opacity-100"
              }`}
            >
              <Cover book={book} className="w-full" />
            </button>
          );
        })}
      </div>

      <ArrowButton dir="next" onClick={() => onStep(1)} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                           Left: collection by genre                        */
/* -------------------------------------------------------------------------- */

function GenrePanel({ genres, genre, setGenre, books, selectedId, onSelect }) {
  return (
    <div className={GLASS}>
      <h3 className="font-[Fraunces] text-xl text-[#0B1330]">Browse by genre</h3>

      <div className="mt-4 flex flex-wrap gap-2">
        {genres.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGenre(g)}
            aria-pressed={genre === g}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              genre === g
                ? "border-[#0B1330] bg-[#0B1330] font-semibold text-white"
                : "border-slate-300 bg-white text-slate-600 hover:border-[#0B1330] hover:text-[#0B1330]"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="mt-5 grid max-h-[22rem] grid-cols-3 gap-4 overflow-y-auto p-1 sm:grid-cols-4 [scrollbar-width:thin] [scrollbar-color:#0B1330_#e2e8f0]">
        {books.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => onSelect(b.id)}
            className="group text-left focus-visible:outline-none"
          >
            <Cover
              book={b}
              className={`w-full transition ${
                b.id === selectedId
                  ? "ring-2 ring-[#0B1330] ring-offset-2 ring-offset-slate-50"
                  : "group-hover:-translate-y-1 group-focus-visible:ring-2 group-focus-visible:ring-[#0B1330]"
              }`}
            />
            <p className="mt-2 truncate text-xs font-medium text-[#0B1330]">{b.title}</p>
            <p className="truncate text-[11px] text-slate-500">{b.author}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                         Right: highlight of selected                       */
/* -------------------------------------------------------------------------- */

function HighlightPanel({ book, tab }) {
  const isPhysical = tab === "physical";

  return (
    <div className={GLASS}>
      {/* key remounts Reveal so every newly selected book animates in */}
      <Reveal key={book.id} direction="blur" duration={600} threshold={0.1} once>
        <div className="flex flex-col gap-6 sm:flex-row">
          {/* On phones the carousel already shows the cover, so hide it here */}
          <Cover book={book} className="hidden w-40 shrink-0 sm:block sm:w-44" />

          <div className="flex min-w-0 flex-col">
            <span className="w-fit rounded-full border border-[#0B1330]/25 bg-white px-2.5 py-0.5 text-xs text-[#0B1330]">
              {book.genre}
            </span>
            <h3 className="mt-3 font-[Fraunces] text-2xl leading-tight text-[#0B1330]">{book.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{book.author}</p>

            <div className="mt-3">
              <Stars rating={book.rating} />
            </div>

            <p className="mt-4 text-sm leading-relaxed text-slate-600">{book.description}</p>
            <p className="mt-3 text-xs text-slate-500">{book.info}</p>

            <button
              type="button"
              className="mt-5 w-fit rounded-full bg-[#0B1330] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#16224d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1330]"
            >
              {isPhysical ? "Reserve this book" : "Read online"}
            </button>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Section                                  */
/* -------------------------------------------------------------------------- */

function BookCollection() {
  const c = useBookCollection();

  return (
    <section id="collection" className="relative w-full overflow-hidden bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        {/* Header + tabs */}
        <Reveal
          once
          className="[&>div]:flex [&>div]:flex-col [&>div]:gap-6 sm:[&>div]:flex-row sm:[&>div]:items-end sm:[&>div]:justify-between"
        >
          <div>
            <h2 className="font-[Fraunces] text-3xl text-[#0B1330] sm:text-4xl">Book collection</h2>
            <p className="mt-2 max-w-md text-sm text-slate-500">
              Browse what the library holds, on the shelf or on your screen.
            </p>
          </div>

          <div role="tablist" aria-label="Collection type" className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-100 p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={c.tab === t.id}
                onClick={() => c.changeTab(t.id)}
                className={`rounded-full px-4 py-1.5 text-sm transition ${
                  c.tab === t.id ? "bg-[#0B1330] font-semibold text-white" : "text-slate-600 hover:text-[#0B1330]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </Reveal>

        {/* Carousel (key remounts it when the tab changes) */}
        <Reveal key={c.tab} direction="zoomUp" delay={100} duration={800} className="mt-4 sm:mt-8">
          <Carousel books={c.books} activeIndex={c.activeIndex} onSelect={c.select} onStep={c.step} />
        </Reveal>

        {/* Left: genre collection (hidden below lg), right: highlight */}
        <div className="mt-4 grid gap-6 sm:mt-8 lg:grid-cols-2">
          <Reveal
            direction="right"
            distance={48}
            delay={100}
            threshold={0.1}
            className={`${REVEAL_FULL} hidden lg:block`}
          >
            <GenrePanel
              genres={c.genres}
              genre={c.genre}
              setGenre={c.setGenre}
              books={c.genreBooks}
              selectedId={c.selected.id}
              onSelect={c.select}
            />
          </Reveal>

          <Reveal direction="left" distance={48} delay={200} threshold={0.1} className={REVEAL_FULL}>
            <HighlightPanel book={c.selected} tab={c.tab} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export default BookCollection;