import { useEffect, useMemo, useState } from "react";
import { AuthContext } from "./authContextStore";
import { hasStoredAuthSession } from "./authSessionHint";
import { getSupabase, getUserProfile, login, logout } from "../services/authService";

const emptyProfile = { userId: null, data: null, error: null };

export function AuthProvider({ children }) {
  const [session, setSession] = useState({ user: null, loading: true, error: null });
  const [profileState, setProfileState] = useState(emptyProfile);
  const userId = session.user?.id ?? null;

  useEffect(() => {
    let active = true;
    let subscription;
    let syncTimer;
    let sessionRequest = 0;

    const updateSession = (nextSession) => {
      const user = nextSession?.user ?? null;
      setSession({ user, loading: false, error: null });
      if (!user) setProfileState(emptyProfile);
    };

    const initialize = async () => {
      try {
        const supabase = await getSupabase();
        if (!active) return;
        // Read this tab's session: another tab may broadcast a session it doesn't share.
        // Keep the listener synchronous and do Supabase work after it returns.
        const { data } = supabase.auth.onAuthStateChange(() => {
          if (!active) return;
          const request = ++sessionRequest;
          window.clearTimeout(syncTimer);
          syncTimer = window.setTimeout(async () => {
            if (!active) return;
            try {
              const { data: current, error } = await supabase.auth.getSession();
              if (error) throw error;
              if (active && request === sessionRequest) updateSession(current.session);
            } catch (error) {
              if (active && request === sessionRequest) {
                setSession({ user: null, loading: false, error: error.message });
                setProfileState(emptyProfile);
              }
            }
          }, 0);
        });
        subscription = data.subscription;
      } catch (error) {
        if (active) setSession({ user: null, loading: false, error: error.message });
      }
    };

    let cancelStart = () => {};
    if (window.location.pathname === "/" && !hasStoredAuthSession()) {
      if ("requestIdleCallback" in window) {
        const id = window.requestIdleCallback(() => void initialize(), { timeout: 1500 });
        cancelStart = () => window.cancelIdleCallback(id);
      } else {
        const id = window.setTimeout(() => void initialize(), 350);
        cancelStart = () => window.clearTimeout(id);
      }
    } else {
      void initialize();
    }

    return () => {
      active = false;
      cancelStart();
      window.clearTimeout(syncTimer);
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    let active = true;

    getUserProfile(userId, controller.signal)
      .then((data) => {
        if (active) setProfileState({ userId, data, error: null });
      })
      .catch((error) => {
        if (!active) return;
        console.error("Unable to load the library profile.", error);
        setProfileState({
          userId,
          data: null,
          error: "We couldn't load your library profile. Please contact the library if this continues.",
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [userId]);

  // An old user's profile must never appear while the next user's request is pending.
  const profile = userId && profileState.userId === userId ? profileState.data : null;
  const loading = session.loading || Boolean(userId && profileState.userId !== userId);
  const profileError = userId && profileState.userId === userId ? profileState.error : null;
  const value = useMemo(() => ({
    user: session.user,
    profile,
    role: profile?.role ?? null,
    loading,
    error: session.error || profileError,
    login,
    logout,
  }), [session.user, session.error, profile, loading, profileError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
