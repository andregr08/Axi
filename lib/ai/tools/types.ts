import type { AIContext } from "../prompt";

export type AIToolInput = {
  context: AIContext;
  accessToken: string;
};

export type AIToolFunction = (
  input: AIToolInput
) => Promise<unknown>;
