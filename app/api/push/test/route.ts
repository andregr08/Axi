import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as webpush from "web-push";

export const runtime = "nodejs";

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
};

export async function POST(request: NextRequest) {
  try {
    const authorization =
      request.headers.get("authorization");

    if (
      !authorization ||
      !authorization.startsWith("Bearer ")
    ) {
      return NextResponse.json(
        {
          error: "Sesión no disponible.",
        },
        {
          status: 401,
        }
      );
    }

    const accessToken =
      authorization.replace("Bearer ", "");

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const vapidPublicKey =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    const vapidPrivateKey =
      process.env.VAPID_PRIVATE_KEY;

    const vapidSubject =
      process.env.VAPID_SUBJECT;

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !vapidPublicKey ||
      !vapidPrivateKey ||
      !vapidSubject
    ) {
      return NextResponse.json(
        {
          error:
            "Faltan variables de configuración para notificaciones.",
        },
        {
          status: 500,
        }
      );
    }

    webpush.setVapidDetails(
      vapidSubject,
      vapidPublicKey,
      vapidPrivateKey
    );

    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(
      accessToken
    );

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "La sesión no es válida.",
        },
        {
          status: 401,
        }
      );
    }

    const {
      data,
      error: subscriptionError,
    } = await supabase
      .from("push_subscriptions")
      .select(
        "id, endpoint, p256dh, auth_key"
      )
      .eq("user_id", user.id)
      .eq("enabled", true);

    if (subscriptionError) {
      return NextResponse.json(
        {
          error:
            subscriptionError.message,
        },
        {
          status: 500,
        }
      );
    }

    const subscriptions =
      (data ?? []) as PushSubscriptionRow[];

    if (subscriptions.length === 0) {
      return NextResponse.json(
        {
          error:
            "No hay dispositivos suscritos para este usuario.",
        },
        {
          status: 404,
        }
      );
    }

    const payload = JSON.stringify({
      title: "AXI Mobility",
      body:
        "Las notificaciones están funcionando correctamente.",
      url: "/dashboard/profile",
      tag: "axi-push-test",
    });

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
              payload
            );

            sent += 1;
          } catch (error) {
            const pushError =
              error as {
                statusCode?: number;
                message?: string;
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
              "Error enviando notificación push:",
              pushError.message ??
                pushError
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

    if (sent === 0) {
      return NextResponse.json(
        {
          error:
            "No se pudo entregar la notificación a ningún dispositivo.",
        },
        {
          status: 502,
        }
      );
    }

    return NextResponse.json({
      success: true,
      sent,
      expiredRemoved:
        expiredIds.length,
    });
  } catch (error) {
    console.error(
      "Error en POST /api/push/test:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error inesperado enviando la notificación.",
      },
      {
        status: 500,
      }
    );
  }
}
