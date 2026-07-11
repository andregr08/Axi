"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  CarFront,
  CheckCircle2,
  Clock3,
  Gauge,
  LocateFixed,
  MapPin,
  Navigation,
  Power,
  Radio,
  RefreshCw,
  Route,
  Satellite,
  ShieldCheck,
  Signal,
  SignalZero,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/utils/cn";

export default function DriverStatusPage() {
  const router = useRouter();

  const [online, setOnline] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");

  const loadDriverStatus = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profile?.role !== "driver") {
      router.replace("/dashboard");
      return;
    }

    const { data: driver, error } = await supabase
      .from("drivers")
      .select("online, current_lat, current_lng")
      .eq("id", session.user.id)
      .single();

    if (error) {
      setMessage(`Error cargando estado: ${error.message}`);
    } else {
      setOnline(Boolean(driver.online));
      setLatitude(driver.current_lat);
      setLongitude(driver.current_lng);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDriverStatus();
  }, [loadDriverStatus]);

  function shareLocation() {
    setMessage("");

    if (!navigator.geolocation) {
      setMessage("Tu navegador no permite utilizar la ubicación.");
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const newLatitude = position.coords.latitude;
        const newLongitude = position.coords.longitude;
        const newAccuracy = position.coords.accuracy;

        const { error } = await supabase.rpc(
          "update_driver_location",
          {
            latitude_value: newLatitude,
            longitude_value: newLongitude,
            speed_value: position.coords.speed,
            heading_value: position.coords.heading,
            accuracy_value: newAccuracy,
          }
        );

        setLocating(false);

        if (error) {
          setMessage(`Error actualizando ubicación: ${error.message}`);
          return;
        }

        setLatitude(newLatitude);
        setLongitude(newLongitude);
        setAccuracy(newAccuracy);
        setMessage("Ubicación actualizada correctamente.");
      },
      (error) => {
        setLocating(false);

        if (error.code === error.PERMISSION_DENIED) {
          setMessage("Debes permitir el acceso al GPS.");
          return;
        }

        setMessage("No pudimos obtener tu ubicación.");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );
  }

  async function changeOnlineStatus(nextOnline: boolean) {
    setProcessing(true);
    setMessage("");

    if (
      nextOnline &&
      (latitude === null || longitude === null)
    ) {
      setProcessing(false);
      setMessage(
        "Actualiza tu ubicación antes de conectarte."
      );
      return;
    }

    const { error } = await supabase.rpc(
      "set_driver_online",
      {
        online_status: nextOnline,
      }
    );

    setProcessing(false);

    if (error) {
      setMessage(`Error: ${error.message}`);
      return;
    }

    setOnline(nextOnline);
    setMessage(
      nextOnline
        ? "Ya estás en línea y puedes recibir viajes."
        : "Ahora estás fuera de línea."
    );
  }

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="h-72 animate-pulse rounded-[2rem] bg-slate-200" />

        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="h-[430px] animate-pulse rounded-[2rem] bg-slate-200" />
          <div className="h-[430px] animate-pulse rounded-[2rem] bg-slate-200" />
        </div>
      </section>
    );
  }

  const hasLocation =
    latitude !== null && longitude !== null;

  const locationQuality =
    accuracy === null
      ? "Sin medición"
      : accuracy <= 20
        ? "Excelente"
        : accuracy <= 50
          ? "Buena"
          : "Limitada";

  return (
    <section className="space-y-8">
      <div
        className={cn(
          "relative overflow-hidden rounded-[2rem] px-6 py-8 text-white shadow-[0_25px_80px_rgba(15,23,42,0.2)] sm:px-9 sm:py-10",
          online
            ? "bg-[linear-gradient(120deg,#052e16,#166534)]"
            : "bg-[#0B0F19]"
        )}
      >
        <div
          className={cn(
            "absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl",
            online
              ? "bg-emerald-400/20"
              : "bg-yellow-400/20"
          )}
        />

        <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.18em]",
                online
                  ? "border-emerald-300/20 bg-emerald-400/15 text-emerald-300"
                  : "border-white/10 bg-white/5 text-yellow-300"
              )}
            >
              {online ? (
                <Signal size={15} />
              ) : (
                <SignalZero size={15} />
              )}

              {online
                ? "Conductor conectado"
                : "Conductor desconectado"}
            </span>

            <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
              {online
                ? "Ya puedes recibir viajes"
                : "Inicia tu jornada con AXI"}
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Comparte tu ubicación, activa tu disponibilidad y mantén
              actualizado tu estado para recibir solicitudes cercanas.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <Satellite size={18} className="text-yellow-400" />
                GPS {hasLocation ? "listo" : "pendiente"}
              </span>

              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <ShieldCheck size={18} className="text-yellow-400" />
                Cuenta verificada
              </span>
            </div>
          </div>

          <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-white/10 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">
                  Estado actual
                </p>

                <p className="mt-2 text-3xl font-black">
                  {online ? "En línea" : "Fuera de línea"}
                </p>
              </div>

              <span
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-2xl",
                  online
                    ? "bg-emerald-400 text-emerald-950"
                    : "bg-yellow-400 text-black"
                )}
              >
                <Power size={26} />
              </span>
            </div>

            <button
              type="button"
              onClick={() => changeOnlineStatus(!online)}
              disabled={processing}
              className={cn(
                "mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 font-black transition disabled:pointer-events-none disabled:opacity-50",
                online
                  ? "bg-white text-red-700 hover:bg-red-50"
                  : "bg-yellow-400 text-black hover:bg-yellow-300"
              )}
            >
              {processing
                ? "Procesando..."
                : online
                  ? "Terminar jornada"
                  : "Ponerme en línea"}

              {!processing && <ArrowRight size={19} />}
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={cn(
            "rounded-2xl border px-5 py-4 text-sm font-semibold",
            message.toLowerCase().includes("error") ||
              message.toLowerCase().includes("debes") ||
              message.toLowerCase().includes("no pudimos")
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          )}
        >
          {message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-100 px-6 py-6 sm:px-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Posición del conductor
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  Ubicación GPS
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Actualiza tu ubicación antes de conectarte.
                </p>
              </div>

              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-700">
                <LocateFixed size={23} />
              </span>
            </div>
          </div>

          <div className="relative min-h-[330px] overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(250,204,21,0.18),_transparent_30%),linear-gradient(135deg,_#e2e8f0,_#f8fafc)] p-6 sm:p-8">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.6)_2px,transparent_2px),linear-gradient(90deg,rgba(255,255,255,0.6)_2px,transparent_2px)] bg-[size:55px_55px] opacity-70" />

            <div className="relative flex min-h-[280px] flex-col justify-between">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-lg backdrop-blur">
                  <MapPin size={21} className="text-emerald-600" />

                  <p className="mt-4 text-xs font-black uppercase tracking-wider text-slate-400">
                    Latitud
                  </p>

                  <p className="mt-2 font-black text-slate-950">
                    {latitude !== null
                      ? Number(latitude).toFixed(6)
                      : "Pendiente"}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-lg backdrop-blur">
                  <Navigation size={21} className="text-yellow-600" />

                  <p className="mt-4 text-xs font-black uppercase tracking-wider text-slate-400">
                    Longitud
                  </p>

                  <p className="mt-2 font-black text-slate-950">
                    {longitude !== null
                      ? Number(longitude).toFixed(6)
                      : "Pendiente"}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-lg backdrop-blur">
                  <Gauge size={21} className="text-blue-600" />

                  <p className="mt-4 text-xs font-black uppercase tracking-wider text-slate-400">
                    Precisión
                  </p>

                  <p className="mt-2 font-black text-slate-950">
                    {accuracy !== null
                      ? `${Math.round(accuracy)} m`
                      : locationQuality}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={shareLocation}
                disabled={locating}
                className="mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 font-black text-white transition hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50"
              >
                <RefreshCw
                  size={19}
                  className={locating ? "animate-spin" : ""}
                />

                {locating
                  ? "Obteniendo ubicación..."
                  : hasLocation
                    ? "Actualizar mi ubicación"
                    : "Compartir mi ubicación"}
              </button>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Resumen
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  Jornada de hoy
                </h2>
              </div>

              <Activity size={25} className="text-yellow-600" />
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3">
              <div className="rounded-3xl bg-slate-50 p-5">
                <Route size={21} className="text-blue-600" />

                <p className="mt-5 text-3xl font-black">
                  0
                </p>

                <p className="mt-1 text-xs font-bold text-slate-500">
                  Viajes realizados
                </p>
              </div>

              <div className="rounded-3xl bg-slate-50 p-5">
                <Clock3 size={21} className="text-violet-600" />

                <p className="mt-5 text-3xl font-black">
                  0 h
                </p>

                <p className="mt-1 text-xs font-bold text-slate-500">
                  Tiempo conectado
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-3xl bg-[#0B0F19] p-5 text-white">
              <p className="text-sm font-semibold text-slate-400">
                Ganancias de hoy
              </p>

              <p className="mt-2 text-4xl font-black">
                $0.00
              </p>

              <p className="mt-2 text-xs text-slate-500">
                Se actualizará con los viajes completados.
              </p>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <span
                className={cn(
                  "flex h-13 w-13 items-center justify-center rounded-2xl",
                  hasLocation
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                )}
              >
                {hasLocation ? (
                  <CheckCircle2 size={23} />
                ) : (
                  <Radio size={23} />
                )}
              </span>

              <div>
                <h2 className="text-lg font-black">
                  {hasLocation
                    ? "GPS preparado"
                    : "Falta compartir GPS"}
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {hasLocation
                    ? "Tu posición está lista para recibir solicitudes."
                    : "AXI necesita tu ubicación para mostrarte viajes cercanos."}
                </p>
              </div>
            </div>
          </Card>

          <Link
            href="/dashboard/driver/available-trips"
            className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 font-black text-slate-950 shadow-sm transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
          >
            <CarFront size={20} />
            Ver viajes disponibles
          </Link>
        </div>
      </div>
    </section>
  );
}
