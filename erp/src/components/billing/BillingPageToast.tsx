"use client";

import { useEffect } from "react";
import { toast } from "sonner";

interface BillingPageToastProps {
  message?: string | undefined;
  type?: "success" | "cancel" | undefined;
}

export default function BillingPageToast({
  message,
  type,
}: BillingPageToastProps) {
  useEffect(() => {
    if (!message) return;

    if (type === "success") {
      toast.success(message);
    } else if (type === "cancel") {
      toast.info(message);
    } else {
      toast(message);
    }
  }, [message, type]);

  return null;
}
