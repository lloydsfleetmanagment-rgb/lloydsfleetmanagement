import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "./fleetiq";

export type Equipment = {
  id: string;
  code: string;
  equipment_type: string;
  status: string;
  location: string;
  cycle_count: number;
  capacity_t: number;
  operator_employee_id: string | null;
  operator_name: string | null;
  assigned_user_id: string | null;
  remarks: string | null;
};

export type OperatorLog = {
  id: string;
  log_date: string;
  logged_at: string;
  shift: string;
  employee_id: string | null;
  employee_name: string | null;
  equipment_code: string;
  equipment_type: string;
  material_code: string;
  destination_code: string;
  dig_face: string | null;
  trips: number;
  quantity_t: number;
  loading_time_min: number;
  unloading_time_min: number;
  remarks: string | null;
  user_id: string;
};

export type Destination = {
  code: string;
  name: string;
  material_code: string;
  allowed_equipment_types: string[];
  is_crusher: boolean;
  sort_order: number;
};

export function useEquipment() {
  return useQuery({
    queryKey: ["equipment"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment").select("*").order("equipment_type").order("code");
      if (error) throw error;
      return (data ?? []) as Equipment[];
    },
  });
}

export function useMaterials() {
  return useQuery({
    queryKey: ["materials"],
    queryFn: async () => {
      const { data, error } = await supabase.from("materials").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useDestinations() {
  return useQuery({
    queryKey: ["destinations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("destinations").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Destination[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCrushers() {
  return useQuery({
    queryKey: ["crushers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("crushers").select("*").order("code");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDigFaces() {
  return useQuery({
    queryKey: ["dig_faces"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dig_faces").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useOperatorLogs(opts?: { date?: string; userId?: string; limit?: number; live?: boolean }) {
  const date = opts?.date;
  return useQuery({
    queryKey: ["operator_logs", date ?? "all", opts?.userId ?? "all", opts?.limit ?? 500],
    queryFn: async () => {
      let q = supabase.from("operator_logs").select("*").order("logged_at", { ascending: false }).limit(opts?.limit ?? 500);
      if (date) q = q.eq("log_date", date);
      if (opts?.userId) q = q.eq("user_id", opts.userId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as OperatorLog[];
    },
    ...(opts?.live ? { refetchInterval: 30_000, refetchOnWindowFocus: true } : {}),
  });
}

export function useTodayLogs(date?: string) {
  return useOperatorLogs({ date: date ?? todayISO(), limit: 1000, live: true });
}

export function useProductionEntries(date?: string) {
  return useQuery({
    queryKey: ["production_entries", date ?? "all"],
    queryFn: async () => {
      let q = supabase.from("production_entries").select("*").order("entry_date", { ascending: false }).limit(500);
      if (date) q = q.eq("entry_date", date);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAlerts() {
  return useQuery({
    queryKey: ["emergency_alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emergency_alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAuditLogs() {
  return useQuery({
    queryKey: ["audit_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTeam() {
  return useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const [{ data: profiles, error: e1 }, { data: roles, error: e2 }] = await Promise.all([
        supabase.from("profiles").select("*").order("employee_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return (profiles ?? []).map((p) => ({
        ...p,
        role: (roles ?? []).find((r) => r.user_id === p.id)?.role ?? "operator",
      }));
    },
  });
}

export async function writeAudit(entry: {
  action: string;
  entity?: string;
  entity_id?: string;
  details?: Record<string, unknown>;
  employee_id?: string | null;
  employee_name?: string | null;
  user_id?: string | null;
}) {
  await supabase.from("audit_logs").insert({
    action: entry.action,
    entity: entry.entity ?? null,
    entity_id: entry.entity_id ?? null,
    details: (entry.details ?? {}) as never,
    employee_id: entry.employee_id ?? null,
    employee_name: entry.employee_name ?? null,
    user_id: entry.user_id ?? null,
  });
}
