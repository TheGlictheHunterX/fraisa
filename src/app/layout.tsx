import type { Metadata } from "next";
import CleanupScheduler from "@/components/CleanupScheduler";
import "./globals.css";

export const metadata: Metadata = {
  title: "GetBoth.tn — student freelance shifts & business subscriptions",
  description: "Students find paid micro-shifts and track wallet earnings. Businesses manage offers, work status, payouts and subscriptions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <CleanupScheduler />
        {children}
      </body>
    </html>
  );
}
