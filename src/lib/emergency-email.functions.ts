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
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      const result = await sendTemplateEmail("emergency-alert", TO_EMAIL, {
        templateData: {
          alertId: data.alertId,
          employeeName: data.employeeName,
          employeeId: data.employeeId,
          loginId: data.loginId,
          shift: data.shift,
          equipment: data.equipment,
          material: data.material,
          destination: data.destination,
          message: data.message,
          raisedAt: data.raisedAt,
        },
        idempotencyKey: `emergency-alert-${data.alertId}`,
      });

      if (!result.sent) {
        console.warn("[emergency] email suppressed", result.reason);
        return { status: "failed" as const, to: TO_EMAIL, error: result.reason };
      }
      return { status: "sent" as const, to: TO_EMAIL };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error("[emergency] email send error", error);
      return { status: "failed" as const, to: TO_EMAIL, error };
    }
  });
