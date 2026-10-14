import { useContext } from "react";
import { ScannerContext } from "../../context/scanner/scannerContextStore.js";
export function useScanner() {
  const scanner = useContext(ScannerContext);
  if (!scanner) throw new Error("useScanner requires ScannerProvider.");
  return scanner;
}
