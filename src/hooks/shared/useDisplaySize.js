import { useContext } from "react";
import { DisplaySizeContext } from "../../context/display/displaySizeStore.js";

export function useDisplaySize() {
  const context = useContext(DisplaySizeContext);
  if (!context) throw new Error("useDisplaySize must be used inside DisplaySizeProvider");
  return context;
}
