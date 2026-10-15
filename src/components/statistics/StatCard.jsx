// StatCard — tab + notched gradient body + numbered 3D badge + floor
// reflection. Pass onClick to make the whole card open its category's
// statistics (the hover lift is the affordance). Sized to sit five per row.
const TAB = 34; // how far the pale tab sticks out above the colored body
const CUT = 46; // radius of the round notch
const BADGE = 56; // numbered circle diameter
const REFLECTION = 36; // height of the mirrored fade under the card

// Punches a half-circle out of the top-center of the body (tab shows through it).
const notchMask = `radial-gradient(circle ${CUT}px at 50% 0, transparent ${CUT - 0.5}px, #000 ${CUT + 0.5}px)`;
const fadeMask = "linear-gradient(to bottom, rgba(0,0,0,0.38), transparent 92%)";

export default function StatCard({
  label,
  value,
  description,
  icon,
  gradient,
  badge,
  index,
  onClick,
}) {
  const number = String(index ?? 0).padStart(2, "0");
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      {...(onClick ? { type: "button", onClick } : {})}
      className={`group flex flex-col transition-transform duration-200 hover:-translate-y-1 ${
        onClick
          ? "w-full cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4A86]"
          : ""
      }`}
    >
      <div
        className="relative flex flex-1 flex-col"
        style={{
          paddingTop: TAB,
          filter: "drop-shadow(0 14px 12px rgba(15,23,42,0.16))",
        }}
      >
        {/* pale tab behind the body; visible above it and through the notch */}
        <div
          className="absolute inset-x-[7%] top-0 rounded-t-[20px] bg-gradient-to-b from-white to-slate-200 ring-2 ring-slate-300 shadow-[0_4px_12px_rgba(11,19,48,0.18)]"
          style={{ height: TAB + CUT }}
        />

        {/* colored body: flat top, notch cut-out, rounded bottom */}
        <div
          className={`relative flex flex-1 flex-col items-center rounded-b-[20px] bg-gradient-to-b ${gradient} px-4 pb-5 text-center text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.18)]`}
          style={{
            paddingTop: CUT + 24,
            WebkitMaskImage: notchMask,
            maskImage: notchMask,
          }}
        >
          {badge && (
            <span className="absolute right-2.5 top-2.5 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold">
              {badge}
            </span>
          )}

          <span className="text-white/95 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>

          <p
            className="mt-2 text-2xl font-semibold leading-none"
            style={{ fontFamily: "Fraunces, Georgia, serif" }}
          >
            {value}
          </p>
          <h3 className="mt-1.5 text-[11px] font-bold uppercase tracking-wide">{label}</h3>
          <p className="mt-1.5 max-w-[12rem] text-[10px] leading-relaxed text-white/85 [text-align-last:center] [text-align:justify]">
            {description}
          </p>
        </div>

        {/* numbered 3D circle sitting in the notch */}
        <div
          className={`absolute left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-xl font-bold text-white shadow-[inset_0_2px_4px_rgba(255,255,255,0.45),0_12px_18px_-6px_rgba(0,0,0,0.35)]`}
          style={{ top: TAB + 4 - BADGE / 2, width: BADGE, height: BADGE }}
        >
          {number}
        </div>
      </div>

      {/* floor reflection: flipped bottom edge, fading out */}
      <div
        aria-hidden="true"
        className={`mt-1 rounded-t-[20px] bg-gradient-to-t ${gradient}`}
        style={{ height: REFLECTION, WebkitMaskImage: fadeMask, maskImage: fadeMask }}
      />
    </Wrapper>
  );
}


