import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { maskName, maskEmail, maskPhone, maskDocument } from "@/lib/privacy";

// Contexto del "modo privacidad" del panel admin: cuando está activo,
// las funciones mask* expuestas enmascaran; cuando no, devuelven el valor tal cual.
// Así los consumidores siempre llaman maskX(valor) sin condicionar por el flag.

const STORAGE_KEY = "crashpath-privacy-mode";

const identity = (value) => value;

const PrivacyContext = createContext({
  privacyMode: false,
  togglePrivacyMode: () => {},
  maskName: identity,
  maskEmail: identity,
  maskPhone: identity,
  maskDocument: identity
});

export function PrivacyProvider({ children }) {
  const [privacyMode, setPrivacyMode] = useState(false);

  // Se lee en efecto (no en el initializer) para evitar mismatch de hidratación SSR.
  useEffect(() => {
    try {
      setPrivacyMode(sessionStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // sessionStorage no disponible: el toggle funciona solo en memoria
    }
  }, []);

  const togglePrivacyMode = useCallback(() => {
    setPrivacyMode((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignorar
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    privacyMode,
    togglePrivacyMode,
    maskName: privacyMode ? maskName : identity,
    maskEmail: privacyMode ? maskEmail : identity,
    maskPhone: privacyMode ? maskPhone : identity,
    maskDocument: privacyMode ? maskDocument : identity
  }), [privacyMode, togglePrivacyMode]);

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy() {
  return useContext(PrivacyContext);
}
