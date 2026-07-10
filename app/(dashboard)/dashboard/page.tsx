"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  full_name: string | null;
  role: "admin" | "driver" | "passenger";
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
      } else {
        setProfile(data);
      }

      setLoading(false);
    }

    loadDashboard();
  }, [router]);

  if (loading) {
    return <p>Cargando dashboard...</p>;
  }

  const roleName = {
    admin: "Administrador",
    driver: "Conductor",
    passenger: "Pasajero",
  };

  return (
    <section>
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Panel principal
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          Bienvenido, {profile?.full_name || "Usuario"}
        </h1>

        <p className="mt-2 text-gray-600">
          Administra tu actividad y consulta el estado de tu cuenta.
        </p>
      </div>

      <div className="mb-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Viajes realizados</p>
          <p className="mt-3 text-3xl font-bold">0</p>
          <p className="mt-2 text-sm text-gray-400">
            Todavia no tienes viajes
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Viajes activos</p>
          <p className="mt-3 text-3xl font-bold">0</p>
          <p className="mt-2 text-sm text-gray-400">
            Ningun viaje en curso
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Calificacion</p>
          <p className="mt-3 text-3xl font-bold">5.0</p>
          <p className="mt-2 text-sm text-gray-400">
            Cuenta nueva
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Estado</p>
          <p className="mt-3 text-xl font-bold text-green-600">
            Activa
          </p>
          <p className="mt-2 text-sm text-gray-400">
            Tu cuenta funciona correctamente
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-sm xl:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Actividad reciente</h2>
              <p className="mt-1 text-sm text-gray-500">
                Aqui apareceran tus viajes recientes.
              </p>
            </div>

            <Link
              href="/dashboard/trips"
              className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              Ver viajes
            </Link>
          </div>

          <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed">
            <div className="text-center">
              <p className="font-semibold text-gray-700">
                Sin actividad reciente
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Tus proximos viajes apareceran aqui.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Tu cuenta</h2>

          <div className="mt-6 space-y-5">
            <div>
              <p className="text-sm text-gray-500">Nombre</p>
              <p className="mt-1 font-semibold">
                {profile?.full_name || "Sin nombre"}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Correo</p>
              <p className="mt-1 break-all font-semibold">{email}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Rol</p>
              <p className="mt-1 font-semibold">
                {profile ? roleName[profile.role] : "Sin rol"}
              </p>
            </div>

            <Link
              href="/dashboard/profile"
              className="block w-full rounded-lg bg-black px-4 py-3 text-center font-semibold text-white hover:bg-gray-800"
            >
              Ver perfil
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
