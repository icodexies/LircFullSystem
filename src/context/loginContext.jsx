import { useCallback, useMemo, useState } from "react";
import { LoginContext } from "./loginContextStore";

export function LoginProvider({ children }) {
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const openLogin = useCallback(() => setIsLoginOpen(true), []);
  const closeLogin = useCallback(() => setIsLoginOpen(false), []);

  const value = useMemo(
    () => ({ isLoginOpen, openLogin, closeLogin }),
    [isLoginOpen, openLogin, closeLogin]
  );

  return (
    <LoginContext.Provider value={value}>
      {children}
    </LoginContext.Provider>
  );
}
