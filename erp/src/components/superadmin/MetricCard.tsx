import { Card, CardContent } from "@/components/ui/card";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}

export function MetricCard({ label, value, icon }: MetricCardProps) {
  return (
    <Card className="border-sand bg-pearl">
      <CardContent className="flex items-center gap-4">
        <div className="text-terracotta">{icon}</div>
        <div>
          <p className="text-mist text-sm">{label}</p>
          <p className="text-espresso text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
