import { HeroBG, LeftSide, RightSide } from "./HeroSection";
import BookCollection from "./BookCollection";
import DigitalSources from "./DigitalSources";
import About from "./About";
import LoginModal from "../../../components/modals/loginModal";
import { useLogin } from "../../../context/loginContext";
import { useHero } from "../../../hooks/useHero";

const pad = (n) => String(n + 1).padStart(2, "0");

function Home() {
  const { isLoginOpen, closeLogin } = useLogin();

  const handleLogin = async ({ email, password }) => {
    const { supabase } = await import("../../../supabaseClient");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error; // shown inside the modal
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

      {/* Book Collection Section */}
      <BookCollection />

      {/* Digital Sources Section */}
      <DigitalSources />

      {/* About Section */}
      <About />

      {/* Login Modal */}
      <LoginModal
        open={isLoginOpen}
        onClose={closeLogin}
        onSubmit={handleLogin}
        onRegister={() => {}}
        onForgot={() => {}}
        brand="LIRC"
        avatarSrc="/Login/Mascot.png"
        logoLeftSrc="/Login/LIRC_Logo.png"
        logoRightSrc="/Login/CCC_Logo.png"
      />
    </>
  );
}

export default Home;
