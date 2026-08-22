import lloydsLogo from "@/assets/lloyds-logo.png";
import thriveniLogo from "@/assets/thriveni-logo.png";
import { cn } from "@/lib/utils";

export { lloydsLogo, thriveniLogo };

export function LloydsMark({ className }: { className?: string }) {
  return (
    <img
      src={lloydsLogo}
      alt="Lloyds Metals"
      width={1152}
      height={576}
      className={cn("h-9 w-auto object-contain", className)}
    />
  );
}

export function ThriveniMark({ className }: { className?: string }) {
  return (
    <img
      src={thriveniLogo}
      alt="Thriveni Earthmovers"
      loading="lazy"
      width={1152}
      height={576}
      className={cn("h-9 w-auto object-contain", className)}
    />
  );
}

export function WordMark({ className }: { className?: string }) {
  return (
    <span className={cn("font-semibold tracking-tight", className)}>
      LLOYDS <span className="text-primary">FLEETIQ</span>
    </span>
  );
}
