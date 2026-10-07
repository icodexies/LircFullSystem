import { useEffect, useRef, useState } from "react";

export default function DeferredRender({ children, id, reserveClassName = "", rootMargin = "200px 0px" }) {
  const [ready, setReady] = useState(() => !("IntersectionObserver" in window));
  const ref = useRef(null);

  useEffect(() => {
    if (ready || !ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setReady(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ready, rootMargin]);

  return (
    // Keep anchors available even before their section has loaded.
    <div ref={ref} id={id}>
      {ready ? children : <div aria-hidden="true" className={reserveClassName} />}
    </div>
  );
}
