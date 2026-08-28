"use client";

import { Box, Skeleton } from "@mui/material";

const NAVY = "#0F3B5C";
const STEEL = "#1E6091";

export function PageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {/* Header skeleton */}
      <Box
        sx={{
          borderRadius: 3,
          overflow: "hidden",
          mb: 3,
          background: `linear-gradient(135deg, var(--banner-from) 0%, var(--banner-to) 100%)`,
          p: 3,
          position: "relative",
        }}
      >
        <Box sx={{ height: 4, bgcolor: "#3C8047", position: "absolute", top: 0, left: 0, right: 0 }} />
        <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Skeleton variant="circular" width={48} height={48} sx={{ bgcolor: "rgba(255,255,255,0.1)" }} />
            <Box>
              <Skeleton width={160} height={22} sx={{ bgcolor: "rgba(255,255,255,0.15)", borderRadius: 1, mb: 0.75 }} />
              <Skeleton width={220} height={14} sx={{ bgcolor: "rgba(255,255,255,0.08)", borderRadius: 1 }} />
            </Box>
          </Box>
          <Skeleton width={130} height={38} sx={{ bgcolor: "rgba(255,255,255,0.1)", borderRadius: 2 }} />
        </Box>

        {/* KPI tiles */}
        <Box display="flex" gap={2} mt={3} flexWrap="wrap">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton
              key={i}
              width={120}
              height={60}
              sx={{ bgcolor: "rgba(255,255,255,0.07)", borderRadius: 2, flexShrink: 0 }}
            />
          ))}
        </Box>
      </Box>

      {/* Table skeleton */}
      <Box
        sx={{
          borderRadius: 2.5,
          border: "1px solid var(--border)",
          overflow: "hidden",
          bgcolor: "var(--bg-surface)",
        }}
      >
        {/* Table header */}
        <Box sx={{ bgcolor: NAVY, px: 2, py: 1.75, display: "flex", gap: 3, alignItems: "center" }}>
          <Skeleton width={20} height={20} sx={{ bgcolor: "rgba(255,255,255,0.12)", borderRadius: 0.5, flexShrink: 0 }} />
          {[80, 100, 70, 90, 80, 60, 50].map((w, i) => (
            <Skeleton key={i} width={w} height={12} sx={{ bgcolor: "rgba(255,255,255,0.12)", borderRadius: 1 }} />
          ))}
        </Box>

        {/* Table rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <Box
            key={i}
            sx={{
              px: 2,
              py: 1.5,
              display: "flex",
              gap: 3,
              alignItems: "center",
              borderBottom: i < rows - 1 ? "1px solid #F1F5F9" : "none",
            }}
          >
            <Skeleton variant="circular" width={20} height={20} sx={{ borderRadius: 0.5, flexShrink: 0 }} />
            <Box display="flex" alignItems="center" gap={1.5} sx={{ width: 140, flexShrink: 0 }}>
              <Skeleton variant="circular" width={34} height={34} />
              <Box flex={1}>
                <Skeleton width="80%" height={13} sx={{ mb: 0.5, borderRadius: 1 }} />
                <Skeleton width="60%" height={11} sx={{ borderRadius: 1 }} />
              </Box>
            </Box>
            {[100, 70, 90, 80, 60, 50].map((w, j) => (
              <Skeleton key={j} width={w} height={13} sx={{ borderRadius: 1 }} />
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
