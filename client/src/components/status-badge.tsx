import { Badge } from "@/components/ui/badge";
import type { CallState } from "@shared/schema";
import { Clock, Phone, CheckCircle, XCircle } from "lucide-react";

interface StatusBadgeProps {
  state: CallState;
  showPulse?: boolean;
  size?: "sm" | "default" | "lg";
}

export function StatusBadge({ state, showPulse = false, size = "default" }: StatusBadgeProps) {
  const configs = {
    INTRO: {
      label: "Ready",
      variant: "secondary" as const,
      icon: Clock,
    },
    DIALING: {
      label: "Dialing",
      variant: "default" as const,
      icon: Phone,
    },
    COMPLETED: {
      label: "Completed",
      variant: "outline" as const,
      icon: CheckCircle,
      className: "border-green-600 text-green-700 dark:border-green-400 dark:text-green-300",
    },
    FAILED: {
      label: "Failed",
      variant: "destructive" as const,
      icon: XCircle,
    },
  };

  const config = configs[state];
  const Icon = config.icon;
  
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5 gap-1",
    default: "text-sm px-3 py-1 gap-1.5",
    lg: "text-base px-4 py-1.5 gap-2",
  };

  return (
    <Badge 
      variant={config.variant} 
      className={`${config.className || ""} ${sizeClasses[size]} inline-flex items-center font-medium`}
      data-testid={`badge-status-${state.toLowerCase()}`}
    >
      <Icon className={`h-3 w-3 ${showPulse && state === "DIALING" ? "animate-pulse" : ""}`} />
      <span>{config.label}</span>
    </Badge>
  );
}
