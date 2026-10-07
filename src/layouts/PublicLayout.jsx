
import { lazy, Suspense } from "react";
import { Outlet } from "react-router-dom";
import NavBar from "../components/layoutComponents/NavBar";
import DeferredRender from "../components/ui/DeferredRender";

const Footer = lazy(() => import("../components/layoutComponents/Footer"));

function PublicLayout() {
  return (
    <div className="min-h-screen">

        <NavBar />

      <main>
        <Outlet />
      </main>

      <DeferredRender id="contact" reserveClassName="min-h-[48rem] bg-[#0B1330] lg:min-h-[36rem]" rootMargin="900px 0px">
        <Suspense fallback={<div aria-hidden="true" className="min-h-[48rem] bg-[#0B1330] lg:min-h-[36rem]" />}>
          <Footer />
        </Suspense>
      </DeferredRender>
    </div>
  );
}

export default PublicLayout;

