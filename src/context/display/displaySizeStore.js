import { createContext } from "react";

export const DisplaySizeContext = createContext(null);

// The four text sizes, smallest to largest.
export const DISPLAY_SIZES = ["normal", "large", "larger", "largest"];

export const DISPLAY_LABELS = {
  normal: "Normal",
  large: "Large",
  larger: "Larger",
  largest: "Largest",
};
