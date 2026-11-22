"use client";

import { useEffect } from "react";

/** Keeps the 24h chat purge running automatically while any page is open. */
export default function CleanupScheduler() {
  useEffect(() => {
    const run = () => {
      void fetch("/api/cron/cleanup", { method: "POST", cache: "no-store" }).catch(() => undefined);
    };
    run();
    const timer = setInterval(run, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);
  return null;
}
