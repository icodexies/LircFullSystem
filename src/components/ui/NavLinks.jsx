import { NavLink } from "react-router-dom";

const variants = {
  // Over images / dark backgrounds (header, hero, footer card)
  glass: {
    link: ({ isActive }) =>
      isActive
        ? "border border-white/25 bg-white/15 font-semibold text-white"
        : "border border-transparent font-medium text-white/75 hover:bg-white/10 hover:text-white",

    ghost: () =>
      "font-semibold text-white/85 hover:-translate-y-0.5 hover:text-white",

    button: () =>
      "border border-white/30 bg-white/10 font-semibold text-white backdrop-blur-md hover:bg-white hover:text-[#0B1330] active:scale-95",
  },

  // Over white backgrounds
  light: {
    link: ({ isActive }) =>
      isActive
        ? "border border-[#0B1330] bg-[#0B1330] font-semibold text-white"
        : "border border-transparent font-medium text-slate-600 hover:bg-slate-100 hover:text-[#0B1330]",

    ghost: () =>
      "font-semibold text-[#0B1330] hover:-translate-y-0.5 hover:text-sky-600",

    button: () =>
      "bg-[#0B1330] font-semibold text-white hover:bg-sky-500 active:scale-95",
  },
};

// Shared shape + size per variant
const base = {
  link: "inline-flex items-center rounded-full transition-all duration-300",
  ghost: "inline-flex items-center transition-all duration-300",
  button: "inline-flex items-center gap-2 rounded-full transition-all duration-300",
};

const sizes = {
  md: {
    link: "px-4 py-2 text-sm",
    ghost: "px-4 py-2 text-sm",
    button: "px-6 py-2.5 text-sm",
  },
  sm: {
    link: "px-3 py-1 text-xs",
    ghost: "px-2.5 py-1 text-xs",
    button: "px-4 py-1.5 text-xs",
  },
};

function NavLinks({
  to,
  children,
  variant = "link",
  tone = "glass",
  size = "md",
  end = true,
  className = "",
  ...rest
}) {
  const safeVariant = base[variant] ? variant : "link";
  const getState = (variants[tone] ?? variants.glass)[safeVariant];
  const sizeClass = (sizes[size] ?? sizes.md)[safeVariant];

  return (
    <NavLink
      to={to}
      end={end}
      className={(state) =>
        `${base[safeVariant]} ${sizeClass} ${getState(state)} ${className}`.trim()
      }
      {...rest}
    >
      {children}
    </NavLink>
  );
}

export default NavLinks;