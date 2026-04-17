import "./globals.css";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

export const metadata = {
  title: "MANTIS PPHSE",
  description: "MANTIS PPHSE Admin",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`h-full ${jakarta.variable}`}>
      <body suppressHydrationWarning className={`h-full antialiased bg-gray-50 text-gray-900 ${jakarta.className}`}>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
