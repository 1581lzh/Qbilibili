"use client";

import { SessionProvider } from "next-auth/react";
import dynamic from "next/dynamic";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthModalProvider } from "@/components/auth/auth-modal-context";

const AuthModal = dynamic(() => import("@/components/auth/auth-modal").then((m) => m.AuthModal), {
  ssr: false,
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider>
        <AuthModalProvider>
          {children}
          <AuthModal />
        </AuthModalProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
