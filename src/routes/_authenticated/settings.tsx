import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTeam, writeAudit } from "@/lib/queries";
import { EMERGENCY_NOTIFY_EMAIL } from "@/lib/fleetiq";
import { Panel, SectionHeader } from "@/components/fleetiq/Cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — LLOYDS FLEETIQ" },
      { name: "description", content: "Manage your profile and, for admins, team roles and access control." },
      { property: "og:title", content: "Settings — LLOYDS FLEETIQ" },
      { property: "og:description", content: "Profile and role-based access management." },
    ],
  }),
  component: SettingsPage,
});

const ROLES = ["admin", "supervisor", "operator"] as const;

function SettingsPage() {
  const { profile, user, role, isAdmin, refresh } = useAuth();
  const qc = useQueryClient();
  const { data: team = [] } = useTeam();
  const [name, setName] = useState(profile?.employee_name ?? "");
  const [empId, setEmpId] = useState(profile?.employee_id ?? "");
  const [saving, setSaving] = useState(false);

  const saveProfile = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ employee_name: name, employee_id: empId })
      .eq("id", user?.id as string);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile updated");
    await refresh();
  };

  const setRole = async (userId: string, newRole: string) => {
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (delErr) {
      toast.error(delErr.message);
      return;
    }
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: newRole as (typeof ROLES)[number] });
    if (error) {
      toast.error(error.message);
      return;
    }
    await writeAudit({
      action: "ROLE_CHANGED",
      entity: "user_roles",
      entity_id: userId,
      user_id: user?.id ?? null,
      employee_id: profile?.employee_id ?? null,
      employee_name: profile?.employee_name ?? null,
      details: { target_user: userId, new_role: newRole },
    });
    toast.success("Role updated");
    void qc.invalidateQueries({ queryKey: ["team"] });
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <SectionHeader title="Settings" subtitle={`Signed in as ${profile?.email ?? user?.email ?? ""} · role ${role ?? "—"}`} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="p-6">
          <h2 className="text-lg font-semibold">My profile</h2>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Employee name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Employee ID</Label>
              <Input value={empId} onChange={(e) => setEmpId(e.target.value)} className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile?.email ?? user?.email ?? ""} readOnly />
            </div>
            <Button onClick={() => void saveProfile()} disabled={saving}>
              Save profile
            </Button>
          </div>
        </Panel>

        <Panel className="p-6">
          <h2 className="text-lg font-semibold">Emergency routing</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Every emergency alert appears instantly on the Admin dashboard with an audible alarm, and is recorded against{" "}
            <span className="text-foreground">{EMERGENCY_NOTIFY_EMAIL}</span> in the audit trail.
          </p>
          <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-4 text-sm">
            <p className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Role-based access is enforced in the database, not just the UI.
            </p>
            <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <li>Admin — full access, user management, delete rights, audit trail</li>
              <li>Supervisor — view all, edit fleet/production/crushers, no deletes</li>
              <li>Operator — log own trips, edit own equipment status, emergency button</li>
            </ul>
          </div>
        </Panel>
      </div>

      {isAdmin && (
        <Panel className="mt-6 p-6">
          <h2 className="text-lg font-semibold">Team &amp; access control</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                  <th className="py-2">Employee</th>
                  <th className="py-2">Employee ID</th>
                  <th className="py-2">Email</th>
                  <th className="py-2 w-44">Role</th>
                </tr>
              </thead>
              <tbody>
                {team.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="py-2">{m.employee_name ?? "—"}</td>
                    <td className="py-2 font-mono text-xs">{m.employee_id ?? "—"}</td>
                    <td className="py-2 text-muted-foreground">{m.email ?? "—"}</td>
                    <td className="py-2">
                      <Select value={m.role ?? "operator"} onValueChange={(v) => void setRole(m.id, v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
