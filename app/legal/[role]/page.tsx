"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { useLanguage } from "@/hooks/useLanguage";

type LegalRole = "passenger" | "driver";

export default function LegalPage() {
  const params = useParams<{ role: string }>();
  const { locale } = useLanguage();

  const english = locale === "en";

  const role: LegalRole =
    params.role === "driver"
      ? "driver"
      : "passenger";

  const roleName =
    role === "driver"
      ? english
        ? "Driver"
        : "Conductor"
      : english
        ? "Passenger"
        : "Pasajero";

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <Logo href="/" />

          <span className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-yellow-400">
            {roleName}
          </span>
        </div>

        <section className="mt-12 overflow-hidden rounded-[2rem] bg-[#0B0F19] px-6 py-10 text-white shadow-[0_25px_80px_rgba(15,23,42,0.18)] sm:px-10 sm:py-12">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-400">
            AXI Mobility
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
            {english
              ? "Legal"
              : "Legal"}
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
            {english
              ? "Review the legal documents corresponding to your account."
              : "Consulta los documentos legales correspondientes a tu cuenta."}
          </p>
        </section>

        <section className="mt-7 grid gap-5 md:grid-cols-2">
          <Link
            href={"/legal/" + role + "/terms"}
            className="group rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_18px_55px_rgba(15,23,42,0.07)] transition hover:-translate-y-1 hover:border-yellow-400"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400 text-black">
              <FileText size={26} />
            </span>

            <h2 className="mt-7 text-2xl font-black text-slate-950">
              {english
                ? "Terms and Conditions"
                : "T\u00e9rminos y Condiciones"}
            </h2>

            <p className="mt-3 text-sm leading-7 text-slate-500">
              {english
                ? "Rules, responsibilities and conditions for using AXI."
                : "Reglas, responsabilidades y condiciones para utilizar AXI."}
            </p>

            <span className="mt-7 inline-flex items-center gap-2 font-black text-slate-950">
              {english
                ? "Open document"
                : "Abrir documento"}
              <ArrowRight
                size={18}
                className="transition group-hover:translate-x-1"
              />
            </span>
          </Link>

          <Link
            href={"/legal/" + role + "/privacy"}
            className="group rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_18px_55px_rgba(15,23,42,0.07)] transition hover:-translate-y-1 hover:border-yellow-400"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-yellow-400">
              <ShieldCheck size={26} />
            </span>

            <h2 className="mt-7 text-2xl font-black text-slate-950">
              {english
                ? "Privacy Policy"
                : "Pol\u00edtica de Privacidad"}
            </h2>

            <p className="mt-3 text-sm leading-7 text-slate-500">
              {english
                ? "How AXI will handle and protect your personal information."
                : "C\u00f3mo AXI tratar\u00e1 y proteger\u00e1 tu informaci\u00f3n personal."}
            </p>

            <span className="mt-7 inline-flex items-center gap-2 font-black text-slate-950">
              {english
                ? "Open document"
                : "Abrir documento"}
              <ArrowRight
                size={18}
                className="transition group-hover:translate-x-1"
              />
            </span>
          </Link>
        </section>

        <p className="mt-7 text-center text-xs leading-6 text-slate-400">
          {english
            ? "The definitive legal content has not been published yet."
            : "El contenido legal definitivo todav\u00eda no ha sido publicado."}
        </p>
      </div>
    </main>
  );
}
