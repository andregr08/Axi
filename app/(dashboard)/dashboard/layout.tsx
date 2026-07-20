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
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (error) {
        console.error(
          "Error cargando rol:",
          error.message
        );

        setRole("passenger");
      } else {
        setRole(
          (data?.role as UserRole) ??
            "passenger"
        );
      }

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

      <MobileNav
        role={role}
        onLogout={handleLogout}
      />
    </div>
  );
}

