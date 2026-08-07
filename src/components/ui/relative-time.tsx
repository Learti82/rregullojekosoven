"use client";

import * as React from "react";
import { formatRelativeTime } from "@/lib/utils";

/**
 * A timestamp rendered as "3 minutes ago", safe to use inside a Client
 * Component.
 *
 * The naive version — calling `formatRelativeTime` directly in the JSX — is a
 * hydration bug waiting for a slow request. A Client Component is still
 * server-rendered for the initial HTML and then re-rendered on the client to
 * hydrate; if the wording crosses a boundary in between ("tani" becoming "para
 * 1 minute"), the two trees disagree and React throws a hydration error. It only
 * fires when the timing lines up, which is exactly what makes it hard to catch.
 *
 * `suppressHydrationWarning` is the sanctioned escape hatch for content that is
 * legitimately time-dependent. The server's text still ships in the HTML — so it
 * is correct without JavaScript and readable by crawlers — and the effect below
 * refreshes it once mounted and then every minute, so a page left open does not
 * quietly go stale.
 */
export function RelativeTime({
  date,
  className,
}: {
  date: Date | string;
  className?: string;
}) {
  const iso = React.useMemo(
    () => (typeof date === "string" ? new Date(date) : date).toISOString(),
    [date]
  );

  const [label, setLabel] = React.useState(() => formatRelativeTime(iso));

  React.useEffect(() => {
    const update = () => setLabel(formatRelativeTime(iso));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [iso]);

  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {label}
    </time>
  );
}
