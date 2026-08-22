import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EmergencyEmailInput = {
  alertId: string;
  employeeName: string;
  employeeId: string;
  loginId: string;
  shift: string;
  equipment: string;
  material: string;
  destination: string;
  message: string;
  raisedAt: string;
};

const TO_EMAIL = "sweja06@gmail.com";

/**
 * Emails the full emergency detail sheet to the control-room address the
 * instant an operator raises an alert. Never throws — the alert must not be
 * blocked by an email outage.
 */
export const sendEmergencyEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: EmergencyEmailInput) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env['RESEND_API_KEY'];
    if (!apiKey) {
      console.warn("[emergency] RESEND_API_KEY missing; email skipped");
      return { status: "not_configured" as const, to: TO_EMAIL };
    }

    const rows: [string, string][] = [
      ["Alert ID", data.alertId],
      ["Employee name", data.employeeName],
      ["Employee ID", data.employeeId],
      ["Login / email", data.loginId],
      ["Shift", data.shift],
      ["Equipment", data.equipment],
      ["Material", data.material],
      ["Destination / location", data.destination],
      ["Raised at (IST)", data.raisedAt],
      ["Message", data.message],
    ];

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;background:#121417;padding:24px;color:#e6e9ee">
        <h1 style="color:#ff5a5a;margin:0 0 4px;font-size:20px">EMERGENCY ALERT — LLOYDS FLEETIQ</h1>
        <p style="margin:0 0 16px;color:#9aa4b2">Surjagarh Iron Ore Mine · operator raised an emergency</p>
        <table style="border-collapse:collapse;width:100%;background:#1e2228;border-radius:8px;overflow:hidden">
          ${rows
            .map(
              ([k, v]) =>
                `<tr><td style="padding:10px 14px;border-bottom:1px solid #2b313a;color:#9aa4b2;width:42%">${k}</td>` +
                `<td style="padding:10px 14px;border-bottom:1px solid #2b313a;color:#fff"><strong>${String(v ?? "—")}</strong></td></tr>`,
            )
            .join("")}
        </table>
      </div>`;

    const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n");

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          from: process.env['EMERGENCY_FROM_EMAIL'] || "FleetIQ Alerts <onboarding@resend.dev>",
          to: [TO_EMAIL],
          subject: `EMERGENCY · ${data.employeeName} · ${data.destination || "Surjagarh mine"} · Shift ${data.shift}`,
          html,
          text,
        }),
      });
      if (!res.ok) {
        console.error("[emergency] email send failed", res.status, await res.text());
        return { status: "failed" as const, to: TO_EMAIL };
      }
      return { status: "sent" as const, to: TO_EMAIL };
    } catch (err) {
      console.error("[emergency] email send error", err);
      return { status: "failed" as const, to: TO_EMAIL };
    }
  });
