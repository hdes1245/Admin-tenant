"use client";

import { ReactNode, useState } from "react";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const theme = createTheme({
  palette: {
    mode: "light",
    primary:    { main: "#0D1B2A", light: "#1B4F72", dark: "#060E15" },
    secondary:  { main: "#1B4F72" },
    background: { default: "#F8FAFC", paper: "#FFFFFF" },
    text:       { primary: "#0D1B2A", secondary: "#64748B" },
    error:      { main: "#DC2626" },
    success:    { main: "#059669" },
    warning:    { main: "#D97706" },
    info:       { main: "#1B4F72" },
    divider:    "#E2E8F0",
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: { fontWeight: 800, letterSpacing: -0.5 },
    h2: { fontWeight: 700, letterSpacing: -0.3 },
    h3: { fontWeight: 700, letterSpacing: -0.2 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 500 },
    subtitle2: { fontWeight: 600, color: "#64748B" },
    body1: { lineHeight: 1.6 },
    body2: { lineHeight: 1.5 },
    button: { fontWeight: 600, textTransform: "none" },
    caption: { color: "#64748B" },
  },
  shape: { borderRadius: 10 },
  shadows: [
    "none",
    "0 1px 3px rgba(15,23,42,0.04), 0 1px 2px rgba(15,23,42,0.04)",
    "0 2px 6px rgba(15,23,42,0.06)",
    "0 4px 12px rgba(15,23,42,0.08)",
    "0 6px 20px rgba(15,23,42,0.10)",
    "0 8px 24px rgba(15,23,42,0.12)",
    "0 10px 28px rgba(15,23,42,0.14)",
    "0 12px 32px rgba(15,23,42,0.16)",
    "0 14px 36px rgba(15,23,42,0.18)",
    "0 16px 40px rgba(15,23,42,0.20)",
    "0 18px 44px rgba(15,23,42,0.22)",
    "0 20px 48px rgba(15,23,42,0.24)",
    "0 22px 52px rgba(15,23,42,0.26)",
    "0 24px 56px rgba(15,23,42,0.28)",
    "0 26px 60px rgba(15,23,42,0.30)",
    "0 28px 64px rgba(15,23,42,0.32)",
    "0 30px 68px rgba(15,23,42,0.34)",
    "0 32px 72px rgba(15,23,42,0.36)",
    "0 34px 76px rgba(15,23,42,0.38)",
    "0 36px 80px rgba(15,23,42,0.40)",
    "0 38px 84px rgba(15,23,42,0.42)",
    "0 40px 88px rgba(15,23,42,0.44)",
    "0 42px 92px rgba(15,23,42,0.46)",
    "0 44px 96px rgba(15,23,42,0.48)",
    "0 46px 100px rgba(15,23,42,0.50)",
  ] as any,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          backgroundColor: "#F8FAFC",
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: "1px solid #E2E8F0",
          borderRadius: 12,
          boxShadow: "none",
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: "none" },
        outlined: { borderColor: "#E2E8F0" },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
          textTransform: "none",
          fontSize: 14,
          letterSpacing: 0,
        },
        contained: {
          boxShadow: "none",
          "&:hover": { boxShadow: "none" },
        },
        containedPrimary: {
          backgroundColor: "#0D1B2A",
          "&:hover": { backgroundColor: "#1B4F72" },
        },
        outlined: {
          borderColor: "#E2E8F0",
          color: "#0D1B2A",
          "&:hover": { backgroundColor: "#F8FAFC", borderColor: "#CBD5E1" },
        },
        text: {
          color: "#0D1B2A",
          "&:hover": { backgroundColor: "#F1F5F9" },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          "&:hover": { backgroundColor: "#F1F5F9" },
        },
      },
    },
    MuiTextField: {
      defaultProps: { size: "small" },
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            backgroundColor: "#FFFFFF",
            borderRadius: 8,
            "& fieldset": { borderColor: "#E2E8F0" },
            "&:hover fieldset": { borderColor: "#CBD5E1" },
            "&.Mui-focused fieldset": { borderColor: "#1B4F72", borderWidth: 1.5 },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        outlined: {
          backgroundColor: "#FFFFFF",
          borderRadius: 8,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          "& fieldset": { borderColor: "#E2E8F0" },
          "&:hover fieldset": { borderColor: "#CBD5E1" },
          "&.Mui-focused fieldset": { borderColor: "#1B4F72", borderWidth: 1.5 },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
          fontSize: 12,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          "& .MuiTableCell-head": {
            backgroundColor: "#F8FAFC",
            color: "#475569",
            fontWeight: 600,
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            borderBottom: "1px solid #E2E8F0",
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:hover": { backgroundColor: "#F8FAFC" },
          "&:last-child td": { borderBottom: 0 },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: "1px solid #E2E8F0",
          padding: "10px 16px",
          fontSize: 13,
          color: "#0D1B2A",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          border: "1px solid #E2E8F0",
          boxShadow: "0 20px 60px rgba(15,23,42,0.15)",
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: 18,
          fontWeight: 700,
          color: "#0D1B2A",
          paddingBottom: 4,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 8, border: "1px solid" },
        standardError: { borderColor: "#FECACA", backgroundColor: "#FEF2F2" },
        standardSuccess: { borderColor: "#A7F3D0", backgroundColor: "#ECFDF5" },
        standardWarning: { borderColor: "#FDE68A", backgroundColor: "#FFFBEB" },
        standardInfo: { borderColor: "#BAE6FD", backgroundColor: "#EFF6FF" },
      },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: "#E2E8F0" } },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: "#0D1B2A",
          fontSize: 12,
          borderRadius: 6,
          fontWeight: 500,
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 4, backgroundColor: "#E2E8F0" },
        bar: { borderRadius: 4 },
      },
    },
    MuiPagination: {
      styleOverrides: {
        root: {},
      },
    },
    MuiPaginationItem: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
          fontSize: 13,
          "&.Mui-selected": {
            backgroundColor: "#0D1B2A",
            color: "#FFFFFF",
            "&:hover": { backgroundColor: "#1B4F72" },
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: "#CBD5E1",
          "&.Mui-checked": { color: "#0D1B2A" },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        track: { backgroundColor: "#CBD5E1" },
        switchBase: {
          "&.Mui-checked": {
            color: "#0D1B2A",
            "& + .MuiSwitch-track": { backgroundColor: "#1B4F72" },
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: 13,
          color: "#64748B",
          "&.Mui-focused": { color: "#1B4F72" },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          "&.Mui-selected": {
            backgroundColor: "rgba(255,255,255,0.08)",
            "&:hover": { backgroundColor: "rgba(255,255,255,0.10)" },
          },
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        paper: { border: "1px solid #E2E8F0", borderRadius: 8, boxShadow: "0 8px 24px rgba(15,23,42,0.10)" },
        option: {
          fontSize: 13,
          "&[aria-selected='true']": { backgroundColor: "#EFF6FF !important" },
        },
      },
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime:        60_000,
          gcTime:           5 * 60_000,
          retry:            1,
          refetchOnWindowFocus: false,
        },
      },
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
