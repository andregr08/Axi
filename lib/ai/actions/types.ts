import type { AIContext } from "../prompt";

export type AIActionInput = {
  context: AIContext;
  accessToken: string;
  message: string;
};

export type AIActionFunction = (
  input: AIActionInput
) => Promise<unknown>;
