// The loading placeholder for one statistics card — the notched card shape
// with the numbered badge spot and the floor reflection. It mirrors the real
// card's anatomy (tab, notch, wrapped description lines, reflection) so the
// grid keeps its height when the numbers arrive and nothing jumps.
import { Skeleton } from "../ui/Skeleton.jsx";

const TAB = 34;
const CUT = 46;

// Same half-circle notch the real card cuts out of its body.
const notchMask = `radial-gradient(circle ${CUT}px at 50% 0, transparent ${CUT - 0.5}px, #000 ${CUT + 0.5}px)`;

export default function CardSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="relative pt-[34px]">
        <div className="absolute inset-x-[7%] top-0 h-[80px] rounded-t-[20px] bg-slate-200 ring-2 ring-slate-300" />
        <div
          className="relative flex flex-col items-center rounded-b-[20px] bg-slate-200/80 px-4 pb-5 pt-[70px]"
          style={{ WebkitMaskImage: notchMask, maskImage: notchMask }}
        >
          <Skeleton className="h-5 w-5 rounded-md" />
          <Skeleton className="mt-2 h-8 w-16" />
          <Skeleton className="mt-1.5 h-3 w-20" />
          <div className="mt-2 w-full space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <Skeleton
          className="absolute left-1/2 h-[56px] w-[56px] -translate-x-1/2 rounded-full"
          style={{ top: TAB + 4 - 28 }}
        />
      </div>
      {/* the real card's floor reflection keeps the row the same height */}
      <div
        aria-hidden="true"
        className="mt-1 h-9 rounded-t-[20px] bg-gradient-to-t from-slate-200 to-transparent"
      />
    </div>
  );
}
