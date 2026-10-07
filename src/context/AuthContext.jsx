import { useEffect, useRef, useState } from "react";
import { AuthContext } from "./authContextStore";
import { hasStoredAuthSession } from "./authSessionHint";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const clientPromise = useRef(null);
  const initializeClient = useRef(null);
  const revision = useRef(0);

  const loadProfile = async (supabase, authUser) => {
    if (!authUser) return null;

    const { data, error } = await supabase
      .from("usersData")
      .select("first_name, surname, library_id, role")
      .eq("user_id", authUser.id) // usersData.user_id = auth user id
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  };

  useEffect(() => {
    let active = true;
    let subscription;

    const sync = async (supabase, session) => {
      const currentRevision = ++revision.current;
      const u = session?.user ?? null;
      let nextProfile = null;

      try {
        nextProfile = await loadProfile(supabase, u);
      } catch (error) {
        console.error("Unable to load the signed-in user's profile.", error);
      }

      if (!active || currentRevision !== revision.current) return;
      setUser(u);
      setProfile(nextProfile);
      setRole(nextProfile?.role ?? null);
      setLoading(false);
    };

    const initialize = () => {
      if (!clientPromise.current) {
        clientPromise.current = import("../supabaseClient")
          .then(async ({ supabase }) => {
            if (!active) return null;

            const { data } = supabase.auth.onAuthStateChange((_event, session) => {
              setLoading(true);
              setTimeout(() => sync(supabase, session), 0);
            });
            subscription = data.subscription;

            try {
              const { data: sessionData, error } = await supabase.auth.getSession();
              if (error) throw error;
              await sync(supabase, sessionData.session);
            } catch (error) {
              console.error("Unable to read the current auth session.", error);
              await sync(supabase, null);
            }

            return supabase;
          })
          .catch((error) => {
            console.error("Unable to initialize authentication.", error);
            setLoading(false);
            return null;
          });
      }

      return clientPromise.current;
    };
    initializeClient.current = initialize;

    const start = () => void initialize();
    if (window.location.pathname === "/" && !hasStoredAuthSession()) {
      if ("requestIdleCallback" in window) {
        const idleId = window.requestIdleCallback(start, { timeout: 1500 });
        return () => {
          active = false;
          window.cancelIdleCallback(idleId);
          subscription?.unsubscribe();
          clientPromise.current = null;
          initializeClient.current = null;
        };
      }

      const timeoutId = window.setTimeout(start, 350);
      return () => {
        active = false;
        window.clearTimeout(timeoutId);
        subscription?.unsubscribe();
        clientPromise.current = null;
        initializeClient.current = null;
      };
    }

    start();

    return () => {
      active = false;
      subscription?.unsubscribe();
      clientPromise.current = null;
      initializeClient.current = null;
    };
  }, []);

  const login = async ({ email, password }) => {
    const supabase = await initializeClient.current?.();
    if (!supabase) throw new Error("Authentication is unavailable. Please try again.");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const logout = async () => {
    const supabase = await initializeClient.current?.();
    if (!supabase) throw new Error("Authentication is unavailable. Please try again.");
    return supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, role, profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
