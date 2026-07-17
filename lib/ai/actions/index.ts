import { cancelTrip } from "./cancelTrip";
import type {
  AIActionFunction,
  AIActionInput,
} from "./types";

export type AIAction =
  | "cancel_trip";

const actionRegistry: Record<
  AIAction,
  AIActionFunction
> = {
  cancel_trip: cancelTrip,
};

export async function executeAction(
  action: AIAction,
  input: AIActionInput
) {
  return actionRegistry[action](input);
}
