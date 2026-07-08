import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Zap, ArrowRight } from "lucide-react";
import { toast } from "sonner";

function formatDetail(d) {
  if (!d) return "Login failed";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  return d?.msg || JSON.stringify(d);
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@laxmielectronics.com");
  const [password, setPassword] = useState("Admin@123");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back");
      navigate("/");
    } catch (err) {
      toast.error(formatDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex">
      {/* Left column (visual) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-slate-100 to-slate-50 dark:from-zinc-900 dark:to-zinc-950">
        <div className="absolute inset-0 grain opacity-40" />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold" style={{ fontFamily: "Outfit" }}>Laxmi Electronics</div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Enterprise ERP</div>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-3">Retail Intelligence</div>
            <h1 className="text-5xl xl:text-6xl font-bold tracking-tight leading-tight" style={{ fontFamily: "Outfit" }}>
              Run the store.<br />
              Not the spreadsheet.
            </h1>
            <p className="mt-6 text-muted-foreground max-w-md">
              A modern POS, inventory, CRM and analytics workspace built for
              electronics retailers. Fast billing, GST-ready invoices, live stock.
            </p>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <div>© {new Date().getFullYear()} Laxmi Electronics</div>
            <div>v1.0 · MVP</div>
          </div>
        </div>
      </div>

      {/* Right column (form) */}
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md glass rounded-2xl">
          <CardHeader className="space-y-2">
            <CardTitle className="text-3xl" style={{ fontFamily: "Outfit" }}>Sign in</CardTitle>
            <CardDescription>Use your Laxmi ERP account to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required data-testid="login-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password" type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required data-testid="login-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading} data-testid="login-submit">
                {loading ? "Signing in…" : "Continue"} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <div className="text-xs text-muted-foreground text-center pt-2">
                Demo: <b>admin@laxmielectronics.com</b> / <b>Admin@123</b>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
