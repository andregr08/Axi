export type TripDetailRole =
  | "director_general"
  | "admin"
  | "support"
  | "finance"
  | "driver"
  | "passenger";

export type TripDetailStatus =
  | "requested"
  | "searching"
  | "accepted"
  | "driver_arriving"
  | "driver_arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

export type TripDetailData = {
  id: string;
  passenger_id: string;
  driver_id: string | null;
  vehicle_id: string | null;
  origin_address: string;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_address: string;
  destination_lat: number | null;
  destination_lng: number | null;
  status: TripDetailStatus;
  estimated_price: number | null;
  final_price: number | null;
  requested_at: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
};

export type TripParticipant = {
  id: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  rating: number | null;
};

export type TripVehicle = {
  id: string;
  brand: string | null;
  model: string | null;
  color: string | null;
  plates: string | null;
  verified: boolean;
};

export type TripDriverLocation = {
  driver_id: string;
  latitude: number;
  longitude: number;
  speed_kmh: number | null;
  heading: number | null;
  accuracy_meters: number | null;
  updated_at: string;
};

export type DriverIdentityData = {
  name: string;
  avatarUrl: string | null;
  rating: number | null;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  vehicleColor: string | null;
  vehiclePlates: string | null;
  verified: boolean;
};

export type DriverNextAction = {
  status: TripDetailStatus;
  label: string;
};

export type TripViewSharedProps = {
  trip: TripDetailData;
  role: TripDetailRole;
  passenger: TripParticipant | null;
  driver: TripParticipant | null;
  vehicle: TripVehicle | null;
  driverLocation: TripDriverLocation | null;
  locationConnected: boolean;
  processing: boolean;
  message: string;
  onAdvanceStatus: (
    nextStatus: TripDetailStatus
  ) => Promise<void>;
};
