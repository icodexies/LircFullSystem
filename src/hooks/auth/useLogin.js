import { useContext } from "react";
import { LoginContext } from "../../context/login/loginContextStore.js";

export function useLogin() {
  const context = useContext(LoginContext);
  if (!context) throw new Error("useLogin must be used inside <LoginProvider>");
  return context;
}
