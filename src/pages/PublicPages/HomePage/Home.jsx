import { lazy, Suspense } from "react";
import Hero from "./Hero";
import DeferredRender from "../../../components/ui/DeferredRender";
import { useLogin } from "../../../context/useLogin";
import { useAuth } from "../../../context/useAuth";
import { useNavigate } from "react-router-dom";

const BookCollection = lazy(() => import("./BookCollection"));
const DigitalSources = lazy(() => import("./DigitalSources"));
const About = lazy(() => import("./About"));
const LoginModal = lazy(() => import("../../../components/modals/loginModal"));

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
        <Suspense fallback={<div aria-hidden="true" className="min-h-[48rem] bg-white lg:min-h-[54rem]" />}>
          <BookCollection />
        </Suspense>
      </DeferredRender>

      <DeferredRender id="digital-sources" reserveClassName="min-h-[54rem] bg-[#0B1330] lg:min-h-[36rem]">
        <Suspense fallback={<div aria-hidden="true" className="min-h-[54rem] bg-[#0B1330] lg:min-h-[36rem]" />}>
          <DigitalSources />
        </Suspense>
      </DeferredRender>

      <DeferredRender id="about" reserveClassName="min-h-[120rem] bg-white lg:min-h-[110rem]" rootMargin="900px 0px">
        <Suspense fallback={<div aria-hidden="true" className="min-h-[120rem] bg-white lg:min-h-[110rem]" />}>
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
            brand="LIRC"
            avatarSrc="/Login/Mascot.png"
            logoLeftSrc="/Login/LIRC_Logo.webp"
            logoRightSrc="/Login/CCC_Logo.png"
          />
        </Suspense>
      )}
    </>
  );
}

export default Home;
