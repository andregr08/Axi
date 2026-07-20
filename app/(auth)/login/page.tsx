"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CarFront,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!email.trim() || !password) {
      setErrorMessage("Escribe tu correo y contraseña.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMessage(
        error.message === "Invalid login credentials"
          ? "El correo o la contraseña no son correctos."
          : error.message
      );
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#F4F6F8] lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#0B0F19] px-12 py-10 text-white lg:flex lg:flex-col">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-yellow-400/15 blur-3xl" />
        <div className="absolute -bottom-40 right-0 h-[28rem] w-[28rem] rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative">
          <Logo dark />
        </div>

        <div className="relative my-auto max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-yellow-300">
            <CarFront size={15} />
            Movilidad inteligente
          </span>

          <h1 className="mt-7 text-6xl font-black leading-[1.02] tracking-tight">
            Tu ciudad,
            <br />
            mejor conectada.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
            Viajes seguros, conductores verificados y una experiencia diseñada
            para pasajeros, taxistas y administradores.
          </p>

          <div className="mt-10 grid max-w-xl grid-cols-3 gap-4">
            <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur">
              <MapPin className="text-yellow-400" size={24} />
              <p className="mt-4 font-black">Rutas rápidas</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Movilidad eficiente en tiempo real.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur">
              <ShieldCheck className="text-yellow-400" size={24} />
              <p className="mt-4 font-black">Más seguridad</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Conductores y unidades verificadas.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur">
              <CheckCircle2 className="text-yellow-400" size={24} />
              <p className="mt-4 font-black">Todo en AXI</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Viajes, pagos y actividad en una app.
              </p>
            </div>
          </div>
        </div>

        <div className="relative flex items-center justify-between text-xs text-slate-500">
          <span>AXI Mobility</span>
          <span>Puebla, México</span>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-600">
              Bienvenido de nuevo
            </p>

            <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              Inicia sesión
            </h2>

            <p className="mt-4 text-base leading-7 text-slate-500">
              Accede a tus viajes, pagos y herramientas de movilidad.
            </p>
          </div>

          <form onSubmit={handleLogin} className="mt-10 space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Correo electrónico
              </label>

              <div className="relative">
                <Mail
                  size={19}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-sm font-bold text-slate-700"
                >
                  Contraseña
                </label>

                <Link
                  href="/forgot-password"
                  className="text-xs font-bold text-slate-500 transition hover:text-slate-950"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              <div className="relative">
                <LockKeyhole
                  size={19}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Escribe tu contraseña"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-12 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-950"
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#0B0F19] px-6 font-black text-white shadow-xl shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-60"
            >
              {loading ? "Entrando..." : "Entrar a AXI"}

              {!loading && <ArrowRight size={19} />}
            </button>
          </form>

          <div className="mt-8 flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Nuevo en AXI
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <Link
            href="/register"
            className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 font-black text-slate-950 transition hover:border-slate-950 hover:bg-slate-50"
          >
            Crear una cuenta
          </Link>

          <p className="mt-8 text-center text-xs leading-5 text-slate-400">
            Al continuar, aceptas los términos de uso y el aviso de privacidad
            de AXI.
          </p>
        </div>
      </section>
    </main>
  );
}
