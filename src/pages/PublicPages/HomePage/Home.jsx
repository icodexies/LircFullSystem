import { lazy, Suspense } from "react";
import { HeroBG, LeftSide, RightSide } from "./HeroSection";
import DeferredRender from "../../../components/ui/DeferredRender";
import { useLogin } from "../../../context/useLogin";
import { useAuth } from "../../../context/useAuth";
import { useHero } from "../../../hooks/useHero";
import { useNavigate } from "react-router-dom";

const BookCollection = lazy(() => import("./BookCollection"));
const DigitalSources = lazy(() => import("./DigitalSources"));
const About = lazy(() => import("./About"));
const LoginModal = lazy(() => import("../../../components/modals/loginModal"));

const pad = (n) => String(n + 1).padStart(2, "0");

function Home() {
  const { isLoginOpen, closeLogin } = useLogin();
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async ({ email, password }) => {
    await login({ email, password });
    closeLogin();
  };

  const {
    active,
    next,
    prev,
    setActive,
    BTN_SLANT,
    setPaused,
    slides
  } = useHero();

  return (
    <>
      {/* Hero Section */}
      <section
        className="relative -mt-24 min-h-screen w-full overflow-hidden"
        onMouseLeave={() => setPaused(false)}
      >
        <HeroBG slides={slides} active={active} />

        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#0B1330]/90 via-[#0B1330]/50 to-[#0B1330]/20"
        />

        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#0B1330]/80 via-transparent to-[#0B1330]/30"
        />

        <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col justify-between gap-10 px-6 pb-10 lg:flex-row lg:items-end lg:gap-8 lg:px-10 lg:pb-14">
          <LeftSide
            slides={slides}
            active={active}
            BTN_SLANT={BTN_SLANT}
          />

          <RightSide
            slides={slides}
            active={active}
            next={next}
            prev={prev}
            setActive={setActive}
            pad={pad}
          />
        </div>
      </section>

      <DeferredRender reserveClassName="min-h-[48rem] bg-white lg:min-h-[54rem]">
        <Suspense fallback={<div aria-hidden="true" className="min-h-[48rem] bg-white lg:min-h-[54rem]" />}>
          <BookCollection />
        </Suspense>
      </DeferredRender>

      <DeferredRender reserveClassName="min-h-[54rem] bg-[#0B1330] lg:min-h-[36rem]">
        <Suspense fallback={<div aria-hidden="true" className="min-h-[54rem] bg-[#0B1330] lg:min-h-[36rem]" />}>
          <DigitalSources />
        </Suspense>
      </DeferredRender>

      <DeferredRender reserveClassName="min-h-[120rem] bg-white lg:min-h-[110rem]" rootMargin="900px 0px">
        <Suspense fallback={<div aria-hidden="true" className="min-h-[120rem] bg-white lg:min-h-[110rem]" />}>
          <About />
        </Suspense>
      </DeferredRender>

      {isLoginOpen && (
        <Suspense fallback={null}>
          <LoginModal
            open={isLoginOpen}
            onClose={closeLogin}
            onSubmit={handleLogin}
            onRegister={() => { closeLogin(); navigate("/register"); }}
            onForgot={() => {}}
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
