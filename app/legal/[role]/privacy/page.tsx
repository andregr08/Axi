"use client";

import { useParams } from "next/navigation";
import { LegalDocumentPlaceholder } from "@/components/legal/LegalDocumentPlaceholder";

export default function PrivacyPage() {
  const params = useParams<{ role: string }>();

  const role =
    params.role === "driver"
      ? "driver"
      : "passenger";

  return (
    <LegalDocumentPlaceholder
      role={role}
      kind="privacy"
    />
  );
}
