"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

type Props = {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
  label?: string;
  showIcon?: boolean;
};

export function SignOutButton({
  variant = "outline",
  size = "sm",
  className,
  label = "Sign out",
  showIcon = true,
}: Props) {
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={[showIcon ? "gap-2" : "", className].filter(Boolean).join(" ")}
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      {showIcon && <LogOut className="h-4 w-4" />}
      {label}
    </Button>
  );
}
