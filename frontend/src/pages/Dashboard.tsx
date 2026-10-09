import { useEffect, useState } from "react";
import { planLabel } from "@/lib/planLabels";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, HelpCircle, ShoppingCart, Users, TrendingUp, Clock, CalendarDays, PauseCircle } from "lucide-react";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import LimitWarningBanner from "@/components/LimitWarningBanner";

interface Stats {
  pendingOrders: number;
  recentOrders: any[];
}

export default function Dashboard() {
  const { limits, usage, planTier, billing, loading: limitsLoading } = usePlanLimits();
  const [stats, setStats] = useState<Stats>({ pendingOrders: 0, recentOrders: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [pendingRes, recentRes] = await Promise.all([
          supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
          supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(5),
        ]);
        setStats({
          pendingOrders: pendingRes.count || 0,
          recentOrders: recentRes.data || [],
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const isReady = !loading && !limitsLoading && usage && limits;

  const usageCards = isReady ? [
    {
      title: "Classes",
      used: usage.products,
      max: limits.max_products,
      icon: GraduationCap,
    },
    {
      title: "FAQs",
      used: usage.faqs,
      max: limits.max_faqs,
      icon: HelpCircle,
    },
    {
      title: "Orders (This Month)",
      used: usage.orders_this_month,
      max: limits.max_orders_per_month,
      icon: ShoppingCart,
    },
    {
      title: "Contacts (This Month)",
      used: usage.contacts_this_month,
      max: limits.contacts_per_month,
      icon: Users,
    },
  ] : [];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Pause Warning */}
        {billing.is_paused && (
          <LimitWarningBanner type="products" />
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Overview of your WhatsApp chatbot system
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isReady && billing.next_cycle_date && (
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                Next cycle: {new Date(billing.next_cycle_date).toLocaleDateString()}
              </Badge>
            )}
            {isReady && billing.is_paused && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <PauseCircle className="h-3 w-3" />
                Paused
              </Badge>
            )}
            {isReady && (
              <Badge variant="outline" className="text-sm">
                {planLabel(planTier)} Plan
              </Badge>
            )}
          </div>
        </div>

        {/* Usage Cards with Limits */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {!isReady ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Loading...</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">...</div>
                </CardContent>
              </Card>
            ))
          ) : (
            usageCards.map((card) => {
              const pct = card.max > 0 ? Math.min((card.used / card.max) * 100, 100) : 0;
              const isNearLimit = pct >= 80;
              const isAtLimit = pct >= 100;
              return (
                <Card key={card.title} className={isAtLimit ? "border-destructive/50" : isNearLimit ? "border-yellow-500/50" : ""}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                    <card.icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-bold">{card.used}</span>
                      <span className="text-sm text-muted-foreground">/ {card.max}</span>
                    </div>
                    <Progress
                      value={pct}
                      className={`h-2 ${isAtLimit ? "[&>div]:bg-destructive" : isNearLimit ? "[&>div]:bg-yellow-500" : ""}`}
                    />
                    {isAtLimit && (
                      <p className="text-xs text-destructive font-medium">Limit reached</p>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Pending Orders Alert */}
        {stats.pendingOrders > 0 && (
          <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <div>
                <CardTitle className="text-lg">Pending Orders</CardTitle>
                <CardDescription>
                  You have {stats.pendingOrders} order{stats.pendingOrders > 1 ? "s" : ""} waiting to be processed
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        )}

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recent Orders
            </CardTitle>
            <CardDescription>Latest orders from your WhatsApp customers</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : stats.recentOrders.length === 0 ? (
              <p className="text-muted-foreground">No orders yet. Orders will appear here once customers start ordering via WhatsApp.</p>
            ) : (
              <div className="space-y-4">
                {stats.recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm sm:text-base">{order.customer_name}</p>
                        {order.grade && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                            {order.grade}
                          </Badge>
                        )}
                        {order.medium && (
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-1.5 py-0 font-normal border ${
                              order.medium.toLowerCase() === "english"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200"
                            }`}
                          >
                            {order.medium.toLowerCase() === "english" ? "English" : "සිංහල"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground">{order.customer_phone}</p>
                    </div>
                    <div className="flex items-center justify-between sm:text-right gap-2">
                      <p className="font-medium text-sm sm:text-base">LKR {order.total_amount}</p>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
