import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../context/useAuth";

export default function MemberLayout() {
  const { profile, role, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#F7F4FF] text-[#0B1330]">
      <header className="sticky top-0 z-20 border-b-2 border-[#0B1330] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link to="/home" className="font-serif text-xl font-bold">
            LIRC
          </Link>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-bold">
                {profile ? `${profile.first_name} ${profile.surname}` : "Scholar"}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-[#0B1330]/60">
                {role}
              </p>
            </div>
            <button
              onClick={logout}
              className="rounded-xl bg-[#0B1330] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white shadow-[0_3px_0_#3B4A86] active:translate-y-0.5"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
