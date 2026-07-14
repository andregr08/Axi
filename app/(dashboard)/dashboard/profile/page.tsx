"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ProfilePage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();

      if (data.user) {
        setEmail(data.user.email ?? "");
        setName(data.user.user_metadata?.full_name ?? "");
      }
    }

    loadUser();
  }, []);

  return (
    <section>
      <h1 className="mb-2 text-3xl font-bold">Perfil</h1>
      <p className="mb-8 text-gray-600">
        Información de tu cuenta en AXI.
      </p>

      <div className="max-w-xl rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-5">
          <p className="text-sm text-gray-500">Nombre</p>
          <p className="text-lg font-semibold">
            {name || "Sin nombre registrado"}
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-500">Correo</p>
          <p className="text-lg font-semibold">{email}</p>
        </div>
      </div>
    </section>
  );
}

