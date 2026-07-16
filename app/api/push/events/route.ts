import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as webpush from "web-push";

export const runtime = "nodejs";

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
};

type PushMessage = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

function getString(
  value: unknown
): string | null {
  return typeof value === "string"
    ? value
    : null;
}

function uniqueIds(
  values: Array<string | null>
) {
  return [...new Set(values.filter(
    (value): value is string =>
      Boolean(value)
  ))];
}

function statusMessage(
  status: string,
  tripId: string
): PushMessage | null {
  const messages: Record<
    string,
    Omit<PushMessage, "url">
  > = {
    accepted: {
      title: "Viaje aceptado",
      body: "Un conductor aceptó tu solicitud.",
      tag: `trip-${tripId}-accepted`,
    },
    driver_arriving: {
      title: "Conductor en camino",
      body: "Tu conductor se dirige al punto de partida.",
      tag: `trip-${tripId}-arriving`,
    },
    driver_arrived: {
      title: "Tu conductor llegó",
      body: "El taxi ya se encuentra en el punto de partida.",
      tag: `trip-${tripId}-arrived`,
    },
    in_progress: {
      title: "Viaje iniciado",
      body: "Tu viaje con AXI ha comenzado.",
      tag: `trip-${tripId}-started`,
    },
    completed: {
      title: "Viaje terminado",
      body: "Tu viaje finalizó correctamente.",
      tag: `trip-${tripId}-completed`,
    },
    cancelled: {
      title: "Viaje cancelado",
      body: "El viaje fue cancelado.",
      tag: `trip-${tripId}-cancelled`,
    },
  };

  const message = messages[status];

  return message
    ? {
        ...message,
        url: `/dashboard/trips/${tripId}`,
      }
    : null;
}

export async function POST(
  request: NextRequest
) {
  try {
    const expectedSecret =
      process.env.PUSH_WEBHOOK_SECRET;

    const receivedSecret =
      request.headers.get(
        "x-webhook-secret"
      );

    if (
      !expectedSecret ||
      receivedSecret !== expectedSecret
    ) {
      return NextResponse.json(
        { error: "Webhook no autorizado." },
        { status: 401 }
      );
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    const publicKey =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    const privateKey =
      process.env.VAPID_PRIVATE_KEY;

    const subject =
      process.env.VAPID_SUBJECT;

    if (
      !supabaseUrl ||
      !serviceRoleKey ||
      !publicKey ||
      !privateKey ||
      !subject
    ) {
      return NextResponse.json(
        {
          error:
            "Faltan variables del servidor.",
        },
        { status: 500 }
      );
    }

    const payload =
      (await request.json()) as WebhookPayload;

    if (!payload.record) {
      return NextResponse.json({
        success: true,
        sent: 0,
      });
    }

    let recipientIds: string[] = [];
    let message: PushMessage | null = null;

    if (
      payload.table === "trip_offers" &&
      payload.type === "INSERT"
    ) {
      const driverId =
        getString(payload.record.driver_id);

      const tripId =
        getString(payload.record.trip_id);

      const status =
        getString(payload.record.status);

      if (
        driverId &&
        tripId &&
        status === "pending"
      ) {
        recipientIds = [driverId];

        message = {
          title: "Nuevo viaje disponible",
          body:
            "Tienes una nueva solicitud cerca de tu ubicación.",
          url:
            "/dashboard/driver/available-trips",
          tag: `trip-offer-${tripId}`,
        };
      }
    }

    if (
      payload.table === "trips" &&
      payload.type === "UPDATE"
    ) {
      const tripId =
        getString(payload.record.id);

      const newStatus =
        getString(payload.record.status);

      const oldStatus =
        getString(
          payload.old_record?.status
        );

      const passengerId =
        getString(
          payload.record.passenger_id
        );

      const driverId =
        getString(payload.record.driver_id);

      if (
        tripId &&
        newStatus &&
        newStatus !== oldStatus
      ) {
        message = statusMessage(
          newStatus,
          tripId
        );

        recipientIds =
          newStatus === "cancelled"
            ? uniqueIds([
                passengerId,
                driverId,
              ])
            : uniqueIds([passengerId]);
      }
    }

    if (
      !message ||
      recipientIds.length === 0
    ) {
      return NextResponse.json({
        success: true,
        sent: 0,
        reason:
          "El evento no requiere notificación.",
      });
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { data, error } =
      await supabase
        .from("push_subscriptions")
        .select(
          "id, endpoint, p256dh, auth_key"
        )
        .in("user_id", recipientIds)
        .eq("enabled", true);

    if (error) {
      throw new Error(error.message);
    }

    const subscriptions =
      (data ?? []) as PushSubscriptionRow[];

    webpush.setVapidDetails(
      subject,
      publicKey,
      privateKey
    );

    let sent = 0;
    const expiredIds: string[] = [];

    await Promise.all(
      subscriptions.map(
        async (subscription) => {
          try {
            await webpush.sendNotification(
              {
                endpoint:
                  subscription.endpoint,
                keys: {
                  p256dh:
                    subscription.p256dh,
                  auth:
                    subscription.auth_key,
                },
              },
              JSON.stringify(message)
            );

            sent += 1;
          } catch (error) {
            const pushError =
              error as {
                statusCode?: number;
              };

            if (
              pushError.statusCode === 404 ||
              pushError.statusCode === 410
            ) {
              expiredIds.push(
                subscription.id
              );
              return;
            }

            console.error(
              "Error enviando push:",
              error
            );
          }
        }
      )
    );

    if (expiredIds.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("id", expiredIds);
    }

    return NextResponse.json({
      success: true,
      sent,
      expiredRemoved:
        expiredIds.length,
    });
  } catch (error) {
    console.error(
      "Error en /api/push/events:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error inesperado.",
      },
      { status: 500 }
    );
  }
}
