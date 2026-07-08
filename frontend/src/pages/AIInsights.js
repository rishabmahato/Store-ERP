import React, { useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp, Package, Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";

const scenarios = [
  { key: "sales_prediction", title: "Sales Forecast", desc: "30-day demand outlook", icon: TrendingUp },
  { key: "inventory_forecast", title: "Reorder Guidance", desc: "Safety stock recommendations", icon: Package },
  { key: "product_recommendations", title: "Cross-sell Ideas", desc: "Bundle suggestions", icon: Gift },
];

export default function AIInsights() {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});

  const run = async (kind) => {
    setLoading((l) => ({ ...l, [kind]: true }));
    try {
      const { data } = await api.post("/ai/insights", { kind });
      setResults((r) => ({ ...r, [kind]: data.insight }));
    } catch (err) {
      toast.error(err.response?.data?.detail || "AI request failed");
    } finally {
      setLoading((l) => ({ ...l, [kind]: false }));
    }
  };

  return (
    <div className="space-y-6" data-testid="ai-page">
      <div>
        <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-1 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5" />Powered by Claude Sonnet 4.5
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: "Outfit" }}>AI Insights</h1>
        <p className="text-sm text-muted-foreground mt-1">
          On-demand business intelligence trained on your live store data.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {scenarios.map(({ key, title, desc, icon: Icon }) => (
          <Card key={key} className="glass rounded-2xl" data-testid={`ai-card-${key}`}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle style={{ fontFamily: "Outfit" }}>{title}</CardTitle>
                  <CardDescription>{desc}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => run(key)}
                disabled={loading[key]}
                className="w-full"
                data-testid={`run-${key}-btn`}
              >
                {loading[key] ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing…</> : "Generate"}
              </Button>
              {results[key] && (
                <div className="whitespace-pre-wrap text-sm leading-relaxed p-4 rounded-xl bg-secondary/60 border border-border">
                  {results[key]}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
