import { useCallback, useMemo, useState } from "react";
import { LoginContext } from "./loginContextStore.js";

export function LoginProvider({ children }) {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [hasOpenedLogin, setHasOpenedLogin] = useState(false);

  const openLogin = useCallback(() => {
    setHasOpenedLogin(true);
    setIsLoginOpen(true);
  }, []);
  const closeLogin = useCallback(() => setIsLoginOpen(false), []);

  const value = useMemo(
    () => ({ isLoginOpen, hasOpenedLogin, openLogin, closeLogin }),
    [isLoginOpen, hasOpenedLogin, openLogin, closeLogin]
  );

  return <LoginContext.Provider value={value}>{children}</LoginContext.Provider>;
}
