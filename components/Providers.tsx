"use client";

import { ReactNode, useMemo, useState } from "react";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeModeProvider, useThemeMode } from "@/components/ThemeModeContext";

function buildTheme(mode: "light" | "dark") {
  const isDark = mode === "dark";
  return createTheme({
  palette: {
    mode,
    primary:    { main: "#0F3B5C", light: "#1E6091", dark: "#060E15" },
    secondary:  { main: "#1E6091" },
    background: { default: isDark ? "#0A1420" : "#F8FAFC", paper: isDark ? "#0F1D2E" : "#FFFFFF" },
    text:       { primary: isDark ? "#E8EEF5" : "#0F3B5C", secondary: isDark ? "#9AAEC4" : "#64748B" },
    error:      { main: "#DC2626" },
    success:    { main: "#059669" },
    warning:    { main: "#D97706" },
    info:       { main: "#1E6091" },
    divider:    isDark ? "#22334A" : "#E2E8F0",
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
          backgroundColor: "var(--bg-page)",
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: "1px solid var(--border)",
          borderRadius: 12,
          boxShadow: "none",
          backgroundColor: "var(--bg-surface)",
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: "none", backgroundColor: "var(--bg-surface)" },
        outlined: { borderColor: "var(--border)" },
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
          backgroundColor: "#0F3B5C",
          "&:hover": { backgroundColor: "#1E6091" },
        },
        outlined: {
          borderColor: "var(--border)",
          color: "var(--text-primary)",
          "&:hover": { backgroundColor: "var(--bg-hover)", borderColor: "var(--border-strong)" },
        },
        text: {
          color: "var(--text-primary)",
          "&:hover": { backgroundColor: "var(--bg-hover)" },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          "&:hover": { backgroundColor: "var(--bg-hover)" },
        },
      },
    },
    MuiTextField: {
      defaultProps: { size: "small" },
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            backgroundColor: "var(--bg-surface)",
            borderRadius: 8,
            "& fieldset": { borderColor: "var(--border)" },
            "&:hover fieldset": { borderColor: "var(--border-strong)" },
            "&.Mui-focused fieldset": { borderColor: "#1E6091", borderWidth: 1.5 },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        outlined: {
          backgroundColor: "var(--bg-surface)",
          borderRadius: 8,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          "& fieldset": { borderColor: "var(--border)" },
          "&:hover fieldset": { borderColor: "var(--border-strong)" },
          "&.Mui-focused fieldset": { borderColor: "#1E6091", borderWidth: 1.5 },
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
            backgroundColor: "var(--bg-surface-alt)",
            color: "var(--text-secondary)",
            fontWeight: 600,
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            borderBottom: "1px solid var(--border)",
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:hover": { backgroundColor: "var(--bg-surface-alt)" },
          "&:last-child td": { borderBottom: 0 },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: "1px solid var(--border)",
          padding: "10px 16px",
          fontSize: 13,
          color: "var(--text-primary)",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          border: "1px solid var(--border)",
          boxShadow: "0 20px 60px rgba(15,23,42,0.15)",
          backgroundColor: "var(--bg-surface)",
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: 18,
          fontWeight: 700,
          color: "var(--text-primary)",
          paddingBottom: 4,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 8, border: "1px solid" },
        standardError: { borderColor: "#FECACA", backgroundColor: "#FEF2F2", color: "#7F1D1D" },
        standardSuccess: { borderColor: "#A7F3D0", backgroundColor: "#ECFDF5", color: "#065F46" },
        standardWarning: { borderColor: "#FDE68A", backgroundColor: "#FFFBEB", color: "#78350F" },
        standardInfo: { borderColor: "#BAE6FD", backgroundColor: "#EFF6FF", color: "#0C4A6E" },
      },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: "var(--border)" } },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: "#0F3B5C",
          fontSize: 12,
          borderRadius: 6,
          fontWeight: 500,
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 4, backgroundColor: "var(--border)" },
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
          color: "var(--text-primary)",
          "&.Mui-selected": {
            backgroundColor: "#0F3B5C",
            color: "#FFFFFF",
            "&:hover": { backgroundColor: "#1E6091" },
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: "var(--border-strong)",
          "&.Mui-checked": { color: "#0F3B5C" },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        track: { backgroundColor: "var(--border-strong)" },
        switchBase: {
          "&.Mui-checked": {
            color: "#0F3B5C",
            "& + .MuiSwitch-track": { backgroundColor: "#1E6091" },
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: 13,
          color: "var(--text-secondary)",
          "&.Mui-focused": { color: "#1E6091" },
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
        paper: { border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 8px 24px rgba(15,23,42,0.10)" },
        option: {
          fontSize: 13,
          "&[aria-selected='true']": { backgroundColor: "rgba(30,96,145,0.12) !important" },
        },
      },
    },
  },
  });
}

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
      <ThemeModeProvider>
        <ThemedApp>{children}</ThemedApp>
      </ThemeModeProvider>
    </QueryClientProvider>
  );
}

function ThemedApp({ children }: { children: ReactNode }) {
  const { mode } = useThemeMode();
  const theme = useMemo(() => buildTheme(mode), [mode]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
