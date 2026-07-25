import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { askAI } from "@/lib/ai/service";

type ConversationStatus = "active" | "waiting_human" | "closed";

type StoredMessage = {
  sender_type: "user" | "assistant" | "support" | "system";
  content: string;
};

function createAuthenticatedClient(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Faltan las variables públicas de Supabase.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");

    const accessToken = authorization?.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Sesión requerida.",
        },
        { status: 401 },
      );
    }

    const body = await request.json();

    const message =
      typeof body?.message === "string"
        ? body.message.trim()
        : "";

    const conversationId =
      typeof body?.conversationId === "string"
        ? body.conversationId.trim()
        : "";

    if (!message) {
      return NextResponse.json(
        {
          success: false,
          error: "Mensaje requerido.",
        },
        { status: 400 },
      );
    }

    /*
     * Compatibilidad para clientes que todavía no envían conversationId.
     */
    if (!conversationId) {
      const result = await askAI({
        accessToken,
        message,
        history: Array.isArray(body?.history)
          ? body.history
          : [],
      });

      return NextResponse.json({
        success: true,
        provider: "gemini",
        response: result.response,
        conversationId: null,
      });
    }

    const supabase = createAuthenticatedClient(accessToken);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "La sesión del usuario no es válida.",
        },
        { status: 401 },
      );
    }

    const { data: conversation, error: conversationError } = await supabase
      .from("ai_conversations")
      .select("id, user_id, status")
      .eq("id", conversationId)
      .maybeSingle();

    if (conversationError) {
      throw new Error(
        `No se pudo consultar la conversación: ${conversationError.message}`,
      );
    }

    if (!conversation || conversation.user_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Conversación no encontrada.",
        },
        { status: 404 },
      );
    }

    const conversationStatus =
      conversation.status as ConversationStatus;

    if (conversationStatus === "waiting_human") {
      return NextResponse.json(
        {
          success: false,
          code: "HUMAN_SUPPORT_ACTIVE",
          error:
            "Esta conversación está siendo atendida por soporte. AXI AI permanecerá pausada.",
        },
        { status: 409 },
      );
    }

    if (conversationStatus === "closed") {
      return NextResponse.json(
        {
          success: false,
          code: "CONVERSATION_CLOSED",
          error: "Esta conversación está cerrada.",
        },
        { status: 409 },
      );
    }

    const { data: storedMessages, error: historyError } = await supabase
      .from("ai_messages")
      .select("sender_type, content, created_at")
      .eq("conversation_id", conversationId)
      .in("sender_type", ["user", "assistant"])
      .order("created_at", {
        ascending: false,
      })
      .limit(12);

    if (historyError) {
      throw new Error(
        `No se pudo cargar el historial: ${historyError.message}`,
      );
    }

    const conversationHistory = ((storedMessages ?? []) as StoredMessage[])
      .reverse()
      .map((storedMessage) => ({
        role:
          storedMessage.sender_type === "assistant"
            ? ("assistant" as const)
            : ("user" as const),
        content: storedMessage.content,
      }));

    const { error: userMessageError } = await supabase
      .from("ai_messages")
      .insert({
        conversation_id: conversationId,
        sender_type: "user",
        sender_user_id: user.id,
        content: message,
      });

    if (userMessageError) {
      throw new Error(
        `No se pudo guardar tu mensaje: ${userMessageError.message}`,
      );
    }

    const result = await askAI({
      accessToken,
      message,
      history: conversationHistory,
    });

    const { error: assistantMessageError } = await supabase.rpc(
      "append_ai_assistant_message",
      {
        requested_conversation_id: conversationId,
        message_content: result.response,
      },
    );

    if (assistantMessageError) {
      throw new Error(
        `AXI AI respondió, pero no se pudo guardar la respuesta: ${assistantMessageError.message}`,
      );
    }

    return NextResponse.json({
      success: true,
      provider: "gemini",
      response: result.response,
      conversationId,
    });
  } catch (error) {
    console.error("AXI AI route error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno de AXI AI.",
      },
      { status: 500 },
    );
  }
}
