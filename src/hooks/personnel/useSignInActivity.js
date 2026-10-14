// Sign-in history with scope switch (own / all for admins) and bounded
// paging. The page number is tied to the scope, so switching scope starts at
// page one without a reset effect.
import { useCallback, useEffect, useState } from "react";
import { signInActivity } from "../../services/personnel/signInService.js";

export function useSignInActivity({ scope = "own", pageSize = 10 } = {}) {
  const [revision, setRevision] = useState(0);
  const [nav, setNav] = useState({ scope, page: 1 });
  const page = nav.scope === scope ? nav.page : 1;
  const [state, setState] = useState({ key: "", error: "", data: null });
  const key = `${scope}:${pageSize}:${page}:${revision}`;
  const loading = state.key !== key;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    signInActivity({
      scope,
      pageSize,
      offset: (page - 1) * pageSize,
      signal: controller.signal,
    })
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
  }, [key, page, pageSize, scope]);

  function nextPage() {
    setNav((current) => ({
      scope,
      page: (current.scope === scope ? current.page : 1) + 1,
    }));
  }

  function previousPage() {
    setNav((current) => ({
      scope,
      page: Math.max(1, (current.scope === scope ? current.page : 1) - 1),
    }));
  }

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return {
    loading,
    error: state.error,
    data: state.data,
    page,
    hasPrev: page > 1,
    hasNext: !loading && Boolean(state.data?.has_more),
    nextPage,
    previousPage,
    reload,
  };
}
