import type { Metadata } from "next";
import "@/styles/globals.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "DevVerse — The Ultimate Browser-Based DevOps OS",
  description: "A complete browser-based DevOps operating system with Docker, Kubernetes, GitHub, CI/CD, monitoring and more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>
          {children}
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#1a1a25",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#e8e8ed",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
