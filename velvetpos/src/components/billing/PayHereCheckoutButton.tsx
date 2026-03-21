"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { initiateCheckout } from "@/app/(store)/billing/actions";

interface PayHereCheckoutButtonProps {
  tenantId: string;
  planId: string;
  billingCycle: "monthly" | "annual";
  buttonLabel: string;
}

export default function PayHereCheckoutButton({
  tenantId,
  planId,
  billingCycle,
  buttonLabel,
}: PayHereCheckoutButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await initiateCheckout(tenantId, planId, billingCycle);

      if (!result.success) {
        toast.error(result.error ?? "Failed to initiate checkout");
        return;
      }

      const { payhereUrl, payload } = result.data;

      const form = document.createElement("form");
      form.method = "POST";
      form.action = payhereUrl;
      form.style.display = "none";

      for (const [key, value] of Object.entries(payload)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value;
        form.appendChild(input);
      }

      document.body.appendChild(form);
      form.submit();
    });
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isPending}
      className="bg-espresso hover:bg-espresso/90 text-pearl"
    >
      {isPending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processing…
        </>
      ) : (
        buttonLabel
      )}
    </Button>
  );
}
