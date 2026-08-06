import { cn } from "@/lib/utils";

/**
 * RregulloKosovën mark.
 *
 * A map pin whose interior is a check — "the problem is located, the problem is
 * fixed". The pin outline doubles as a speech bubble tail so it reads as a
 * citizen's voice as well as a location. Drawn as inline SVG so it inherits
 * `currentColor` and stays crisp at favicon size.
 */
export function LogoMark({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-8", className)}
      role="img"
      aria-label="RregulloKosovën"
      {...props}
    >
      <defs>
        <linearGradient id="rk-pin" x1="6" y1="2" x2="26" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2F6BFF" />
          <stop offset="1" stopColor="#1230A3" />
        </linearGradient>
      </defs>
      <path
        d="M16 2.5c-5.799 0-10.5 4.582-10.5 10.234 0 7.03 8.53 15.42 10.03 16.85a.68.68 0 0 0 .94 0c1.5-1.43 10.03-9.82 10.03-16.85C26.5 7.082 21.799 2.5 16 2.5Z"
        fill="url(#rk-pin)"
      />
      <path
        d="M11.4 13.1l3.15 3.15 6.05-6.05"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="13" r="9.2" stroke="#F5C518" strokeOpacity="0.55" strokeWidth="1.2" />
    </svg>
  );
}

export function Logo({
  className,
  showText = true,
  textClassName,
}: {
  className?: string;
  showText?: boolean;
  textClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="size-8 shrink-0" />
      {showText ? (
        <span
          className={cn(
            "font-display text-base font-semibold tracking-tight text-foreground",
            textClassName
          )}
        >
          Rregullo<span className="text-primary">Kosovën</span>
        </span>
      ) : null}
    </span>
  );
}
