"use client";

import { useEffect, useState } from "react";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import { MobileNav } from "@/components/layout/MobileNav";
import { Navbar } from "@/components/layout/Navbar";
import {
  Sidebar,
} from "@/components/layout/Sidebar";
import type { UserRole } from "@/lib/auth/roles";
import { PushServiceWorker } from "@/components/notifications/PushServiceWorker";
import AIFloatingButton from "@/components/ai/AIFloatingButton";
import AIChatPanel from "@/components/ai/AIChatPanel";
import { useAI } from "@/hooks/useAI";
import { supabase } from "@/lib/supabaseClient";

const AVAILABLE_TRIPS_PATH =
  "/dashboard/driver/available-trips";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [role, setRole] =
    useState<UserRole | null>(null);

  const [loadingRole, setLoadingRole] =
    useState(true);

  const {
    open: aiOpen,
    conversations: aiConversations,
    currentConversation: aiCurrentConversation,
    currentConversationId: aiCurrentConversationId,
    messages: aiMessages,
    suggestions: aiSuggestions,
    isStreaming: aiIsStreaming,
    openAI,
    closeAI,
    sendMessage: sendAIMessage,
    newConversation: createAIConversation,
    selectConversation: selectAIConversation,
  } = useAI(role ?? "passenger");

  useEffect(() => {
    async function loadRole() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("role, account_active")
        .eq("id", session.user.id)
        .single();

      if (error) {
        console.error(
          "Error cargando perfil:",
          error.message
        );

        await supabase.auth.signOut();
        router.replace(
          "/login?error=account-verification"
        );
        return;
      }

      if (data?.account_active === false) {
        await supabase.auth.signOut();
        router.replace("/login?error=suspended");
        return;
      }

      setRole(
        (data?.role as UserRole) ?? "passenger"
      );

      setLoadingRole(false);
    }

    void loadRole();
  }, [router]);

  useEffect(() => {
    if (role !== "driver") {
      return;
    }

    let channel:
      | ReturnType<typeof supabase.channel>
      | null = null;

    async function startTripOfferWatcher() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        return;
      }

      const driverId = session.user.id;

      /*
       * Al abrir o recargar el dashboard,
       * revisamos si el conductor ya tiene
       * una oferta pendiente.
       */
      const { data: pendingOffer } =
        await supabase
          .from("trip_offers")
          .select("id")
          .eq("driver_id", driverId)
          .eq("status", "pending")
          .gt(
            "expires_at",
            new Date().toISOString()
          )
          .order("created_at", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle();

      if (
        pendingOffer &&
        pathname !== AVAILABLE_TRIPS_PATH
      ) {
        router.push(AVAILABLE_TRIPS_PATH);
      }

      /*
       * Escuchamos ofertas nuevas aunque el
       * conductor esté en cualquier pantalla
       * del dashboard.
       */
      channel = supabase
        .channel(
          `global-trip-offers-${driverId}-${crypto.randomUUID()}`
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "trip_offers",
            filter: `driver_id=eq.${driverId}`,
          },
          (payload) => {
            const newOffer = payload.new as {
              status?: string;
              expires_at?: string;
            };

            const isPending =
              newOffer.status === "pending";

            const isStillValid =
              !newOffer.expires_at ||
              new Date(
                newOffer.expires_at
              ).getTime() > Date.now();

            if (
              isPending &&
              isStillValid &&
              pathname !== AVAILABLE_TRIPS_PATH
            ) {
              router.push(
                AVAILABLE_TRIPS_PATH
              );
            }
          }
        )
        .subscribe();
    }

    void startTripOfferWatcher();

    return () => {
      if (channel) {
        void supabase.removeChannel(
          channel
        );
      }
    };
  }, [pathname, role, router]);


  useEffect(() => {
    /*
     * [AXI GPS GLOBAL]
     *
     * Mantiene actualizada la ubicación cuando
     * el conductor está fuera de la pantalla
     * específica de disponibilidad.
     */
    if (
      role !== "driver" ||
      pathname === "/dashboard/driver/status"
    ) {
      return;
    }

    let disposed = false;
    let driverOnline = false;
    let sendingLocation = false;

    let locationWatchId: number | null =
      null;

    let locationHeartbeatId:
      | ReturnType<typeof setInterval>
      | null = null;

    let driverChannel:
      | ReturnType<typeof supabase.channel>
      | null = null;

    let latestPosition:
      | GeolocationPosition
      | null = null;

    let lastLocationSentAt = 0;

    async function sendPosition(
      position: GeolocationPosition,
      force = false
    ) {
      if (
        disposed ||
        !driverOnline ||
        sendingLocation
      ) {
        return;
      }

      const now = Date.now();

      if (
        !force &&
        now - lastLocationSentAt < 5000
      ) {
        return;
      }

      sendingLocation = true;

      try {
        const { error } = await supabase.rpc(
          "update_driver_location",
          {
            latitude_value:
              position.coords.latitude,
            longitude_value:
              position.coords.longitude,
            speed_value:
              position.coords.speed,
            heading_value:
              position.coords.heading,
            accuracy_value:
              position.coords.accuracy,
          }
        );

        if (error) {
          console.error(
            "[AXI GPS GLOBAL] Error enviando ubicación:",
            error.message
          );

          return;
        }

        lastLocationSentAt = Date.now();
      } finally {
        sendingLocation = false;
      }
    }

    function handlePosition(
      position: GeolocationPosition
    ) {
      latestPosition = position;
      void sendPosition(position);
    }

    function handleLocationError(
      error: GeolocationPositionError
    ) {
      console.error(
        "[AXI GPS GLOBAL] Error obteniendo ubicación:",
        error.message
      );
    }

    function refreshLocation() {
      if (
        disposed ||
        !driverOnline ||
        !navigator.geolocation
      ) {
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          latestPosition = position;

          void sendPosition(
            position,
            true
          );
        },
        handleLocationError,
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        }
      );
    }

    function handleVisibilityChange() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        refreshLocation();
      }
    }

    function handleWindowFocus() {
      refreshLocation();
    }

    function handlePageShow() {
      refreshLocation();
    }

    function handleConnectionRestored() {
      refreshLocation();
    }

    function stopTracking() {
      if (
        locationWatchId !== null &&
        navigator.geolocation
      ) {
        navigator.geolocation.clearWatch(
          locationWatchId
        );

        locationWatchId = null;
      }

      if (locationHeartbeatId !== null) {
        clearInterval(
          locationHeartbeatId
        );

        locationHeartbeatId = null;
      }

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      window.removeEventListener(
        "focus",
        handleWindowFocus
      );

      window.removeEventListener(
        "pageshow",
        handlePageShow
      );

      window.removeEventListener(
        "online",
        handleConnectionRestored
      );

      latestPosition = null;
    }

    function startTracking() {
      if (
        disposed ||
        !driverOnline ||
        locationWatchId !== null
      ) {
        return;
      }

      if (!navigator.geolocation) {
        console.error(
          "[AXI GPS GLOBAL] Geolocalización no disponible."
        );

        return;
      }

      refreshLocation();

      locationWatchId =
        navigator.geolocation.watchPosition(
          handlePosition,
          handleLocationError,
          {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 5000,
          }
        );

      locationHeartbeatId =
        setInterval(() => {
          if (
            document.visibilityState !==
            "visible"
          ) {
            return;
          }

          if (latestPosition) {
            void sendPosition(
              latestPosition,
              true
            );

            return;
          }

          refreshLocation();
        }, 30000);

      document.addEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      window.addEventListener(
        "focus",
        handleWindowFocus
      );

      window.addEventListener(
        "pageshow",
        handlePageShow
      );

      window.addEventListener(
        "online",
        handleConnectionRestored
      );
    }

    async function initializeGps() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session || disposed) {
        return;
      }

      const driverId =
        session.user.id;

      const {
        data: driver,
        error,
      } = await supabase
        .from("drivers")
        .select("online")
        .eq("id", driverId)
        .maybeSingle();

      if (disposed) {
        return;
      }

      if (error) {
        console.error(
          "[AXI GPS GLOBAL] Error cargando conductor:",
          error.message
        );
      }

      driverOnline =
        Boolean(driver?.online);

      if (driverOnline) {
        startTracking();
      }

      driverChannel = supabase
        .channel(
          `global-driver-gps-${driverId}-${crypto.randomUUID()}`
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "drivers",
            filter: `id=eq.${driverId}`,
          },
          (payload) => {
            const nextDriver =
              payload.new as {
                online?: boolean;
              };

            const nextOnline =
              Boolean(
                nextDriver.online
              );

            if (
              nextOnline ===
              driverOnline
            ) {
              return;
            }

            driverOnline =
              nextOnline;

            if (driverOnline) {
              startTracking();
            } else {
              stopTracking();
            }
          }
        )
        .subscribe();
    }

    void initializeGps();

    return () => {
      disposed = true;
      stopTracking();

      if (driverChannel) {
        void supabase.removeChannel(
          driverChannel
        );
      }
    };
  }, [pathname, role]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loadingRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6F8]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-yellow-400" />

          <p className="mt-4 text-sm font-semibold text-slate-500">
            Cargando AXI.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6F8] text-slate-950">
      <Sidebar
        role={role}
        onLogout={handleLogout}
      />

      <div className="min-h-screen lg:ml-72">
        <Navbar role={role} />

        <main className="mx-auto w-full max-w-[1600px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
          {children}
        </main>
      </div>

      <PushServiceWorker />

      {!aiOpen && (
        <AIFloatingButton onClick={openAI} />
      )}

      <AIChatPanel
        open={aiOpen}
        role={role ?? "passenger"}
        conversations={aiConversations}
        currentConversation={aiCurrentConversation}
        currentConversationId={aiCurrentConversationId}
        messages={aiMessages}
        suggestions={aiSuggestions}
        isStreaming={aiIsStreaming}
        onClose={closeAI}
        onSendMessage={sendAIMessage}
        onNewConversation={createAIConversation}
        onSelectConversation={selectAIConversation}
      />

      <MobileNav
        role={role}
        onLogout={handleLogout}
      />
    </div>
  );
}

