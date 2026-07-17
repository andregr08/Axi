export type UserRole =
  | "super_admin"
  | "admin"
  | "support"
  | "driver"
  | "passenger";

export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  SUPPORT: "support",
  DRIVER: "driver",
  PASSENGER: "passenger",
} as const;

export function isSuperAdmin(role: UserRole | null | undefined) {
  return role === ROLES.SUPER_ADMIN;
}

export function isAdmin(role: UserRole | null | undefined) {
  return role === ROLES.ADMIN || isSuperAdmin(role);
}

export function isSupport(role: UserRole | null | undefined) {
  return role === ROLES.SUPPORT || isAdmin(role);
}

export function isDriver(role: UserRole | null | undefined) {
  return role === ROLES.DRIVER;
}

export function isPassenger(role: UserRole | null | undefined) {
  return role === ROLES.PASSENGER;
}

export function canManageDrivers(role: UserRole | null | undefined) {
  return isAdmin(role);
}

export function canManagePassengers(role: UserRole | null | undefined) {
  return isAdmin(role);
}

export function canManageVehicles(role: UserRole | null | undefined) {
  return isAdmin(role) || isDriver(role);
}

export function canManagePayments(role: UserRole | null | undefined) {
  return isAdmin(role);
}

export function canViewSupport(role: UserRole | null | undefined) {
  return isSupport(role);
}

export function canRefund(role: UserRole | null | undefined) {
  return isSupport(role);
}

export function canManageSettings(role: UserRole | null |undefined) {
  return isSuperAdmin(role);
}


export function getRoleLabel(role: UserRole | null | undefined) {
  switch (role) {
    case ROLES.SUPER_ADMIN:
      return "Superadministrador";
    case ROLES.ADMIN:
      return "Administrador";
    case ROLES.SUPPORT:
      return "Soporte";
    case ROLES.DRIVER:
      return "Conductor";
    case ROLES.PASSENGER:
      return "Pasajero";
    default:
      return "Usuario";
  }
}
