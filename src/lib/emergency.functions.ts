import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EmergencyCallInput = {
  employeeName: string;
  employeeId: string;
  location: string;
  equipment: string;
  shift: string;
  message: string;
};

/**
 * Places an automated voice call through the OmniDimension AI calling agent to
 * the emergency response number. Returns a status instead of throwing so the
 * operator's alert is never blocked by a telephony outage.
 */
export const placeEmergencyCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: EmergencyCallInput) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env['OMNIDIM_API_KEY'];
    const agentId = process.env['OMNIDIM_AGENT_ID'];
    const toNumber = "+919346054190";

    const script =
      `Team, there is an emergency. Operator ${data.employeeName} ` +
      `(employee ID ${data.employeeId}) on shift ${data.shift} is at ${data.location} ` +
      `with equipment ${data.equipment}. Message: ${data.message}. ` +
      `Please respond immediately at Surjagarh Iron Ore Mine.`;

    if (!apiKey || !agentId) {
      console.warn("[emergency] OmniDimension not configured; call skipped", { toNumber });
      return { status: "not_configured" as const, script, to: toNumber };
    }

    try {
      const res = await fetch("https://backend.omnidim.io/api/v1/calls/dispatch", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          agent_id: Number(agentId) || agentId,
          to_number: toNumber,
          call_context: {
            emergency_message: script,
            employee_name: data.employeeName,
            employee_id: data.employeeId,
            location: data.location,
            equipment: data.equipment,
            shift: data.shift,
          },
        }),
      });
      if (!res.ok) {
        console.error("[emergency] OmniDimension dispatch failed", res.status);
        return { status: "failed" as const, script, to: toNumber };
      }
      return { status: "calling" as const, script, to: toNumber };
    } catch (err) {
      console.error("[emergency] OmniDimension dispatch error", err);
      return { status: "failed" as const, script, to: toNumber };
    }
  });
