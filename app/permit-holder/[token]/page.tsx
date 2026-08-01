import { PermitHolderAuthorizationForm } from "@/components/driver/PermitHolderAuthorizationForm";

export default async function PermitHolderAuthorizationPage({
  params,
}: {
  params: Promise<{
    token: string;
  }>;
}) {
  const { token } = await params;

  return (
    <PermitHolderAuthorizationForm
      token={token}
    />
  );
}
