"use client";

import { Box, Tooltip } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

/**
 * Petite icône "i" à poser en absolute dans le coin haut-droit d'une carte
 * KPI — la carte parente doit avoir `position: "relative"`. Au survol,
 * affiche un résumé de ce que représente le KPI.
 */
export function KpiInfoIcon({
  text,
  color = "inherit",
}: {
  text: string;
  color?: string;
}) {
  return (
    <Tooltip title={text} arrow placement="top" enterTouchDelay={0}>
      <Box
        component="span"
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 18,
          height: 18,
          color,
          opacity: 0.55,
          cursor: "help",
          transition: "opacity .15s ease",
          "&:hover": { opacity: 1 },
        }}
      >
        <InfoOutlinedIcon sx={{ fontSize: 15 }} />
      </Box>
    </Tooltip>
  );
}
