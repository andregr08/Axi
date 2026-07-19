"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { supabase } from "@/lib/supabaseClient";
import { useLanguage } from "@/hooks/useLanguage";

type AccountType = "passenger" | "driver";

export default function RegisterPage() {
  const router = useRouter();
  const { t, locale, setLocale } = useLanguage();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] =
    useState<AccountType>("passenger");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [registrationComplete, setRegistrationComplete] =
    useState(false);

  async function handleRegister(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setErrorMessage("");
    setRegistrationComplete(false);

    if (!fullName.trim() || !email.trim() || !password) {
      setErrorMessage(t("register.fillFields"));
      return;
    }

    if (password.length < 6) {
      setErrorMessage(t("register.passwordLength"));
      return;
    }

    if (!acceptTerms) {
      setErrorMessage(t("register.acceptTerms"));
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          role: "passenger",
          requested_account_type: accountType,
          language: locale,
        },
      },
    });

    if (error) {
      setLoading(false);
      setErrorMessage(
        error.message === "User already registered"
          ? t("register.alreadyRegistered")
          : error.message
      );
      return;
    }

    if (!data.session) {
      setLoading(false);
      setRegistrationComplete(true);
      setErrorMessage(t("register.confirmEmail"));
      return;
    }

    localStorage.setItem("axi-language", locale);

    router.push(
      accountType === "driver"
        ? "/dashboard/driver-application"
        : "/dashboard"
    );

    router.refresh();
  }

  const benefits = [
    t("register.benefit1"),
    t("register.benefit2"),
    t("register.benefit3"),
  ];

  return (
    <main className="min-h-screen bg-[#F4F6F8] lg:grid lg:grid-cols-[0.9fr_1.1fr]">
      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-lg">
          <div className="mb-10">
            <Logo />
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-600">
              {t("register.join")}
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              {t("register.title")}
            </h1>

            <p className="mt-4 text-base leading-7 text-slate-500">
              {t("register.subtitle")}
            </p>
          </div>

          <form
            onSubmit={handleRegister}
            className="mt-9 space-y-5"
          >
            <div>
              <label
                htmlFor="full-name"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                {t("register.fullName")}
              </label>

              <div className="relative">
                <UserRound
                  size={19}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  id="full-name"
                  type="text"
                  autoComplete="name"
                  placeholder={t(
                    "register.fullNamePlaceholder"
                  )}
                  value={fullName}
                  onChange={(event) =>
                    setFullName(event.target.value)
                  }
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                {t("register.email")}
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
                  placeholder={t(
                    "register.emailPlaceholder"
                  )}
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                {t("register.password")}
              </label>

              <div className="relative">
                <LockKeyhole
                  size={19}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  id="password"
                  type={
                    showPassword ? "text" : "password"
                  }
                  autoComplete="new-password"
                  placeholder={t(
                    "register.passwordPlaceholder"
                  )}
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-12 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
                  aria-label={
                    showPassword
                      ? t("register.hidePassword")
                      : t("register.showPassword")
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-950"
                >
                  {showPassword ? (
                    <EyeOff size={19} />
                  ) : (
                    <Eye size={19} />
                  )}
                </button>
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-bold text-slate-700">
                {t("register.accountType")}
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    setAccountType("passenger")
                  }
                  className={`rounded-3xl border p-5 text-left transition ${
                    accountType === "passenger"
                      ? "border-yellow-400 bg-yellow-50 ring-2 ring-yellow-400/20"
                      : "border-slate-200 bg-white hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                        accountType === "passenger"
                          ? "bg-yellow-400 text-black"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <UserRound size={21} />
                    </span>

                    {accountType === "passenger" && (
                      <CheckCircle2
                        size={20}
                        className="text-yellow-600"
                      />
                    )}
                  </div>

                  <p className="mt-5 font-black text-slate-950">
                    {t("register.passenger")}
                  </p>

                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    {t("register.passengerDesc")}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setAccountType("driver")
                  }
                  className={`rounded-3xl border p-5 text-left transition ${
                    accountType === "driver"
                      ? "border-slate-950 bg-slate-950 text-white ring-2 ring-slate-950/15"
                      : "border-slate-200 bg-white hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                        accountType === "driver"
                          ? "bg-yellow-400 text-black"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <ShieldCheck size={21} />
                    </span>

                    {accountType === "driver" && (
                      <CheckCircle2
                        size={20}
                        className="text-yellow-400"
                      />
                    )}
                  </div>

                  <p className="mt-5 font-black">
                    {t("register.driver")}
                  </p>

                  <p
                    className={`mt-1 text-sm leading-5 ${
                      accountType === "driver"
                        ? "text-slate-400"
                        : "text-slate-500"
                    }`}
                  >
                    {t("register.driverDesc")}
                  </p>
                </button>
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-bold text-slate-700">
                {t("register.language")}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setLocale("es")}
                  className={`h-14 rounded-2xl border font-black transition ${
                    locale === "es"
                      ? "border-yellow-400 bg-yellow-50 text-slate-950 ring-2 ring-yellow-400/20"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-400"
                  }`}
                >
                  {t("register.spanish")}
                </button>

                <button
                  type="button"
                  onClick={() => setLocale("en")}
                  className={`h-14 rounded-2xl border font-black transition ${
                    locale === "en"
                      ? "border-yellow-400 bg-yellow-50 text-slate-950 ring-2 ring-yellow-400/20"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-400"
                  }`}
                >
                  {t("register.english")}
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(event) =>
                  setAcceptTerms(event.target.checked)
                }
                className="mt-1 h-4 w-4 accent-yellow-400"
              />

              <span className="text-sm leading-6 text-slate-500">
                {t("register.terms")}
              </span>
            </label>

            {errorMessage && (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                  registrationComplete
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#0B0F19] px-6 font-black text-white shadow-xl shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-60"
            >
              {loading
                ? t("register.creating")
                : t("register.create")}

              {!loading && <ArrowRight size={19} />}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-slate-500">
            {t("register.already")}{" "}
            <Link
              href="/login"
              className="font-black text-slate-950 hover:underline"
            >
              {t("register.login")}
            </Link>
          </p>
        </div>
      </section>

      <section className="relative hidden min-h-screen overflow-hidden bg-[#0B0F19] px-12 py-10 text-white lg:flex lg:flex-col">
        <div className="absolute -right-28 -top-28 h-96 w-96 rounded-full bg-yellow-400/15 blur-3xl" />
        <div className="absolute -bottom-40 left-0 h-[28rem] w-[28rem] rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative my-auto">
          <div className="mx-auto max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-yellow-300">
              <ShieldCheck size={15} />
              {t("register.heroBadge")}
            </span>

            <h2 className="mt-7 text-6xl font-black leading-[1.02] tracking-tight">
              {t("register.heroTitleLine1")}
              <br />
              {t("register.heroTitleLine2")}
              <br />
              {t("register.heroTitleLine3")}
            </h2>

            <p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">
              {t("register.heroSubtitle")}
            </p>

            <div className="mt-10 space-y-4">
              {benefits.map((benefit) => (
                <div
                  key={benefit}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-yellow-400 text-black">
                    <CheckCircle2 size={17} />
                  </span>

                  <span className="font-bold text-slate-200">
                    {benefit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative flex items-center justify-between text-xs text-slate-500">
          <span>AXI Mobility</span>
          <span>{t("register.secure")}</span>
        </div>
      </section>
    </main>
  );
}