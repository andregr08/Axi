"use client";

import { useEffect } from "react";

export default function PwaUpdater() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.ready.then((registration) => {
      registration.update();

      setInterval(() => {
        registration.update();
      }, 60000);

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;

        if (!worker) return;

        worker.addEventListener("statechange", () => {
          if (
            worker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            window.location.reload();
          }
        });
      });
    });
  }, []);

  return null;
}
