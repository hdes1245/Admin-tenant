"use client";

import { memo } from "react";
import { Box, MenuItem, Pagination, Select, Typography } from "@mui/material";

export interface PaginationBarProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export const PaginationBar = memo(function PaginationBar({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}: PaginationBarProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="space-between"
      flexWrap="wrap"
      gap={2}
      sx={{
        mt: 2,
        px: 2,
        py: 1.5,
        bgcolor: "var(--bg-page)",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
      }}
    >
      <Box display="flex" alignItems="center" gap={1.5}>
        <Typography variant="body2" color="text.secondary">
          {total === 0
            ? "Aucun résultat"
            : `${from}–${to} sur ${total}`}
        </Typography>
        {onPageSizeChange && (
          <Select
            size="small"
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            sx={{
              fontSize: 12,
              height: 28,
              "& .MuiSelect-select": { py: 0.5, px: 1 },
            }}
          >
            {pageSizeOptions.map((s) => (
              <MenuItem key={s} value={s} sx={{ fontSize: 13 }}>
                {s} / page
              </MenuItem>
            ))}
          </Select>
        )}
      </Box>

      <Pagination
        count={totalPages}
        page={page}
        onChange={(_, p) => onPageChange(p)}
        shape="rounded"
        color="primary"
        size="small"
        showFirstButton
        showLastButton
      />
    </Box>
  );
});
