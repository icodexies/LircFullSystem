import { useEffect, useRef, useState } from "react";

export default function DeferredRender({ children, reserveClassName = "", rootMargin = "200px 0px" }) {
  const [ready, setReady] = useState(false);
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
    <div ref={ref}>
      {ready ? children : <div aria-hidden="true" className={reserveClassName} />}
    </div>
  );
}
