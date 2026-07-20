"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  CarFront,
  Check,
  CircleDollarSign,
  Gauge,
  MapPin,
  Navigation,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import {
  isAdmin,
  type UserRole,
} from "@/lib/auth/roles";
import { cn } from "@/utils/cn";

interface RideActionPanelProps {
  role: UserRole;
}

const vehicleOptions = [
  {
    id: "economy",
    name: "AXI",
    descriptionKey:
      "ridePanel.passenger.economyDescription",
    price: "$85",
  },
  {
    id: "comfort",
    name: "AXI Comfort",
    descriptionKey:
      "ridePanel.passenger.comfortDescription",
    price: "$115",
  },
  {
    id: "xl",
    name: "AXI XL",
    descriptionKey:
      "ridePanel.passenger.xlDescription",
    price: "$155",
  },
];

export function RideActionPanel({
  role,
}: RideActionPanelProps) {
  const { t } = useLanguage();

  const [selectedVehicle, setSelectedVehicle] =
    useState("economy");

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
    <aside className="flex h-full min-h-[520px] flex-col rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 text-black">
          <Navigation size={23} />
        </span>

        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
          {t("ridePanel.passenger.newTrip")}
        </span>
      </div>

      <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
        {t("ridePanel.passenger.section")}
      </p>

      <h2 className="mt-2 text-3xl font-black text-slate-950">
        {t("ridePanel.passenger.title")}
      </h2>

      <div className="mt-6 space-y-3">
        <div className="relative">
          <MapPin
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500"
          />

          <input
            type="text"
            placeholder={t(
              "ridePanel.passenger.currentLocation"
            )}
            className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm font-semibold outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-950/5"
          />
        </div>

        <div className="relative">
          <Navigation
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-500"
          />

          <input
            type="text"
            placeholder={t(
              "ridePanel.passenger.destination"
            )}
            className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm font-semibold outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-950/5"
          />
        </div>
      </div>

      <p className="mt-7 text-sm font-black text-slate-950">
        {t("ridePanel.passenger.chooseTrip")}
      </p>

      <div className="mt-3 space-y-2">
        {vehicleOptions.map((vehicle) => {
          const selected =
            selectedVehicle === vehicle.id;

          return (
            <button
              key={vehicle.id}
              type="button"
              onClick={() =>
                setSelectedVehicle(vehicle.id)
              }
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition",
                selected
                  ? "border-yellow-400 bg-yellow-50 ring-2 ring-yellow-400/20"
                  : "border-slate-100 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              <span
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl",
                  selected
                    ? "bg-yellow-400 text-black"
                    : "bg-slate-100 text-slate-700"
                )}
              >
                <CarFront size={20} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block font-black text-slate-950">
                  {vehicle.name}
                </span>

                <span className="block truncate text-xs text-slate-500">
                  {t(vehicle.descriptionKey)}
                </span>
              </span>

              <span className="font-black text-slate-950">
                {vehicle.price}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto pt-6">
        <div className="mb-4 flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-slate-500">
            <CircleDollarSign size={17} />

            {t("ridePanel.passenger.estimatedPrice")}
          </span>

          <span className="font-black text-slate-950">
            {
              vehicleOptions.find(
                (item) =>
                  item.id === selectedVehicle
              )?.price
            }
          </span>
        </div>

        <Link
          href="/dashboard/trips/new"
          className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 font-black text-white transition hover:bg-slate-800"
        >
          {t(
            "ridePanel.passenger.confirmDestination"
          )}

          <ArrowRight size={19} />
        </Link>
      </div>
    </aside>
  );
}
