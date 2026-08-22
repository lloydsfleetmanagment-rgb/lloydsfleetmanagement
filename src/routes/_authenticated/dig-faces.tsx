import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Mountain, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDigFaces } from "@/lib/queries";
import { DIG_FACE_STATUSES, statusTone } from "@/lib/fleetiq";
import { Panel, SectionHeader } from "@/components/fleetiq/Cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dig-faces")({
  head: () => ({
    meta: [
      { title: "Dig Faces — LLOYDS FLEETIQ" },
      { name: "description", content: "Active benches, shovels and excavators working across the 348 Ha lease." },
      { property: "og:title", content: "Dig Faces — LLOYDS FLEETIQ" },
      { property: "og:description", content: "Bench and shovel allocation at Surjagarh." },
    ],
  }),
  component: DigFacesPage,
});

function DigFacesPage() {
  const { canManage, canDelete } = useAuth();
  const qc = useQueryClient();
  const { data: faces = [] } = useDigFaces();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", bench: "", material_code: "ROM", shovel: "" });

  const update = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("dig_faces").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Dig face updated");
    void qc.invalidateQueries({ queryKey: ["dig_faces"] });
  };

  const create = async () => {
    const { error } = await supabase.from("dig_faces").insert({
      code: form.code.trim(),
      bench: form.bench.trim(),
      material_code: form.material_code,
      shovel: form.shovel.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Dig face added");
    setOpen(false);
    setForm({ code: "", bench: "", material_code: "ROM", shovel: "" });
    void qc.invalidateQueries({ queryKey: ["dig_faces"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("dig_faces").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Dig face removed");
    void qc.invalidateQueries({ queryKey: ["dig_faces"] });
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <SectionHeader
        title="Dig Faces"
        subtitle="Bench-wise working faces, allocated shovels and material being mined"
        actions={
          canManage && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add dig face
            </Button>
          )
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {faces.map((f, i) => (
          <Panel key={f.id} className="animate-fade-up p-5" style={{ animationDelay: `${i * 50}ms` }}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">{f.code}</h2>
                <p className="text-xs text-muted-foreground">
                  Bench {f.bench} · {f.material_code}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1.5 text-xs ${statusTone(f.status)}`}>
                <Mountain className="h-3.5 w-3.5" /> {f.status}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={f.status} onValueChange={(v) => void update(f.id, { status: v })} disabled={!canManage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIG_FACE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Shovel / excavator</Label>
                <Input
                  defaultValue={f.shovel ?? ""}
                  disabled={!canManage}
                  onBlur={(e) => void update(f.id, { shovel: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Trucks allocated</Label>
                <Input
                  type="number"
                  defaultValue={f.trucks_allocated}
                  disabled={!canManage}
                  onBlur={(e) => void update(f.id, { trucks_allocated: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Remarks</Label>
                <Input
                  defaultValue={f.remarks ?? ""}
                  disabled={!canManage}
                  onBlur={(e) => void update(f.id, { remarks: e.target.value })}
                />
              </div>
            </div>

            {canDelete && (
              <Button variant="ghost" size="sm" className="mt-3 text-destructive" onClick={() => void remove(f.id)}>
                <Trash2 className="mr-2 h-4 w-4" /> Remove
              </Button>
            )}
          </Panel>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add dig face</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Code</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="DF-06" />
            </div>
            <div className="space-y-2">
              <Label>Bench</Label>
              <Input value={form.bench} onChange={(e) => setForm({ ...form, bench: e.target.value })} placeholder="RL-360" />
            </div>
            <div className="space-y-2">
              <Label>Material</Label>
              <Select value={form.material_code} onValueChange={(v) => setForm({ ...form, material_code: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ROM">ROM</SelectItem>
                  <SelectItem value="BHQ">BHQ</SelectItem>
                  <SelectItem value="SHALE">SHALE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Shovel</Label>
              <Input value={form.shovel} onChange={(e) => setForm({ ...form, shovel: e.target.value })} placeholder="EX-1200-01" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void create()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
