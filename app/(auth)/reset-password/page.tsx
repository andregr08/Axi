"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function verifyRecoverySession() {
      const { data } = await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      if (data.session) {
        setHasRecoverySession(true);
        setCheckingSession(false);
        return;
      }

      const timeout = window.setTimeout(async () => {
        const { data: delayedSession } = await supabase.auth.getSession();

        if (!mounted) {
          return;
        }

        setHasRecoverySession(Boolean(delayedSession.session));
        setCheckingSession(false);
      }, 1200);

      return () => window.clearTimeout(timeout);
    }

    const verificationCleanupPromise = verifyRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) {
        return;
      }

      if (event === "PASSWORD_RECOVERY" || session) {
        setHasRecoverySession(true);
        setCheckingSession(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();

      void verificationCleanupPromise;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!hasRecoverySession) {
      setErrorMessage(
        "El enlace de recuperación no es válido o ya expiró. Solicita uno nuevo."
      );
      return;
    }

    if (password.length < 8) {
      setErrorMessage("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      console.error("Error actualizando contraseña:", error);

      setErrorMessage(
        error.message.toLowerCase().includes("same password")
          ? "La contraseña nueva debe ser diferente a la anterior."
          : "No pudimos actualizar la contraseña. Solicita un enlace nuevo."
      );

      return;
    }

    setSuccessMessage("Tu contraseña se actualizó correctamente.");

    window.setTimeout(() => {
      router.replace("/login");
      router.refresh();
    }, 1800);
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
            <KeyRound size={15} />
            Nueva contraseña
          </span>

          <h1 className="mt-7 text-6xl font-black leading-[1.02] tracking-tight">
            Protege tu cuenta
            <br />
            de AXI.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
            Crea una contraseña segura que no hayas utilizado anteriormente.
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

          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-600">
              Seguridad de la cuenta
            </p>

            <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              Nueva contraseña
            </h2>

            <p className="mt-4 text-base leading-7 text-slate-500">
              Escribe y confirma la contraseña que utilizarás para entrar a
              AXI.
            </p>
          </div>

          {checkingSession ? (
            <div className="mt-10 flex items-center gap-3 rounded-3xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-600">
              <LoaderCircle size={20} className="animate-spin" />
              Validando el enlace de recuperación...
            </div>
          ) : !hasRecoverySession ? (
            <div className="mt-10">
              <div className="rounded-3xl border border-red-200 bg-red-50 p-6">
                <ShieldCheck size={26} className="text-red-600" />

                <h3 className="mt-4 font-black text-red-950">
                  Enlace inválido o expirado
                </h3>

                <p className="mt-2 text-sm leading-6 text-red-700">
                  Solicita un enlace nuevo para poder cambiar tu contraseña.
                </p>
              </div>

              <Link
                href="/forgot-password"
                className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#0B0F19] px-6 font-black text-white transition hover:bg-slate-800"
              >
                Solicitar otro enlace
                <ArrowRight size={19} />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-10 space-y-5">
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  Nueva contraseña
                </label>

                <div className="relative">
                  <LockKeyhole
                    size={19}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={loading || Boolean(successMessage)}
                    className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-12 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 disabled:opacity-60"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={
                      showPassword
                        ? "Ocultar contraseña"
                        : "Mostrar contraseña"
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-950"
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  Confirmar contraseña
                </label>

                <div className="relative">
                  <LockKeyhole
                    size={19}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Repite tu contraseña"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    disabled={loading || Boolean(successMessage)}
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
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-semibold text-emerald-800">
                  <CheckCircle2
                    size={20}
                    className="mt-0.5 shrink-0 text-emerald-600"
                  />
                  <span>{successMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || Boolean(successMessage)}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#0B0F19] px-6 font-black text-white shadow-xl shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-60"
              >
                {loading ? "Actualizando..." : "Guardar contraseña"}

                {!loading && <ArrowRight size={19} />}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
