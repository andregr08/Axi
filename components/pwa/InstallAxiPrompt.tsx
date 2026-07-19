"use client";

import { useEffect, useState } from "react";
import {
  Download,
  Share,
  Smartphone,
  X,
} from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

function isIosDevice() {
  if (typeof window === "undefined") {
    return false;
  }

  return /iphone|ipad|ipod/i.test(
    window.navigator.userAgent
  );
}

function isStandaloneMode() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia(
      "(display-mode: standalone)"
    ).matches ||
    (
      window.navigator as Navigator & {
        standalone?: boolean;
      }
    ).standalone === true
  );
}

export default function InstallAxiPrompt() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(
      null
    );

  const [isIos, setIsIos] = useState(false);
  const [isInstalled, setIsInstalled] =
    useState(false);
  const [isVisible, setIsVisible] =
    useState(false);

  useEffect(() => {
    setIsIos(isIosDevice());
    setIsInstalled(isStandaloneMode());

    const dismissed =
      window.localStorage.getItem(
        "axi-install-dismissed"
      ) === "true";

    const handleBeforeInstallPrompt = (
      event: Event
    ) => {
      event.preventDefault();

      setInstallEvent(
        event as BeforeInstallPromptEvent
      );

      if (!dismissed) {
        setIsVisible(true);
      }
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setIsVisible(false);
      setInstallEvent(null);
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );

    window.addEventListener(
      "appinstalled",
      handleInstalled
    );

    if (
      isIosDevice() &&
      !isStandaloneMode() &&
      !dismissed
    ) {
      setIsVisible(true);
    }

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );

      window.removeEventListener(
        "appinstalled",
        handleInstalled
      );
    };
  }, []);

  const handleInstall = async () => {
    if (!installEvent) {
      return;
    }

    await installEvent.prompt();

    const result =
      await installEvent.userChoice;

    if (result.outcome === "accepted") {
      setIsVisible(false);
    }

    setInstallEvent(null);
  };

  const handleDismiss = () => {
    window.localStorage.setItem(
      "axi-install-dismissed",
      "true"
    );

    setIsVisible(false);
  };

  if (
    isInstalled ||
    !isVisible
  ) {
    return null;
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-md rounded-3xl border border-black/10 bg-white p-5 shadow-2xl">
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Cerrar"
        className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="flex items-start gap-4 pr-8">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
          <Smartphone className="h-6 w-6" />
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-500">
            AXI Mobility
          </p>

          <h2 className="mt-1 text-lg font-bold text-slate-950">
            Instala AXI en tu dispositivo
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Accede más rápido y usa AXI como una aplicación.
          </p>
        </div>
      </div>

      {isIos ? (
        <div className="mt-5 rounded-2xl bg-slate-100 p-4 text-sm leading-6 text-slate-700">
          <p className="flex items-center gap-2 font-semibold">
            <Share className="h-4 w-4" />
            En iPhone o iPad
          </p>

          <p className="mt-2">
            Presiona Compartir y después selecciona
            “Agregar a pantalla de inicio”.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleInstall}
          disabled={!installEvent}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-5 w-5" />
          Instalar AXI
        </button>
      )}
    </div>
  );
}
