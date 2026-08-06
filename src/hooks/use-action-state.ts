"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/types";

/**
 * Surface an action's outcome as a toast exactly once per result object.
 * Pairs with React's `useActionState`.
 */
export function useActionToast(
  state: ActionResult<unknown> | null,
  options?: { onSuccess?: () => void }
) {
  useEffect(() => {
    if (!state) return;
    if (state.success) {
      if (state.message) toast.success(state.message);
      options?.onSuccess?.();
    } else {
      toast.error(state.error);
    }
    // Only re-run when a new result object arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

/** Pull the first Zod error for a field out of an action result. */
export function fieldError(
  state: ActionResult<unknown> | null,
  field: string
): string[] | undefined {
  if (!state || state.success) return undefined;
  return state.fieldErrors?.[field];
}
