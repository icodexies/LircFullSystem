import { lazy, Suspense } from "react";
import Hero from "../../../components/home/Hero.jsx";
import DeferredRender from "../../../components/ui/DeferredRender.jsx";
import { Spinner } from "../../../components/ui/Loading.jsx";
import { useLogin } from "../../../hooks/auth/useLogin.js";
import { useAuth } from "../../../hooks/auth/useAuth.js";
import { useNavigate } from "react-router-dom";

const BookCollection = lazy(() => import("../../../components/home/BookCollection.jsx"));
const DigitalSources = lazy(() => import("../../../components/home/DigitalSources.jsx"));
const About = lazy(() => import("../../../components/home/About.jsx"));
const LoginModal = lazy(() => import("../../../components/auth/LoginModal.jsx"));

function Home() {
  const { isLoginOpen, hasOpenedLogin, closeLogin } = useLogin();
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async ({ email, password, remember }) => {
    await login({ email, password, remember });
    closeLogin();
  };

  return (
    <>
      <Hero />

      <DeferredRender id="collection" reserveClassName="min-h-[48rem] bg-white lg:min-h-[54rem]">
        <Suspense fallback={<div aria-hidden="true" className="grid min-h-[48rem] place-items-center bg-white text-[#0B1330] lg:min-h-[54rem]"><Spinner size="lg" /></div>}>
          <BookCollection />
        </Suspense>
      </DeferredRender>

      <DeferredRender id="digital-sources" reserveClassName="min-h-[54rem] bg-[#0B1330] lg:min-h-[36rem]">
        <Suspense fallback={<div aria-hidden="true" className="grid min-h-[54rem] place-items-center bg-[#0B1330] text-white/80 lg:min-h-[36rem]"><Spinner size="lg" /></div>}>
          <DigitalSources />
        </Suspense>
      </DeferredRender>

      <DeferredRender id="about" reserveClassName="min-h-[120rem] bg-white lg:min-h-[110rem]" rootMargin="900px 0px">
        <Suspense fallback={<div aria-hidden="true" className="grid min-h-[120rem] place-items-center bg-white text-[#0B1330] lg:min-h-[110rem]"><Spinner size="lg" /></div>}>
          <About />
        </Suspense>
      </DeferredRender>

      {hasOpenedLogin && (
        <Suspense fallback={null}>
          <LoginModal
            open={isLoginOpen}
            onClose={closeLogin}
            onSubmit={handleLogin}
            onRegister={() => { closeLogin(); navigate("/register"); }}
            onForgot={() => { closeLogin(); navigate("/forgot-password"); }}
            brand="LIRC"
            avatarSrc="/images/auth/Mascot.png"
            logoLeftSrc="/images/auth/LIRC_Logo.webp"
            logoRightSrc="/images/auth/CCC_Logo.png"
          />
        </Suspense>
      )}
    </>
  );
}

export default Home;
