"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleRegister() {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          role: "passenger",
        },
      },
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Cuenta creada. Revisa tu correo.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="mb-6 text-center text-3xl font-bold">Crear cuenta</h1>

        <input type="text" placeholder="Nombre completo" value={name} onChange={(e) => setName(e.target.value)} className="mb-4 w-full rounded-lg border p-3" />
        <input type="email" placeholder="Correo electrÃ³nico" value={email} onChange={(e) => setEmail(e.target.value)} className="mb-4 w-full rounded-lg border p-3" />
        <input type="password" placeholder="ContraseÃ±a" value={password} onChange={(e) => setPassword(e.target.value)} className="mb-6 w-full rounded-lg border p-3" />

        <button onClick={handleRegister} className="w-full rounded-lg bg-black p-3 font-semibold text-white hover:bg-gray-800">
          Registrarme
        </button>
      </div>
    </main>
  );
}
