import React from "react";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata = { title: "shabe-mvp" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
} 