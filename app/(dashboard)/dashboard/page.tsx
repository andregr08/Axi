"use client";

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
    return <p>Cargando...</p>;
  }

  const roleName = {
    admin: "Administrador",
    driver: "Conductor",
    passenger: "Pasajero",
  };

  return (
    <section>
      <h1 className="mb-2 text-3xl font-bold">
        Bienvenido, {profile?.full_name || "Usuario"}
      </h1>

      <p className="mb-8 text-gray-600">
        Este es tu panel principal de AXI.
      </p>

      <div className="grid gap-5 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Correo</p>
          <p className="mt-2 font-semibold">{email}</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Rol</p>
          <p className="mt-2 font-semibold">
            {profile ? roleName[profile.role] : "Sin rol"}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Estado</p>
          <p className="mt-2 font-semibold text-green-600">Cuenta activa</p>
        </div>
      </div>
    </section>
  );
}
