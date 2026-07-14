"use client";

import {
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type SosAlert = {
  id: string;
  user_id: string;
  trip_id: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  message: string | null;
  created_at: string;

  profiles: {
    full_name: string | null;
    phone: string |null;
  } | null;
};

export default function AdminSOSPage() {

  const router = useRouter();

  const [alerts,setAlerts] =
    useState<SosAlert[]>([]);

  const [loading,setLoading] =
    useState(true);

  const [message,setMessage] =
    useState("");

  const [processing,setProcessing] =
    useState<string | null>(null);

  async function loadAlerts(){

    setLoading(true);
    setMessage("");

    const {
      data:{session}
    } =
    await supabase.auth.getSession();

    if(!session){
      router.replace("/login");
      return;
    }

    const {
      data:profile
    } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id",session.user.id)
      .single();

    if(profile?.role!=="admin"){
      router.replace("/dashboard");
      return;
    }

    const {
      data,
      error
    } =
    await supabase
      .from("sos_alerts")
      .select(`
        *,
        profiles:user_id(
          full_name,
          phone
        )
      `)
      .order(
        "created_at",
        {
          ascending:false
        }
      );

    if(error){

      setMessage(error.message);

    }else{

      setAlerts(
        (data??[]) as SosAlert[]
      );

    }

    setLoading(false);

  }

  useEffect(()=>{

    const timer =
      window.setTimeout(()=>{

        void loadAlerts();

      },0);

    return ()=>window.clearTimeout(timer);

  },[]);

  async function updateAlert(
    id:string,
    status:string
  ){

    setProcessing(id);

    const {error} =
      await supabase.rpc(
        "update_sos_alert",
        {
          alert_id_value:id,
          new_status_value:status
        }
      );

    if(error){

      setMessage(error.message);

    }else{

      await loadAlerts();

    }

    setProcessing(null);

  }

  function color(status:string){

    switch(status){

      case "active":
        return "bg-red-100 text-red-700";

      case "acknowledged":
        return "bg-yellow-100 text-yellow-700";

      case "resolved":
        return "bg-green-100 text-green-700";

      default:
        return "bg-gray-100";

    }

  }


  const activeAlerts = alerts.filter(
    (alert) => alert.status === "active"
  );

  const acknowledgedAlerts = alerts.filter(
    (alert) => alert.status === "acknowledged"
  );

  const resolvedAlerts = alerts.filter(
    (alert) =>
      alert.status === "resolved" ||
      alert.status === "false_alarm"
  );

  function formatDate(value: string) {
    return new Date(value).toLocaleString(
      "es-MX",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    );
  }

  function getProfile(alert: SosAlert) {
    if (Array.isArray(alert.profiles)) {
      return alert.profiles[0];
    }

    return alert.profiles;
  }

  if (loading) {
    return <p>Cargando alertas SOS...</p>;
  }

  return (
    <section>
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Seguridad AXI
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          Alertas SOS
        </h1>

        <p className="mt-2 text-gray-600">
          Revisa y atiende emergencias reportadas por pasajeros y conductores.
        </p>
      </div>

      <div className="mb-8 grid gap-5 md:grid-cols-3">
        <div className="rounded-2xl bg-red-600 p-6 text-white">
          <p className="text-sm text-red-100">
            Alertas activas
          </p>

          <p className="mt-3 text-3xl font-bold">
            {activeAlerts.length}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            En atención
          </p>

          <p className="mt-3 text-3xl font-bold">
            {acknowledgedAlerts.length}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            Cerradas
          </p>

          <p className="mt-3 text-3xl font-bold">
            {resolvedAlerts.length}
          </p>
        </div>
      </div>

      {message && (
        <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {message}
        </div>
      )}

      {alerts.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
          <p className="font-semibold text-gray-700">
            No hay alertas SOS registradas.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {alerts.map((alert) => {
            const profile = getProfile(alert);

            const isProcessing =
              processing === alert.id;

            return (
              <article
                key={alert.id}
                className={`rounded-2xl border-2 bg-white p-6 shadow-sm ${
                  alert.status === "active"
                    ? "border-red-300"
                    : "border-transparent"
                }`}
              >
                <div className="flex flex-col justify-between gap-6 xl:flex-row">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-bold">
                        {profile?.full_name ||
                          "Usuario AXI"}
                      </h2>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${color(
                          alert.status
                        )}`}
                      >
                        {alert.status === "active" &&
                          "Activa"}

                        {alert.status ===
                          "acknowledged" &&
                          "En atención"}

                        {alert.status ===
                          "resolved" &&
                          "Resuelta"}

                        {alert.status ===
                          "false_alarm" &&
                          "Falsa alarma"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-2 text-sm text-gray-600">
                      <p>
                        Teléfono:{" "}
                        {profile?.phone ||
                          "No registrado"}
                      </p>

                      <p>
                        Fecha:{" "}
                        {formatDate(
                          alert.created_at
                        )}
                      </p>

                      <p>
                        Viaje relacionado:{" "}
                        {alert.trip_id ||
                          "Sin viaje relacionado"}
                      </p>
                    </div>

                    {alert.message && (
                      <div className="mt-5 rounded-xl bg-red-50 p-4">
                        <p className="text-sm font-semibold text-red-700">
                          Mensaje del usuario
                        </p>

                        <p className="mt-1 whitespace-pre-wrap text-sm text-red-700">
                          {alert.message}
                        </p>
                      </div>
                    )}

                    {alert.latitude !== null &&
                      alert.longitude !== null && (
                        <div className="mt-5 rounded-xl bg-gray-50 p-4">
                          <p className="text-sm font-semibold text-gray-700">
                            Ubicación registrada
                          </p>

                          <p className="mt-1 text-sm text-gray-600">
                            Latitud:{" "}
                            {Number(
                              alert.latitude
                            ).toFixed(6)}
                          </p>

                          <p className="mt-1 text-sm text-gray-600">
                            Longitud:{" "}
                            {Number(
                              alert.longitude
                            ).toFixed(6)}
                          </p>

                          <a
                            href={`https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-block text-sm font-semibold text-blue-600"
                          >
                            Abrir ubicación
                          </a>
                        </div>
                      )}
                  </div>

                  <div className="xl:w-64">
                    {alert.status === "active" && (
                      <button
                        type="button"
                        onClick={() =>
                          updateAlert(
                            alert.id,
                            "acknowledged"
                          )
                        }
                        disabled={isProcessing}
                        className="w-full rounded-xl bg-yellow-500 px-4 py-3 font-semibold text-white disabled:opacity-50"
                      >
                        {isProcessing
                          ? "Actualizando..."
                          : "Tomar alerta"}
                      </button>
                    )}

                    {alert.status ===
                      "acknowledged" && (
                        <button
                          type="button"
                          onClick={() =>
                            updateAlert(
                              alert.id,
                              "resolved"
                            )
                          }
                          disabled={isProcessing}
                          className="w-full rounded-xl bg-green-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
                        >
                          {isProcessing
                            ? "Actualizando..."
                            : "Marcar resuelta"}
                        </button>
                      )}

                    {[
                      "active",
                      "acknowledged",
                    ].includes(alert.status) && (
                      <button
                        type="button"
                        onClick={() =>
                          updateAlert(
                            alert.id,
                            "false_alarm"
                          )
                        }
                        disabled={isProcessing}
                        className="mt-3 w-full rounded-xl border border-gray-300 px-4 py-3 font-semibold disabled:opacity-50"
                      >
                        Marcar falsa alarma
                      </button>
                    )}

                    {alert.trip_id && (
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/dashboard/trips/${alert.trip_id}`
                          )
                        }
                        className="mt-3 w-full rounded-xl border px-4 py-3 font-semibold"
                      >
                        Ver viaje
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
