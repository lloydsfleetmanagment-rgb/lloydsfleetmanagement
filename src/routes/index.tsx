import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Particles } from "@/components/fleetiq/Particles";
import { LloydsMark, ThriveniMark, WordMark } from "@/components/fleetiq/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — LLOYDS FLEETIQ" },
      {
        name: "description",
        content:
          "Secure sign in to LLOYDS FLEETIQ, the fleet and production control system for the Surjagarh Iron Ore Mine.",
      },
      { property: "og:title", content: "Sign in — LLOYDS FLEETIQ" },
      {
        property: "og:description",
        content: "Fleet, production and screens plant intelligence for Surjagarh Iron Ore Mine.",
      },
    ],
  }),
  component: LoginPage,
});

function Intro({ done }: { done: boolean }) {
  return (
    <div
      className={`pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        done ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="relative flex items-center gap-8" style={{ perspective: "1200px" }}>
        <div
          className="animate-fade-up"
          style={{ animation: "fq-fade-up 700ms cubic-bezier(.22,1,.36,1) both" }}
        >
          <LloydsMark className="h-16 drop-shadow-[0_10px_30px_rgba(0,0,0,.6)]" />
        </div>
        <div className="h-12 w-px bg-gradient-to-b from-transparent via-primary/60 to-transparent" />
        <div style={{ animation: "fq-fade-up 700ms 220ms cubic-bezier(.22,1,.36,1) both" }}>
          <ThriveniMark className="h-16 drop-shadow-[0_10px_30px_rgba(0,0,0,.6)]" />
        </div>
      </div>
      <div
        className="mt-10 text-center"
        style={{ animation: "fq-fade-up 700ms 520ms cubic-bezier(.22,1,.36,1) both" }}
      >
        <WordMark className="text-3xl" />
        <p className="mt-2 text-xs uppercase tracking-[0.35em] text-muted-foreground">
          Surjagarh Iron Ore Mine
        </p>
      </div>
      <div className="relative mt-10 h-px w-56 overflow-hidden bg-border">
        <div className="animate-sweep absolute inset-y-0 w-1/2 bg-primary" />
      </div>
    </div>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [introDone, setIntroDone] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [empId, setEmpId] = useState("");
  const [role, setRole] = useState("supervisor");

  useEffect(() => {
    const t = setTimeout(() => setIntroDone(true), 2400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/dashboard" });
  }, [loading, session, navigate]);

  useEffect(() => {
    const saved = window.localStorage.getItem("fleetiq:username");
    if (saved) setUsername(saved);
  }, []);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const id = username.includes("@") ? username.trim() : `${username.trim()}@fleetiq.local`;
    const { error } = await supabase.auth.signInWithPassword({ email: id, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (remember) window.localStorage.setItem("fleetiq:username", username.trim());
    else window.localStorage.removeItem("fleetiq:username");
    toast.success("Welcome back");
    void navigate({ to: "/dashboard" });
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const id = username.includes("@") ? username.trim() : `${username.trim()}@fleetiq.local`;
    const { error } = await supabase.auth.signUp({
      email: id,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { employee_name: name.trim(), employee_id: empId.trim(), role },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created — signing you in");
    void navigate({ to: "/dashboard" });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <Particles />
      <Intro done={introDone} />

      <div className="relative z-10 w-full max-w-md" style={{ perspective: "1400px" }}>
        <div className="mb-8 flex items-center justify-center gap-6 animate-fade-up">
          <LloydsMark className="h-10" />
          <span className="h-8 w-px bg-border" />
          <ThriveniMark className="h-10" />
        </div>

        <div className="surface-2 animate-fade-up rounded-3xl p-8" style={{ animationDelay: "120ms" }}>
          <div className="text-center">
            <WordMark className="text-2xl" />
            <p className="mt-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Fleet Management System
            </p>
          </div>

          <Tabs defaultValue="login" className="mt-7">
            <TabsList className="grid w-full grid-cols-2 bg-secondary/60">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={signIn} className="mt-5 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="username"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={show ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={show ? "Hide password" : "Show password"}
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 text-muted-foreground">
                    <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
                    Remember me
                  </label>
                </div>
                <Button type="submit" className="w-full transition-transform duration-300 hover:-translate-y-0.5" disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
                  Login
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={signUp} className="mt-5 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Employee name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="empid">Employee ID</Label>
                  <Input
                    id="empid"
                    value={empId}
                    onChange={(e) => setEmpId(e.target.value)}
                    placeholder="LM-10234"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rusername">Username</Label>
                  <Input
                    id="rusername"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="username"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rpassword">Password</Label>
                  <div className="relative">
                    <Input
                      id="rpassword"
                      type={show ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground"
                      aria-label={show ? "Hide password" : "Show password"}
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operator">Operator</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Select the access level for this account. Operators can use the trip console once signed in.
                </p>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          Zero new hardware · Data from existing reports, shift logs, weighbridge tickets and tablet entries
        </p>
      </div>
    </div>
  );
}
