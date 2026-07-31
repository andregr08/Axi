"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Clock3,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { useLanguage } from "@/hooks/useLanguage";

type LegalRole = "passenger" | "driver";
type LegalDocumentKind = "terms" | "privacy";

type LegalDocumentPlaceholderProps = {
  role: LegalRole;
  kind: LegalDocumentKind;
};

export function LegalDocumentPlaceholder({
  role,
  kind,
}: LegalDocumentPlaceholderProps) {
  const { locale } = useLanguage();
  const english = locale === "en";

  const roleName =
    role === "driver"
      ? english
        ? "Driver"
        : "Conductor"
      : english
        ? "Passenger"
        : "Pasajero";

  const title =
    kind === "terms"
      ? english
        ? "Terms and Conditions"
        : "T\u00e9rminos y Condiciones"
      : english
        ? "Privacy Policy"
        : "Pol\u00edtica de Privacidad";

  const description =
    kind === "terms"
      ? english
        ? "This section is prepared for the rules, responsibilities and conditions applicable to the account."
        : "Esta secci\u00f3n est\u00e1 preparada para las reglas, responsabilidades y condiciones aplicables a la cuenta."
      : english
        ? "This section is prepared to explain how AXI handles and protects personal information."
        : "Esta secci\u00f3n est\u00e1 preparada para explicar c\u00f3mo AXI trata y protege la informaci\u00f3n personal.";

  const Icon =
    kind === "terms"
      ? FileText
      : ShieldCheck;

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <Logo href="/" />

          <span className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-yellow-400">
            {roleName}
          </span>
        </div>

        <Link
          href={"/legal/" + role}
          className="mt-10 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
        >
          <ArrowLeft size={18} />
          {english
            ? "Back to Legal"
            : "Volver a Legal"}
        </Link>

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_22px_70px_rgba(15,23,42,0.08)]">
          <div className="bg-[#0B0F19] px-6 py-9 text-white sm:px-10 sm:py-11">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400 text-black">
              <Icon size={27} />
            </span>

            <p className="mt-7 text-xs font-black uppercase tracking-[0.18em] text-yellow-400">
              AXI Mobility
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              {title}
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              {description}
            </p>
          </div>

          <div className="p-6 sm:p-10">
            <div className="rounded-[1.7rem] border border-amber-200 bg-amber-50 p-6">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <Clock3 size={23} />
                </span>

                <div>
                  <h2 className="text-xl font-black text-slate-950">
                    {english
                      ? "Document pending publication"
                      : "Documento pendiente de publicaci\u00f3n"}
                  </h2>

                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {english
                      ? "The page, navigation and account-specific behavior are ready. The definitive legal document will be added after its approval."
                      : "La p\u00e1gina, la navegaci\u00f3n y el comportamiento seg\u00fan el tipo de cuenta ya est\u00e1n listos. El documento legal definitivo se agregar\u00e1 despu\u00e9s de su aprobaci\u00f3n."}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-7 rounded-[1.7rem] bg-slate-50 p-6">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                {english
                  ? "Document for"
                  : "Documento para"}
              </p>

              <p className="mt-2 text-lg font-black text-slate-950">
                {roleName}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
