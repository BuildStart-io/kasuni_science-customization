import { AlertTriangle, PauseCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { usePlanLimits } from "@/hooks/usePlanLimits";

interface Props {
  type: "products" | "faqs" | "orders" | "contacts";
}

const labels: Record<string, string> = {
  products: "Classes",
  faqs: "FAQs",
  orders: "Orders this month",
  contacts: "Contacts this month",
};

export default function LimitWarningBanner({ type }: Props) {
  const { usage, limits, isPaused } = usePlanLimits();

  if (isPaused) {
    return (
      <Alert variant="destructive" className="mb-4">
        <PauseCircle className="h-4 w-4" />
        <AlertTitle>Account Paused</AlertTitle>
        <AlertDescription>
          Your billing cycle is paused. You can view existing data but cannot create new content. Contact your administrator to resume.
        </AlertDescription>
      </Alert>
    );
  }

  if (!usage || !limits) return null;

  const usageMap: Record<string, { used: number; max: number }> = {
    products: { used: usage.products, max: limits.max_products },
    faqs: { used: usage.faqs, max: limits.max_faqs },
    orders: { used: usage.orders_this_month, max: limits.max_orders_per_month },
    contacts: { used: usage.contacts_this_month, max: limits.contacts_per_month },
  };

  const { used, max } = usageMap[type];
  if (used < max) return null;

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{labels[type]} Limit Reached</AlertTitle>
      <AlertDescription>
        You've used {used}/{max} {labels[type].toLowerCase()}. This feature is disabled until your limit is increased or your billing cycle resets. Contact your administrator.
      </AlertDescription>
    </Alert>
  );
}
