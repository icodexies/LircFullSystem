// The loading placeholder for one statistics card — the notched card shape
// with the numbered badge spot, used by the operator page and the member
// page while their first load is in flight.
import { Skeleton } from "../ui/Skeleton.jsx";

export default function CardSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="relative pt-[34px]">
        <div className="absolute inset-x-[7%] top-0 h-[80px] rounded-t-[20px] bg-slate-200 ring-2 ring-slate-300" />
        <div className="relative flex flex-col items-center rounded-b-[20px] bg-slate-200/80 px-4 pb-5 pt-[70px]">
          <Skeleton className="h-5 w-5 rounded-md" />
          <Skeleton className="mt-2 h-6 w-16" />
          <Skeleton className="mt-1.5 h-3 w-14" />
          <Skeleton className="mt-2 h-3 w-28" />
        </div>
        <Skeleton className="absolute left-1/2 top-[10px] h-[56px] w-[56px] -translate-x-1/2 rounded-full" />
      </div>
    </div>
  );
}
