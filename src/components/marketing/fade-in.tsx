"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Slot } from "@radix-ui/react-slot";

/**
 * Scroll-triggered entrance animation.
 *
 * Honours `prefers-reduced-motion` by rendering the content statically — the
 * animation is decorative, so removing it costs nothing.
 * `asChild` keeps the DOM semantic when the animated node must be an `<li>`.
 */
export function FadeIn({
  children,
  delay = 0,
  className,
  asChild = false,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  asChild?: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    const Comp = asChild ? Slot : "div";
    return <Comp className={className}>{children}</Comp>;
  }

  const MotionComp = asChild ? motion.create(Slot) : motion.div;

  return (
    <MotionComp
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionComp>
  );
}
