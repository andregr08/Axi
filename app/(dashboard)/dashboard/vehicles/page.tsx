"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  CarFront,
  CheckCircle2,
  Clock3,
  Gauge,
  LoaderCircle,
  Palette,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";
import { canManageVehicles } from "@/lib/auth/roles";
import { cn } from "@/utils/cn";

type VehicleStatus =
  | "pending"
  | "active"
  | "maintenance"
  | "suspended";

type Vehicle = {
  id: string;
  brand: string;
  model: string;
  vehicle_year: number | null;
  color: string | null;
  plates: string;
  capacity: number;
  status: VehicleStatus;
  verified: boolean;
};

const statusNames: Record<VehicleStatus, string> = {
  pending: "Pendiente",
  active: "Activo",
  maintenance: "Mantenimiento",
  suspended: "Suspendido",
};

export default function VehiclesPage() {
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [color, setColor] = useState("");
  const [plates, setPlates] = useState("");
  const [capacity, setCapacity] = useState("4");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadVehicles = useCallback(
    async (silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMessage("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();

      if (profileError) {
        setMessage(
          `Error cargando perfil: ${profileError.message}`
        );
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (
        !canManageVehicles(profile.role)
      ) {
        router.replace("/dashboard");
        return;
      }

      const { data, error } = await supabase
        .from("vehicles")
        .select(
          "id, brand, model, vehicle_year, color, plates, capacity, status, verified"
        )
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        setMessage(
          `Error cargando vehículos: ${error.message}`
        );
      } else {
        setVehicles((data ?? []) as Vehicle[]);
      }

      setLoading(false);
      setRefreshing(false);
    },
    [router]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadVehicles();
  }, [loadVehicles]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");

    if (
      !brand.trim() ||
      !model.trim() ||
      !plates.trim()
    ) {
      setMessage(
        "Completa marca, modelo y placas."
      );
      return;
    }

    const parsedYear = year ? Number(year) : null;
    const parsedCapacity = Number(capacity);
    const currentYear = new Date().getFullYear();

    if (
      parsedYear !== null &&
      (Number.isNaN(parsedYear) ||
        parsedYear < 1980 ||
        parsedYear > currentYear + 1)
    ) {
      setMessage("Escribe un año válido.");
      return;
    }

    if (
      Number.isNaN(parsedCapacity) ||
      parsedCapacity < 1 ||
      parsedCapacity > 20
    ) {
      setMessage(
        "La capacidad debe estar entre 1 y 20 pasajeros."
      );
      return;
    }

    setSaving(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setSaving(false);
      router.replace("/login");
      return;
    }

    const { data: driverRecord, error: driverError } =
      await supabase
        .from("drivers")
        .select("id, status")
        .eq("id", session.user.id)
        .maybeSingle();

    if (driverError) {
      setSaving(false);
      setMessage(
        `No fue posible validar tu cuenta de conductor: ${driverError.message}`
      );
      return;
    }

    if (!driverRecord) {
      setSaving(false);
      setMessage(
        "Tu cuenta todavía no está registrada como conductor. Primero debes enviar la solicitud y esperar a que un administrador la apruebe."
      );
      return;
    }

    if (driverRecord.status !== "active") {
      setSaving(false);
      setMessage(
        "Tu cuenta de conductor todavía no está activa. Espera a que un administrador complete la aprobación."
      );
      return;
    }

    const { error } = await supabase
      .from("vehicles")
      .insert({
        driver_id: driverRecord.id,
        brand: brand.trim(),
        model: model.trim(),
        vehicle_year: parsedYear,
        color: color.trim() || null,
        plates: plates.trim().toUpperCase(),
        capacity: parsedCapacity,
        status: "pending",
        verified: false,
        is_primary: vehicles.length === 0,
      });

    setSaving(false);

    if (error) {
      setMessage(
        `Error registrando vehículo: ${error.message}`
      );
      return;
    }

    setBrand("");
    setModel("");
    setYear("");
    setColor("");
    setPlates("");
    setCapacity("4");
    setMessage(
      "Vehículo registrado. Quedó pendiente de revisión."
    );

    await loadVehicles(true);
  }

  const activeCount = vehicles.filter(
    (vehicle) => vehicle.status === "active"
  ).length;

  const pendingCount = vehicles.filter(
    (vehicle) => vehicle.status === "pending"
  ).length;

  const verifiedCount = vehicles.filter(
    (vehicle) => vehicle.verified
  ).length;

  const formProgress = useMemo(() => {
    const fields = [
      brand.trim(),
      model.trim(),
      year.trim(),
      color.trim(),
      plates.trim(),
      capacity.trim(),
    ];

    const completed = fields.filter(Boolean).length;

    return Math.round(
      (completed / fields.length) * 100
    );
  }, [brand, capacity, color, model, plates, year]);

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="h-72 animate-pulse rounded-[2rem] bg-slate-200" />

        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="h-[650px] animate-pulse rounded-[2rem] bg-slate-200" />
          <div className="h-[650px] animate-pulse rounded-[2rem] bg-slate-200" />
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-[#0B0F19] px-6 py-8 text-white shadow-[0_25px_80px_rgba(15,23,42,0.2)] sm:px-9 sm:py-10">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-yellow-400/20 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-yellow-300">
              <Sparkles size={15} />
              Gestión de unidades
            </span>

            <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">
              Mis vehículos
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Registra las unidades vinculadas a tu cuenta y
              consulta su estado de revisión y verificación.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <CarFront
                  size={18}
                  className="text-yellow-400"
                />
                {vehicles.length} registrados
              </span>

              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <BadgeCheck
                  size={18}
                  className="text-emerald-400"
                />
                {verifiedCount} verificados
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadVehicles(true)}
            disabled={refreshing}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-7 font-black text-black transition hover:bg-yellow-300 disabled:pointer-events-none disabled:opacity-60"
          >
            <RefreshCw
              size={19}
              className={
                refreshing ? "animate-spin" : ""
              }
            />

            {refreshing
              ? "Actualizando..."
              : "Actualizar vehículos"}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={cn(
            "rounded-2xl border px-5 py-4 text-sm font-semibold",
            message.toLowerCase().includes("error") ||
              message
                .toLowerCase()
                .includes("completa") ||
              message.toLowerCase().includes("válido")
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          )}
        >
          {message}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        <StatCard
          label="Activos"
          value={activeCount}
          description="Listos para operar"
          icon={CheckCircle2}
          iconClass="bg-emerald-100 text-emerald-700"
        />

        <StatCard
          label="Pendientes"
          value={pendingCount}
          description="Esperando revisión"
          icon={Clock3}
          iconClass="bg-amber-100 text-amber-800"
        />

        <StatCard
          label="Verificados"
          value={verifiedCount}
          description="Documentación validada"
          icon={ShieldCheck}
          iconClass="bg-blue-100 text-blue-700"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <Card className="h-fit xl:sticky xl:top-28">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Nueva unidad
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Registrar vehículo
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Completa los datos del vehículo para enviarlo
                a revisión administrativa.
              </p>
            </div>

            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-800">
              <Plus size={22} />
            </span>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-xs font-black text-slate-500">
              <span>Progreso del registro</span>
              <span>{formProgress}%</span>
            </div>

            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-yellow-400 transition-all duration-300"
                style={{
                  width: `${formProgress}%`,
                }}
              />
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-7 space-y-5"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <VehicleInput
                label="Marca"
                value={brand}
                placeholder="Ejemplo: Nissan"
                icon={CarFront}
                onChange={setBrand}
              />

              <VehicleInput
                label="Modelo"
                value={model}
                placeholder="Ejemplo: Versa"
                icon={Gauge}
                onChange={setModel}
              />

              <VehicleInput
                label="Año"
                value={year}
                placeholder="2024"
                type="number"
                icon={CalendarDays}
                onChange={setYear}
              />

              <VehicleInput
                label="Color"
                value={color}
                placeholder="Blanco"
                icon={Palette}
                onChange={setColor}
              />

              <VehicleInput
                label="Placas"
                value={plates}
                placeholder="ABC-123-A"
                icon={BadgeCheck}
                uppercase
                onChange={setPlates}
              />

              <VehicleInput
                label="Capacidad"
                value={capacity}
                placeholder="4"
                type="number"
                icon={UsersRound}
                onChange={setCapacity}
              />
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck
                  size={19}
                  className="mt-0.5 shrink-0 text-blue-700"
                />

                <p className="text-xs leading-6 text-blue-800">
                  La unidad quedará pendiente hasta que un
                  administrador revise y apruebe la
                  información.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 font-black text-white transition hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50"
            >
              {saving ? (
                <>
                  <LoaderCircle
                    size={19}
                    className="animate-spin"
                  />
                  Registrando...
                </>
              ) : (
                <>
                  <Plus size={19} />
                  Registrar vehículo
                </>
              )}
            </button>
          </form>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-100 px-6 py-6 sm:px-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Flota personal
            </p>

            <h2 className="mt-1 text-2xl font-black">
              Vehículos registrados
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Consulta el estado actual de cada unidad
              vinculada a tu cuenta.
            </p>
          </div>

          {vehicles.length === 0 ? (
            <div className="relative flex min-h-[580px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(250,204,21,0.14),_transparent_32%),linear-gradient(to_bottom,_#ffffff,_#f8fafc)] px-6 py-12">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(226,232,240,0.45)_1px,transparent_1px),linear-gradient(90deg,rgba(226,232,240,0.45)_1px,transparent_1px)] bg-[size:42px_42px]" />

              <div className="relative max-w-md text-center">
                <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-slate-950 text-yellow-400 shadow-2xl shadow-slate-950/20">
                  <CarFront size={35} />
                </span>

                <h3 className="mt-7 text-3xl font-black">
                  No hay vehículos registrados
                </h3>

                <p className="mt-4 text-sm leading-7 text-slate-500">
                  Completa el formulario para registrar tu
                  primera unidad dentro de AXI.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-5 p-5 sm:p-7">
              {vehicles.map((vehicle, index) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  primary={index === 0}
                />
              ))}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}

function VehicleCard({
  vehicle,
  primary,
}: {
  vehicle: Vehicle;
  primary: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm">
      <div
        className={cn(
          "h-1.5",
          vehicle.status === "active" &&
            "bg-emerald-500",
          vehicle.status === "pending" &&
            "bg-amber-400",
          vehicle.status === "maintenance" &&
            "bg-blue-500",
          vehicle.status === "suspended" &&
            "bg-red-500"
        )}
      />

      <div className="grid gap-0 lg:grid-cols-[0.42fr_0.58fr]">
        <div className="relative flex min-h-60 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(250,204,21,0.22),_transparent_35%),linear-gradient(135deg,_#e2e8f0,_#f8fafc)]">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.45)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.45)_1px,transparent_1px)] bg-[size:34px_34px]" />

          <span className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] bg-slate-950 text-yellow-400 shadow-2xl">
            <CarFront size={44} />
          </span>

          <span className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-black shadow-lg backdrop-blur">
            {vehicle.plates}
          </span>

          {primary && (
            <span className="absolute bottom-4 left-4 rounded-full bg-yellow-400 px-3 py-1.5 text-xs font-black text-black">
              Vehículo principal
            </span>
          )}
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-2xl font-black text-slate-950">
                {vehicle.brand} {vehicle.model}
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                {vehicle.vehicle_year ??
                  "Año no registrado"}
                {vehicle.color
                  ? ` · ${vehicle.color}`
                  : ""}
              </p>
            </div>

            <span
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                vehicle.verified
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              )}
            >
              {vehicle.verified ? (
                <BadgeCheck size={21} />
              ) : (
                <ShieldAlert size={21} />
              )}
            </span>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <VehicleStatusBadge
              status={vehicle.status}
            />

            <span
              className={cn(
                "inline-flex rounded-full px-3 py-1.5 text-xs font-black",
                vehicle.verified
                  ? "bg-blue-100 text-blue-700"
                  : "bg-slate-100 text-slate-600"
              )}
            >
              {vehicle.verified
                ? "Verificado"
                : "Sin verificar"}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <VehicleInfo
              label="Placas"
              value={vehicle.plates}
              icon={BadgeCheck}
            />

            <VehicleInfo
              label="Capacidad"
              value={`${vehicle.capacity} pasajeros`}
              icon={UsersRound}
            />

            <VehicleInfo
              label="Año"
              value={
                vehicle.vehicle_year
                  ? String(vehicle.vehicle_year)
                  : "No registrado"
              }
              icon={CalendarDays}
            />

            <VehicleInfo
              label="Color"
              value={
                vehicle.color || "No registrado"
              }
              icon={Palette}
            />
          </div>

          {vehicle.status === "pending" && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <Clock3
                size={18}
                className="mt-0.5 shrink-0 text-amber-700"
              />

              <p className="text-xs leading-6 text-amber-800">
                La unidad está esperando revisión del equipo
                administrativo.
              </p>
            </div>
          )}

          {vehicle.status === "maintenance" && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <Wrench
                size={18}
                className="mt-0.5 shrink-0 text-blue-700"
              />

              <p className="text-xs leading-6 text-blue-800">
                Esta unidad está marcada temporalmente en
                mantenimiento.
              </p>
            </div>
          )}

          {vehicle.status === "suspended" && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
              <XCircle
                size={18}
                className="mt-0.5 shrink-0 text-red-700"
              />

              <p className="text-xs leading-6 text-red-800">
                Esta unidad está suspendida y no puede operar
                en AXI.
              </p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function VehicleStatusBadge({
  status,
}: {
  status: VehicleStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black",
        status === "active" &&
          "bg-emerald-100 text-emerald-700",
        status === "pending" &&
          "bg-amber-100 text-amber-800",
        status === "maintenance" &&
          "bg-blue-100 text-blue-700",
        status === "suspended" &&
          "bg-red-100 text-red-700"
      )}
    >
      {status === "active" && (
        <CheckCircle2 size={14} />
      )}

      {status === "pending" && (
        <Clock3 size={14} />
      )}

      {status === "maintenance" && (
        <Wrench size={14} />
      )}

      {status === "suspended" && (
        <XCircle size={14} />
      )}

      {statusNames[status]}
    </span>
  );
}

function VehicleInput({
  label,
  value,
  placeholder,
  type = "text",
  icon: Icon,
  uppercase = false,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  type?: string;
  icon: LucideIcon;
  uppercase?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-black text-slate-700">
        {label}
      </label>

      <div className="relative">
        <Icon
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
        />

        <input
          type={type}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          placeholder={placeholder}
          className={cn(
            "h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 font-semibold text-slate-950 outline-none transition focus:border-slate-950 focus:bg-white focus:ring-4 focus:ring-slate-950/5",
            uppercase && "uppercase"
          )}
        />
      </div>
    </div>
  );
}

function VehicleInfo({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <Icon
        size={18}
        className="text-slate-400"
      />

      <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-black text-slate-700">
        {value}
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  description,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: number;
  description: string;
  icon: LucideIcon;
  iconClass: string;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <span
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-2xl",
            iconClass
          )}
        >
          <Icon size={23} />
        </span>

        <p className="text-4xl font-black">
          {value}
        </p>
      </div>

      <p className="mt-5 font-black">
        {label}
      </p>

      <p className="mt-1 text-sm text-slate-500">
        {description}
      </p>
    </Card>
  );
}
