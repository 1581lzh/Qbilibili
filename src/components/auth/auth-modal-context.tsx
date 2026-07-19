"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface AuthModalContextType {
  open: boolean;
  mode: "login" | "register";
  loginName: string;
  openLogin: (name?: string) => void;
  openRegister: () => void;
  close: () => void;
}

const AuthModalContext = createContext<AuthModalContextType>({
  open: false,
  mode: "login",
  loginName: "",
  openLogin: () => {},
  openRegister: () => {},
  close: () => {},
});

export function useAuthModal() {
  return useContext(AuthModalContext);
}

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginName, setLoginName] = useState("");

  const openLogin = useCallback((name?: string) => {
    setLoginName(name || "");
    setMode("login");
    setOpen(true);
  }, []);

  const openRegister = useCallback(() => {
    setMode("register");
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <AuthModalContext.Provider value={{ open, mode, loginName, openLogin, openRegister, close }}>
      {children}
    </AuthModalContext.Provider>
  );
}
