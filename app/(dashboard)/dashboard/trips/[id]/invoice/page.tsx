"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";
import {
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  ReceiptText,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type BillingProfile = {
  taxpayer_name: string;
  rfc: string;
  tax_regime: string;
  fiscal_postal_code: string;
  cfdi_use: string;
  email: string | null;
};

type PaymentTransaction = {
  id: string;
  trip_id: string;
  passenger_id: string;
  status: string;
  method: string;
  total_amount: number;
};

type InvoiceRequest = {
  id: string;
  status: string;
  taxpayer_name: string;
  rfc: string;
  tax_regime: string;
  fiscal_postal_code: string;
  cfdi_use: string;
  billing_email: string | null;
  total_amount: number;
  uuid_fiscal: string | null;
  xml_url: string | null;
  pdf_url: string | null;
  error_message: string | null;
  requested_at: string;
  issued_at: string | null;
};

const taxRegimes = [
  ["601", "General de Ley Personas Morales"],
  ["603", "Personas Morales con Fines no Lucrativos"],
  ["605", "Sueldos y Salarios"],
  ["606", "Arrendamiento"],
  ["608", "Demás ingresos"],
  ["612", "Personas Físicas con Actividades Empresariales"],
  ["616", "Sin obligaciones fiscales"],
  ["621", "Incorporación Fiscal"],
  ["625", "Actividades Empresariales con ingresos por plataformas"],
  ["626", "Régimen Simplificado de Confianza"],
];

const cfdiUses = [
  ["G01", "Adquisición de mercancías"],
  ["G02", "Devoluciones, descuentos o bonificaciones"],
  ["G03", "Gastos en general"],
  ["D01", "Honorarios médicos, dentales y hospitalarios"],
  ["D10", "Pagos por servicios educativos"],
  ["S01", "Sin efectos fiscales"],
  ["CP01", "Pagos"],
];

export default function TripInvoicePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tripId = params.id;

  const [payment, setPayment] =
    useState<PaymentTransaction | null>(null);

  const [invoice, setInvoice] =
    useState<InvoiceRequest | null>(null);

  const [taxpayerName, setTaxpayerName] =
    useState("");

  const [rfc, setRfc] =
    useState("");

  const [taxRegime, setTaxRegime] =
    useState("");

  const [fiscalPostalCode, setFiscalPostalCode] =
    useState("");

  const [cfdiUse, setCfdiUse] =
    useState("G03");

  const [billingEmail, setBillingEmail] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    void loadInvoiceData();
  }, [tripId]);

  async function loadInvoiceData() {
    setLoading(true);
    setErrorMessage("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    const { data: trip, error: tripError } =
      await supabase
        .from("trips")
        .select(`
          id,
          passenger_id,
          status
        `)
        .eq("id", tripId)
        .single();

    if (tripError || !trip) {
      setErrorMessage(
        `No fue posible cargar el viaje: ${
          tripError?.message ?? "Viaje no encontrado"
        }`
      );
      setLoading(false);
      return;
    }

    if (trip.passenger_id !== session.user.id) {
      setErrorMessage(
        "Solo el pasajero puede solicitar esta factura."
      );
      setLoading(false);
      return;
    }

    if (trip.status !== "completed") {
      setErrorMessage(
        "La factura estará disponible cuando termine el viaje."
      );
      setLoading(false);
      return;
    }

    const {
      data: paymentData,
      error: paymentError,
    } = await supabase
      .from("payment_transactions")
      .select(`
        id,
        trip_id,
        passenger_id,
        status,
        method,
        total_amount
      `)
      .eq("trip_id", tripId)
      .maybeSingle();

    if (paymentError) {
      setErrorMessage(
        `No fue posible cargar el pago: ${paymentError.message}`
      );
      setLoading(false);
      return;
    }

    if (!paymentData) {
      setErrorMessage(
        "Primero debes registrar el pago del viaje."
      );
      setLoading(false);
      return;
    }

    const loadedPayment =
      paymentData as PaymentTransaction;

    setPayment(loadedPayment);

    const {
      data: profileData,
    } = await supabase
      .from("passenger_billing_profiles")
      .select(`
        taxpayer_name,
        rfc,
        tax_regime,
        fiscal_postal_code,
        cfdi_use,
        email
      `)
      .eq("passenger_id", session.user.id)
      .maybeSingle();

    if (profileData) {
      const profile =
        profileData as BillingProfile;

      setTaxpayerName(
        profile.taxpayer_name ?? ""
      );

      setRfc(
        profile.rfc ?? ""
      );

      setTaxRegime(
        profile.tax_regime ?? ""
      );

      setFiscalPostalCode(
        profile.fiscal_postal_code ?? ""
      );

      setCfdiUse(
        profile.cfdi_use ?? "G03"
      );

      setBillingEmail(
        profile.email ??
          session.user.email ??
          ""
      );
    } else {
      setBillingEmail(
        session.user.email ?? ""
      );
    }

    const {
      data: invoiceData,
    } = await supabase
      .from("invoice_requests")
      .select(`
        id,
        status,
        taxpayer_name,
        rfc,
        tax_regime,
        fiscal_postal_code,
        cfdi_use,
        billing_email,
        total_amount,
        uuid_fiscal,
        xml_url,
        pdf_url,
        error_message,
        requested_at,
        issued_at
      `)
      .eq(
        "payment_transaction_id",
        loadedPayment.id
      )
      .maybeSingle();

    if (invoiceData) {
      const loadedInvoice =
        invoiceData as InvoiceRequest;

      setInvoice(loadedInvoice);

      setTaxpayerName(
        loadedInvoice.taxpayer_name
      );

      setRfc(
        loadedInvoice.rfc
      );

      setTaxRegime(
        loadedInvoice.tax_regime
      );

      setFiscalPostalCode(
        loadedInvoice.fiscal_postal_code
      );

      setCfdiUse(
        loadedInvoice.cfdi_use
      );

      setBillingEmail(
        loadedInvoice.billing_email ?? ""
      );
    }

    setLoading(false);
  }

  function normalizeRfc(value: string) {
    return value
      .toUpperCase()
      .replace(/\s/g, "")
      .slice(0, 13);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!payment) return;

    const cleanName =
      taxpayerName.trim();

    const cleanRfc =
      normalizeRfc(rfc);

    const cleanRegime =
      taxRegime.trim();

    const cleanPostalCode =
      fiscalPostalCode.trim();

    const cleanEmail =
      billingEmail.trim().toLowerCase();

    if (!cleanName) {
      setErrorMessage(
        "Escribe tu nombre o razón social."
      );
      return;
    }

    if (
      !/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(
        cleanRfc
      )
    ) {
      setErrorMessage(
        "El RFC no tiene un formato válido."
      );
      return;
    }

    if (!cleanRegime) {
      setErrorMessage(
        "Selecciona tu régimen fiscal."
      );
      return;
    }

    if (!/^[0-9]{5}$/.test(cleanPostalCode)) {
      setErrorMessage(
        "El código postal fiscal debe tener 5 números."
      );
      return;
    }

    if (
      cleanEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        cleanEmail
      )
    ) {
      setErrorMessage(
        "El correo electrónico no es válido."
      );
      return;
    }

    const confirmed = window.confirm(
      "¿Confirmas que tus datos fiscales son correctos?"
    );

    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    setErrorMessage("");

    const {
      error,
    } = await supabase.rpc(
      "request_trip_invoice",
      {
        p_payment_transaction_id:
          payment.id,
        p_taxpayer_name:
          cleanName,
        p_rfc:
          cleanRfc,
        p_tax_regime:
          cleanRegime,
        p_fiscal_postal_code:
          cleanPostalCode,
        p_cfdi_use:
          cfdiUse,
        p_billing_email:
          cleanEmail || null,
      }
    );

    setSaving(false);

    if (error) {
      setErrorMessage(
        `No fue posible solicitar la factura: ${error.message}`
      );
      return;
    }

    setMessage(
      "Solicitud de factura registrada correctamente."
    );

    await loadInvoiceData();
  }

  function statusLabel(status: string) {
    switch (status) {
      case "pending":
        return "Pendiente de emisión";
      case "processing":
        return "Procesando";
      case "issued":
        return "Factura emitida";
      case "failed":
        return "Error al emitir";
      case "cancelled":
        return "Cancelada";
      default:
        return status;
    }
  }

  function statusClass(status: string) {
    switch (status) {
      case "issued":
        return "bg-emerald-100 text-emerald-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "cancelled":
        return "bg-slate-200 text-slate-700";
      default:
        return "bg-amber-100 text-amber-800";
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2
          className="animate-spin"
          size={30}
        />
      </div>
    );
  }

  if (!payment) {
    return (
      <section className="mx-auto max-w-3xl">
        <div className="rounded-2xl bg-red-50 p-6 text-red-700">
          {errorMessage ||
            "No fue posible abrir la facturación."}
        </div>
      </section>
    );
  }

  const canEdit =
    !invoice ||
    invoice.status === "failed" ||
    invoice.status === "cancelled";

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <button
          type="button"
          onClick={() =>
            router.push(
              `/dashboard/trips/${tripId}/receipt`
            )
          }
          className="mb-5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold hover:bg-slate-50"
        >
          Volver al recibo
        </button>

        <p className="text-sm font-bold text-yellow-600">
          Facturación del viaje
        </p>

        <h1 className="mt-1 text-3xl font-black text-slate-900">
          Solicitar factura
        </h1>

        <p className="mt-2 text-slate-600">
          Registra tus datos fiscales para solicitar
          el CFDI de este viaje.
        </p>
      </div>

      <div className="rounded-2xl bg-[#0B0F19] p-6 text-white">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-sm text-slate-400">
              Total pagado
            </p>

            <p className="mt-1 text-3xl font-black">
              $
              {Number(
                payment.total_amount
              ).toLocaleString("es-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              MXN
            </p>

            <p className="mt-2 text-sm text-slate-400">
              Método: {payment.method}
            </p>
          </div>

          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 text-black">
            <ReceiptText size={23} />
          </span>
        </div>
      </div>

      {invoice && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-slate-500">
                Estado de la solicitud
              </p>

              <span
                className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-black ${statusClass(
                  invoice.status
                )}`}
              >
                {statusLabel(invoice.status)}
              </span>
            </div>

            {invoice.status === "issued" && (
              <CheckCircle2
                className="text-emerald-600"
                size={30}
              />
            )}
          </div>

          {invoice.uuid_fiscal && (
            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                UUID fiscal
              </p>

              <p className="mt-1 break-all font-mono text-sm font-bold">
                {invoice.uuid_fiscal}
              </p>
            </div>
          )}

          {invoice.error_message && (
            <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">
              {invoice.error_message}
            </div>
          )}

          {(invoice.xml_url ||
            invoice.pdf_url) && (
            <div className="mt-5 flex flex-wrap gap-3">
              {invoice.pdf_url && (
                <a
                  href={invoice.pdf_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-black text-white"
                >
                  <Download size={17} />
                  Descargar PDF
                </a>
              )}

              {invoice.xml_url && (
                <a
                  href={invoice.xml_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-black"
                >
                  <FileText size={17} />
                  Descargar XML
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {canEdit ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl bg-white p-6 shadow-sm sm:p-8"
        >
          <div>
            <label
              htmlFor="taxpayerName"
              className="text-sm font-black text-slate-700"
            >
              Nombre o razón social
            </label>

            <input
              id="taxpayerName"
              value={taxpayerName}
              onChange={(event) =>
                setTaxpayerName(
                  event.target.value
                )
              }
              placeholder="Como aparece en tu constancia fiscal"
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-black"
              required
            />
          </div>

          <div>
            <label
              htmlFor="rfc"
              className="text-sm font-black text-slate-700"
            >
              RFC
            </label>

            <input
              id="rfc"
              value={rfc}
              onChange={(event) =>
                setRfc(
                  normalizeRfc(
                    event.target.value
                  )
                )
              }
              placeholder="XAXX010101000"
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 font-mono uppercase outline-none focus:border-black"
              required
            />
          </div>

          <div>
            <label
              htmlFor="taxRegime"
              className="text-sm font-black text-slate-700"
            >
              Régimen fiscal
            </label>

            <select
              id="taxRegime"
              value={taxRegime}
              onChange={(event) =>
                setTaxRegime(
                  event.target.value
                )
              }
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 outline-none focus:border-black"
              required
            >
              <option value="">
                Selecciona una opción
              </option>

              {taxRegimes.map(
                ([code, label]) => (
                  <option
                    key={code}
                    value={code}
                  >
                    {code} - {label}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="postalCode"
              className="text-sm font-black text-slate-700"
            >
              Código postal fiscal
            </label>

            <input
              id="postalCode"
              value={fiscalPostalCode}
              onChange={(event) =>
                setFiscalPostalCode(
                  event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 5)
                )
              }
              inputMode="numeric"
              placeholder="72760"
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-black"
              required
            />
          </div>

          <div>
            <label
              htmlFor="cfdiUse"
              className="text-sm font-black text-slate-700"
            >
              Uso del CFDI
            </label>

            <select
              id="cfdiUse"
              value={cfdiUse}
              onChange={(event) =>
                setCfdiUse(
                  event.target.value
                )
              }
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 outline-none focus:border-black"
              required
            >
              {cfdiUses.map(
                ([code, label]) => (
                  <option
                    key={code}
                    value={code}
                  >
                    {code} - {label}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="billingEmail"
              className="text-sm font-black text-slate-700"
            >
              Correo para la factura
            </label>

            <input
              id="billingEmail"
              type="email"
              value={billingEmail}
              onChange={(event) =>
                setBillingEmail(
                  event.target.value
                )
              }
              placeholder="correo@ejemplo.com"
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-black"
            />
          </div>

          {errorMessage && (
            <div className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">
              {errorMessage}
            </div>
          )}

          {message && (
            <div className="rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-black px-5 py-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2
                  className="animate-spin"
                  size={18}
                />
                Guardando solicitud...
              </>
            ) : (
              <>
                <ReceiptText size={18} />
                Solicitar factura
              </>
            )}
          </button>
        </form>
      ) : (
        <div className="rounded-2xl bg-blue-50 p-5 text-sm font-bold text-blue-800">
          La solicitud ya fue registrada. Tus datos
          fiscales quedaron bloqueados para evitar
          cambios durante el proceso de emisión.
        </div>
      )}
    </section>
  );
}
