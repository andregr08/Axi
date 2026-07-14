import { PublicTripTracker } from "@/components/trips/PublicTripTracker";

export default async function SharedTripPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <PublicTripTracker token={token} />;
}
