"use client";

import Link from "next/link";
import {
  ArrowRight,
  CarFront,
  Check,
  Gauge,
  Navigation,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import {
  isAdmin,
  type UserRole,
} from "@/lib/auth/roles";

interface RideActionPanelProps {
  role: UserRole;
}


export function RideActionPanel({
  role,
}: RideActionPanelProps) {
  const { t, locale } = useLanguage();
  const english = locale === "en";

  if (role === "driver") {
    return (
      <aside className="flex h-full min-h-[520px] flex-col rounded-[2rem] bg-[#0B0F19] p-6 text-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 text-black">
            <Gauge size={23} />
          </span>

          <span className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-400">
            {t("ridePanel.driver.offline")}
          </span>
        </div>

        <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          {t("ridePanel.driver.section")}
        </p>

        <h2 className="mt-2 text-3xl font-black">
          {t("ridePanel.driver.title")}
        </h2>

        <p className="mt-3 text-sm leading-6 text-slate-400">
          {t("ridePanel.driver.description")}
        </p>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm text-slate-400">
            {t("ridePanel.driver.todayEarnings")}
          </p>

          <p className="mt-2 text-4xl font-black">
            $0.00
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/5 p-4">
              <p className="text-2xl font-black">
                0
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {t("ridePanel.driver.trips")}
              </p>
            </div>

            <div className="rounded-2xl bg-white/5 p-4">
              <p className="text-2xl font-black">
                0 h
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {t("ridePanel.driver.onlineTime")}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-auto space-y-3 pt-8">
          <Link
            href="/dashboard/driver/status"
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-5 font-black text-black transition hover:bg-yellow-300"
          >
            {t(
              "ridePanel.driver.activateAvailability"
            )}

            <ArrowRight size={19} />
          </Link>

          <Link
            href="/dashboard/driver/available-trips"
            className="flex h-13 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 font-bold transition hover:bg-white/10"
          >
            {t(
              "ridePanel.driver.viewAvailableTrips"
            )}
          </Link>
        </div>
      </aside>
    );
  }

  if (isAdmin(role)) {
    return (
      <aside className="flex h-full min-h-[520px] flex-col rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-yellow-400">
            <ShieldCheck size={23} />
          </span>

          <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">
            {t("ridePanel.admin.operationActive")}
          </span>
        </div>

        <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
          {t("ridePanel.admin.section")}
        </p>

        <h2 className="mt-2 text-3xl font-black text-slate-950">
          {t("ridePanel.admin.title")}
        </h2>

        <p className="mt-3 text-sm leading-6 text-slate-500">
          {t("ridePanel.admin.description")}
        </p>

        <div className="mt-8 space-y-3">
          <Link
            href="/dashboard/admin/driver-applications"
            className="flex items-center gap-4 rounded-2xl border border-slate-100 p-4 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Check size={20} />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block font-bold">
                {t("ridePanel.admin.applications")}
              </span>

              <span className="block text-sm text-slate-500">
                {t(
                  "ridePanel.admin.applicationsDescription"
                )}
              </span>
            </span>

            <ArrowRight
              size={18}
              className="text-slate-400"
            />
          </Link>

          <Link
            href="/dashboard/admin/drivers"
            className="flex items-center gap-4 rounded-2xl border border-slate-100 p-4 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <CarFront size={20} />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block font-bold">
                {t("ridePanel.admin.drivers")}
              </span>

              <span className="block text-sm text-slate-500">
                {t(
                  "ridePanel.admin.driversDescription"
                )}
              </span>
            </span>

            <ArrowRight
              size={18}
              className="text-slate-400"
            />
          </Link>

          <Link
            href="/dashboard/admin/passengers"
            className="flex items-center gap-4 rounded-2xl border border-slate-100 p-4 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <UsersRound size={20} />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block font-bold">
                {t("ridePanel.admin.passengers")}
              </span>

              <span className="block text-sm text-slate-500">
                {t(
                  "ridePanel.admin.passengersDescription"
                )}
              </span>
            </span>

            <ArrowRight
              size={18}
              className="text-slate-400"
            />
          </Link>
        </div>

        <Link
          href="/dashboard/admin/trips"
          className="mt-auto flex h-14 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 font-black text-white transition hover:bg-slate-800"
        >
          {t(
            "ridePanel.admin.viewFullOperation"
          )}

          <ArrowRight size={19} />
        </Link>
      </aside>
    );
  }

  return (
    <aside className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-[2rem] bg-[#0B0F19] p-6 text-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
      <div className="flex items-center justify-between">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 text-black">
          <Navigation size={23} />
        </span>

        <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-200">
          {english ? "New ride" : "Nuevo viaje"}
        </span>
      </div>

      <div className="my-auto py-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          {english ? "Ride with AXI" : "Viaja con AXI"}
        </p>

        <h2 className="mt-3 max-w-sm text-3xl font-black leading-tight sm:text-4xl">
          {english ? "Request your ride in a few steps" : "Solicita tu viaje en pocos pasos"}
        </h2>

        <p className="mt-4 max-w-sm text-sm leading-7 text-slate-400">
          {english ? "Choose your pickup and destination. Then compare AXI 4 and AXI 6 using the actual price for your route." : "Elige tu origen y destino. Después podrás comparar AXI 4 y AXI 6 con el precio real de tu recorrido."}
        </p>

        <div className="mt-7 grid gap-3 text-sm text-slate-300">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 font-black text-yellow-400">
              1
            </span>
            {english ? "Select your destination" : "Selecciona tu destino"}
          </div>

          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 font-black text-yellow-400">
              2
            </span>
            {english ? "Compare vehicle types" : "Compara el tipo de vehículo"}
          </div>

          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 font-black text-yellow-400">
              3
            </span>
            {english ? "Confirm and find a driver" : "Confirma y encuentra conductor"}
          </div>
        </div>
      </div>

      <Link
        href="/dashboard/trips/new"
        className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-5 font-black text-black transition hover:bg-yellow-300"
      >
        {english ? "Request a ride" : "Solicitar viaje"}
        <ArrowRight size={19} />
      </Link>
    </aside>
  );
}