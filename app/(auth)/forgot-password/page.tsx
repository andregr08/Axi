"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { supabase } from "@/lib/supabaseClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setErrorMessage("Escribe el correo asociado con tu cuenta.");
      return;
    }

    setLoading(true);

    const redirectTo = `${window.location.origin}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      {
        redirectTo,
      }
    );

    setLoading(false);

    if (error) {
      console.error("Error enviando recuperación:", error);

      setErrorMessage(
        "No pudimos enviar el correo de recuperación. Inténtalo nuevamente."
      );

      return;
    }

    setSuccessMessage(
      "Si existe una cuenta con ese correo, recibirás un enlace para cambiar tu contraseña."
    );
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
            <ShieldCheck size={15} />
            Recuperación segura
          </span>

          <h1 className="mt-7 text-6xl font-black leading-[1.02] tracking-tight">
            Recupera el acceso
            <br />
            a tu cuenta.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
            Te enviaremos un enlace seguro para crear una contraseña nueva y
            volver a entrar a AXI.
          </p>
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

          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-slate-950"
          >
            <ArrowLeft size={17} />
            Regresar al inicio de sesión
          </Link>

          <div className="mt-10">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-600">
              Recuperar contraseña
            </p>

            <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              Recupera tu cuenta
            </h2>

            <p className="mt-4 text-base leading-7 text-slate-500">
              Escribe tu correo y recibirás las instrucciones para cambiar tu
              contraseña.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-10 space-y-5">
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
                  disabled={loading}
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 disabled:opacity-60"
                />
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-semibold leading-6 text-emerald-800">
                <CheckCircle2
                  size={20}
                  className="mt-0.5 shrink-0 text-emerald-600"
                />

                <span>{successMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#0B0F19] px-6 font-black text-white shadow-xl shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-60"
            >
              {loading ? "Enviando..." : "Enviar enlace"}

              {!loading && <ArrowRight size={19} />}
            </button>
          </form>

          <p className="mt-8 text-center text-xs leading-5 text-slate-400">
            Por seguridad, AXI no confirma públicamente si un correo está
            registrado.
          </p>
        </div>
      </section>
    </main>
  );
}
