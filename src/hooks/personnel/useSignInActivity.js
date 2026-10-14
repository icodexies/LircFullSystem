// Sign-in history with scope switch (own / all for admins). Loading derives
// from the key, matching the repository hook conventions.
import { useCallback, useEffect, useState } from "react";
import { signInActivity } from "../../services/personnel/signInService.js";

export function useSignInActivity({ scope = "own", pageSize = 10 } = {}) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ key: "", error: "", data: null });
  const key = `${scope}:${pageSize}:${revision}`;
  const loading = state.key !== key;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    signInActivity({ scope, pageSize, signal: controller.signal })
      .then((data) => {
        if (active) setState({ key, error: "", data });
      })
      .catch((error) => {
        if (active && error?.name !== "AbortError")
          setState({ key, error: error.message, data: null });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [key, pageSize, scope]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return { loading, error: state.error, data: state.data, reload };
}
