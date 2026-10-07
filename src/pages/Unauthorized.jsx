import { Link } from "react-router-dom";

export default function Unauthorized() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F4FF] px-4 text-[#0B1330]">
      <div className="w-full max-w-sm rounded-3xl border-2 border-[#0B1330] bg-white p-8 text-center shadow-[8px_8px_0_#0B1330]">
        <h1 className="font-serif text-3xl font-bold">No access</h1>
        <p className="mt-2 text-sm text-[#0B1330]/60">
          Your account doesn't have permission to open this page.
        </p>
        <Link
          to="/home"
          className="mt-6 inline-block rounded-xl bg-[#0B1330] px-5 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-[0_4px_0_#3B4A86]"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}