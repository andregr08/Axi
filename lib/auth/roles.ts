export type UserRole =
  | "director_general"
  | "admin"
  | "support"
  | "finance"
  | "driver"
  | "passenger";

export const ROLES = {
  DIRECTOR_GENERAL: "director_general",
  ADMIN: "admin",
  SUPPORT: "support",
  FINANCE: "finance",
  DRIVER: "driver",
  PASSENGER: "passenger",
} as const;

export function isDirectorGeneral(
  role: UserRole | null | undefined
) {
  return role === ROLES.DIRECTOR_GENERAL;
}

export function isAdmin(role: UserRole | null | undefined) {
  return (
    role === ROLES.ADMIN ||
    isDirectorGeneral(role)
  );
}

export function isSupport(role: UserRole | null | undefined) {
  return (
    role === ROLES.SUPPORT ||
    isAdmin(role)
  );
}

export function isFinance(role: UserRole | null | undefined) {
  return (
    role === ROLES.FINANCE ||
    isAdmin(role)
  );
}

export function isDriver(role: UserRole | null | undefined) {
  return role === ROLES.DRIVER;
}

export function isPassenger(role: UserRole | null | undefined) {
  return role === ROLES.PASSENGER;
}

export function canManageDrivers(
  role: UserRole | null | undefined
) {
  return isAdmin(role);
}

export function canManagePassengers(
  role: UserRole | null | undefined
) {
  return isAdmin(role);
}

export function canManageVehicles(
  role: UserRole | null | undefined
) {
  return isAdmin(role) || isDriver(role);
}

export function canManagePayments(
  role: UserRole | null | undefined
) {
  return isFinance(role);
}

export function canViewSupport(
  role: UserRole | null | undefined
) {
  return isSupport(role);
}

export function canRefund(
  role: UserRole | null | undefined
) {
  return isSupport(role) || isFinance(role);
}

export function canManageSettings(
  role: UserRole | null | undefined
) {
  return isDirectorGeneral(role);
}

export function getRoleLabel(
  role: UserRole | null | undefined
) {
  switch (role) {
    case ROLES.DIRECTOR_GENERAL:
      return "Director General";
    case ROLES.ADMIN:
      return "Administrador";
    case ROLES.SUPPORT:
      return "Soporte";
    case ROLES.FINANCE:
      return "Finanzas";
    case ROLES.DRIVER:
      return "Conductor";
    case ROLES.PASSENGER:
      return "Pasajero";
    default:
      return "Usuario";
  }
}
