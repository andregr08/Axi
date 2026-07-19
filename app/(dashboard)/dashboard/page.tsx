"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  CarFront,
  ChevronRight,
  CircleCheck,
  Clock3,
  CreditCard,
  MapPin,
  Route,
  ShieldCheck,
  Star,
  UserRound,
} from "lucide-react";
import { DriverHome } from "@/components/dashboard/DriverHome";
import { AdminHome } from "@/components/dashboard/AdminHome";
import { PassengerHome } from "@/components/dashboard/PassengerHome";
import { Hero } from "@/components/dashboard/Hero";
import { GoogleMapView } from "@/components/maps/GoogleMap";
import { RideActionPanel } from "@/components/trips/RideActionPanel";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";
import {
  isAdmin,
  isSupport,
  type UserRole,
} from "@/lib/auth/roles";

type Profile = {
  full_name: string | null;
  role: UserRole;
};


const roleName: Record<UserRole, string> = {
  director_general: "Director General",
  admin: "Administrador",
  support: "Soporte",
  finance: "Finanzas",
  driver: "Conductor",
  passenger: "Pasajero",
};

const roleDescription: Record<UserRole, string> = {
  director_general: "Dirección y control total de la plataforma",
  admin: "Control operativo de la plataforma",
  support: "Atención y soporte a usuarios",
  finance: "Administración financiera de la plataforma",
  driver: "Listo para recibir viajes",
  passenger: "Tu movilidad, en un solo lugar",
};


export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      setEmail(session.user.email ?? "");

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", session.user.id)
        .single();

      if (error) {
        console.error("Error al cargar perfil:", error.message);
        setProfile({
          full_name: null,
          role: "passenger",
        });
      } else {
        setProfile(data as Profile);
      }

      setLoading(false);
    }

    void loadDashboard();
  }, [router]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-80 animate-pulse rounded-[2rem] bg-slate-200" />

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-40 animate-pulse rounded-3xl bg-slate-200"
            />
          ))}
        </div>
      </div>
    );
  }

  const role = profile?.role ?? "passenger";
  const displayName = profile?.full_name || "Usuario";

  if (role === "driver") {
    return (
      <DriverHome
        name={displayName}
        email={email}
      />
    );
  }

  if (role === "passenger") {
    return (
      <PassengerHome
        name={displayName}
        email={email}
      />
    );
  }


  if (isAdmin(role)) {
    return (
      <AdminHome
        name={displayName}
        email={email}
      />
    );
  }

  if (isSupport(role)) {
    return (
      <section className="space-y-6">
        <div className="overflow-hidden rounded-[2rem] bg-[#0B0F19] px-6 py-10 text-white sm:px-10">
          <p className="text-sm font-semibold text-yellow-400">
            Centro de soporte
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight">
            Hola, {displayName}
          </h1>

          <p className="mt-4 max-w-2xl leading-7 text-slate-300">
            Consulta solicitudes, incidentes, viajes reportados y conversaciones
            que necesitan atención.
          </p>

          <Link
            href="/dashboard/admin/support"
            className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-yellow-400 px-5 py-3 font-black text-black transition hover:bg-yellow-300"
          >
            Abrir panel de soporte
            <ArrowUpRight size={18} />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <Hero name={displayName} role={role} />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="group relative overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-xl">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-yellow-100 transition group-hover:scale-125" />

          <div className="relative">
            <div className="flex items-start justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-700">
                <Route size={23} />
              </span>

              <Badge variant="warning">Este mes</Badge>
            </div>

            <p className="mt-6 text-sm font-semibold text-slate-500">
              Viajes realizados
            </p>
            <p className="mt-1 text-4xl font-black tracking-tight">0</p>
            <p className="mt-3 text-sm text-slate-400">
              Tu historial aparecerá aquí
            </p>
          </div>
        </Card>

        <Card className="group relative overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-xl">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-blue-100 transition group-hover:scale-125" />

          <div className="relative">
            <div className="flex items-start justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                <Clock3 size={23} />
              </span>

              <Badge>Ahora</Badge>
            </div>

            <p className="mt-6 text-sm font-semibold text-slate-500">
              Viajes activos
            </p>
            <p className="mt-1 text-4xl font-black tracking-tight">0</p>
            <p className="mt-3 text-sm text-slate-400">
              Ningún viaje en curso
            </p>
          </div>
        </Card>

        <Card className="group relative overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-xl">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-100 transition group-hover:scale-125" />

          <div className="relative">
            <div className="flex items-start justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <Star size={23} />
              </span>

              <Badge variant="success">Excelente</Badge>
            </div>

            <p className="mt-6 text-sm font-semibold text-slate-500">
              Calificación
            </p>
            <p className="mt-1 text-4xl font-black tracking-tight">5.0</p>
            <p className="mt-3 text-sm text-slate-400">
              Cuenta nueva en AXI
            </p>
          </div>
        </Card>

        <Card className="group relative overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-xl">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-100 transition group-hover:scale-125" />

          <div className="relative">
            <div className="flex items-start justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <CircleCheck size={23} />
              </span>

              <Badge variant="success">En línea</Badge>
            </div>

            <p className="mt-6 text-sm font-semibold text-slate-500">
              Estado de cuenta
            </p>
            <p className="mt-2 text-2xl font-black text-emerald-600">
              Activa
            </p>
            <p className="mt-3 text-sm text-slate-400">
              Todos los servicios disponibles
            </p>
          </div>
        </Card>
      </div>


      <section>
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Operación en vivo
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Mapa de movilidad
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Aquí aparecerán conductores, rutas y viajes activos.
            </p>
          </div>

          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Sistema disponible
          </span>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.65fr_0.75fr]">
          <GoogleMapView />
          <RideActionPanel role={role} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card className="overflow-hidden p-0">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Actividad
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                Viajes recientes
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Consulta los movimientos más recientes de tu cuenta.
              </p>
            </div>

            <Link
              href="/dashboard/trips"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
            >
              Ver todos
              <ArrowUpRight size={17} />
            </Link>
          </div>

          <div className="relative flex min-h-80 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(250,204,21,0.12),_transparent_34%),linear-gradient(to_bottom,_#ffffff,_#f8fafc)] px-6 py-12">
            <div className="absolute left-10 top-12 h-3 w-3 rounded-full bg-yellow-400 ring-8 ring-yellow-400/10" />
            <div className="absolute bottom-16 right-12 h-3 w-3 rounded-full bg-slate-900 ring-8 ring-slate-900/10" />

            <div className="relative max-w-sm text-center">
              <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-slate-950 text-yellow-400 shadow-2xl shadow-slate-950/20">
                <MapPin size={34} />
              </span>

              <h3 className="mt-6 text-xl font-black text-slate-900">
                Todavía no hay actividad
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Cuando realices o recibas tu primer viaje, aparecerá en esta
                sección.
              </p>

              <Link
                href="/dashboard/trips/new"
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-yellow-400 px-5 py-3 text-sm font-black text-black transition hover:-translate-y-0.5 hover:bg-yellow-300"
              >
                Solicitar viaje
                <ChevronRight size={17} />
              </Link>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="relative overflow-hidden bg-[#0B0F19] text-white">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-yellow-400/15 blur-2xl" />

            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 text-black">
                  <UserRound size={23} />
                </span>

                <Badge className="bg-white/10 text-white">
                  {roleName[role]}
                </Badge>
              </div>

              <h2 className="mt-6 text-2xl font-black">{displayName}</h2>
              <p className="mt-1 text-sm text-slate-400">{email}</p>

              <p className="mt-5 text-sm leading-6 text-slate-300">
                {roleDescription[role]}
              </p>

              <Link
                href="/dashboard/profile"
                className="mt-6 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm font-bold transition hover:bg-white/10"
              >
                Administrar perfil
                <ChevronRight size={18} />
              </Link>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Accesos rápidos
                </p>
                <h2 className="mt-1 text-xl font-black">Tu cuenta AXI</h2>
              </div>

              <ShieldCheck className="text-emerald-500" size={26} />
            </div>

            <div className="mt-6 space-y-3">
              <Link
                href="/dashboard/payments"
                className="flex items-center gap-4 rounded-2xl border border-slate-100 p-4 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <CreditCard size={20} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block font-bold">Pagos</span>
                  <span className="block truncate text-sm text-slate-500">
                    Métodos de pago y movimientos
                  </span>
                </span>

                <ChevronRight size={18} className="text-slate-400" />
              </Link>

              <Link
                href="/dashboard/admin/finance"
                className="flex items-center gap-4 rounded-2xl border border-slate-100 p-4 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-100 text-yellow-700">
                  <CreditCard size={20} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block font-bold">Panel financiero</span>
                  <span className="block truncate text-sm text-slate-500">
                    Pagos, retiros, comisiones e incentivos
                  </span>
                </span>

                <ChevronRight size={18} className="text-slate-400" />
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
