"use client";

import { memo } from "react";
import { motion } from "framer-motion";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
}

export const StatsCard = memo(function StatsCard({ title, value, subtitle }: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      whileHover={{ y: -3, scale: 1.01 }}
    >
      <div className="rounded-xl border border-border bg-surface p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</div>
        <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
        {subtitle && <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>}
      </div>
    </motion.div>
  );
});
