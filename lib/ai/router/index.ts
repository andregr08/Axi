import type { AIContext } from "../prompt";
import type { AIIntent } from "../intents";
import { executeAction } from "../actions/index";
import { executeTool } from "../tools";
import { registry } from "./registry";

type ExecuteIntentParams = {
  intent: AIIntent;
  context: AIContext;
  accessToken: string;
  message: string;
};

export async function executeIntent({
  intent,
  context,
  accessToken,
  message,
}: ExecuteIntentParams) {
  const route = registry[intent];

  if (route.type === "chat") {
    return {
      type: "chat",
      data: null,
    };
  }

  if (route.type === "action") {
    const data = await executeAction(
      route.action,
      {
        context,
        accessToken,
        message,
      }
    );

    return {
      type: "action",
      name: route.action,
      data,
    };
  }

  const results: Record<
    string,
    unknown
  > = {};

  await Promise.all(
    route.tools.map(async (tool) => {
      results[tool] = await executeTool(
        tool,
        {
          context,
          accessToken,
        }
      );
    })
  );

  return {
    type: "tools",
    data: results,
  };
}
