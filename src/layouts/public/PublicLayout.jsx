
import { lazy, Suspense } from "react";
import { Outlet } from "react-router-dom";
import NavBar from "../../components/layout/public/NavBar.jsx";
import DeferredRender from "../../components/ui/DeferredRender.jsx";
import { Spinner } from "../../components/ui/Loading.jsx";

const Footer = lazy(() => import("../../components/layout/public/Footer.jsx"));

function PublicLayout() {
  return (
    <div className="theme-light min-h-screen">

        <NavBar />

      <main>
        <Outlet />
      </main>

      <DeferredRender id="contact" reserveClassName="min-h-[48rem] bg-navy lg:min-h-[36rem]" rootMargin="900px 0px">
        <Suspense fallback={<div aria-hidden="true" className="grid min-h-[48rem] place-items-center bg-navy text-white/80 lg:min-h-[36rem]"><Spinner size="lg" /></div>}>
          <Footer />
        </Suspense>
      </DeferredRender>
    </div>
  );
}

export default PublicLayout;

