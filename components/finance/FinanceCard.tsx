import { Card } from "@/components/ui/Card";
import { LucideIcon } from "lucide-react";

type Props = {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
};

export default function FinanceCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: Props) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">

        <div>

          <p className="text-sm text-gray-500">
            {title}
          </p>

          <h2 className="mt-2 text-3xl font-bold">
            {value}
          </h2>

          {subtitle && (
            <p className="mt-2 text-sm text-gray-500">
              {subtitle}
            </p>
          )}

        </div>

        <Icon className="h-8 w-8 text-blue-600" />

      </div>
    </Card>
  );
}
