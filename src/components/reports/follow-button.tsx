"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleFollowAction } from "@/server/actions/reports";

export function FollowButton({
  reportId,
  following,
  followersCount,
  isAuthenticated,
}: {
  reportId: string;
  following: boolean;
  followersCount: number;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [state, setState] = React.useState({ following, followersCount });
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => setState({ following, followersCount }), [following, followersCount]);

  const toggle = () => {
    if (!isAuthenticated) {
      toast.error("Kyçuni për të ndjekur raportet.", {
        action: { label: "Kyçu", onClick: () => router.push("/login") },
      });
      return;
    }

    const previous = state;
    setState({
      following: !state.following,
      followersCount: state.followersCount + (state.following ? -1 : 1),
    });

    startTransition(async () => {
      const result = await toggleFollowAction(reportId);
      if (!result.success) {
        setState(previous);
        toast.error(result.error);
        return;
      }
      setState({ following: result.data.following, followersCount: result.data.followersCount });
      toast.success(result.message ?? "");
    });
  };

  return (
    <Button
      variant={state.following ? "secondary" : "outline"}
      size="sm"
      onClick={toggle}
      loading={pending}
      aria-pressed={state.following}
    >
      {state.following ? <BellOff /> : <Bell />}
      {state.following ? "Duke ndjekur" : "Ndiq"}
      <span className="tabular-nums text-muted-foreground">({state.followersCount})</span>
    </Button>
  );
}
