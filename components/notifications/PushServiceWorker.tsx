"use client";

import { useEffect } from "react";

export function PushServiceWorker() {
  useEffect(() => {
    if (
      !("serviceWorker" in navigator)
    ) {
      console.warn(
        "Este navegador no soporta service workers."
      );
      return;
    }

    async function registerWorker() {
      try {
        const registration =
          await navigator.serviceWorker.register(
            "/sw.js",
            {
              scope: "/",
            }
          );

        console.info(
          "Service worker registrado:",
          registration.scope
        );
      } catch (error) {
        console.error(
          "Error registrando service worker:",
          error
        );
      }
    }

    void registerWorker();
  }, []);

  return null;
}
