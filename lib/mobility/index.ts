import { getMobilityProvider } from "./config";
import { estimateMockRoute } from "./mockProvider";
import type {
  MobilityCoordinates,
  MobilityRouteEstimate,
} from "./types";

export {
  MOBILITY_CONFIG,
  getMobilityProvider,
  isMockMobilityMode,
} from "./config";

export type {
  MobilityCoordinates,
  MobilityProviderName,
  MobilityRouteEstimate,
} from "./types";

export async function estimateRoute(
  origin: MobilityCoordinates,
  destination: MobilityCoordinates
): Promise<MobilityRouteEstimate> {
  const provider = getMobilityProvider();

  if (provider === "google") {
    /*
     * Adaptador reservado para Google Routes.
     * Mientras no existan credenciales fiscales y API Key,
     * AXI continuará utilizando el proveedor mock.
     */
    return estimateMockRoute(
      origin,
      destination
    );
  }

  return estimateMockRoute(
    origin,
    destination
  );
}

export function estimateRouteSync(
  origin: MobilityCoordinates,
  destination: MobilityCoordinates
): MobilityRouteEstimate {
  return estimateMockRoute(
    origin,
    destination
  );
}
