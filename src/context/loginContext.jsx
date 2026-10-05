import { createContext, useCallback, useContext, useMemo, useState } from "react";

const LoginContext = createContext(null);

export function LoginProvider({ children }) {
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const openLogin = useCallback(() => setIsLoginOpen(true), []);
  const closeLogin = useCallback(() => setIsLoginOpen(false), []);

  const value = useMemo(
    () => ({ isLoginOpen, openLogin, closeLogin }),
    [isLoginOpen, openLogin, closeLogin]
  );

  return <LoginContext.Provider 
            value={value}>{children}
         </LoginContext.Provider>;
}

export function useLogin() {
  const ctx = useContext(LoginContext);
  if (!ctx) throw new Error("useLogin must be used inside <LoginProvider>");
  return ctx;
}