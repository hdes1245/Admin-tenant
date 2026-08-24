"use client";

import { memo } from "react";
import { Card, CardContent, Typography } from "@mui/material";
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
      <Card
        elevation={0}
        sx={{
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)",
        }}
      >
        <CardContent>
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ letterSpacing: 0.6 }}
          >
            {title}
          </Typography>
          <Typography variant="h5" fontWeight={600} sx={{ mt: 0.5 }}>
            {value}
          </Typography>
          {subtitle && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              {subtitle}
            </Typography>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
});

