"use client";

import { useEffect, useRef } from "react";
import type { LocationItem } from "@/lib/locations";
import { useThemeMode } from "@/components/ThemeModeContext";

// Les tuiles OSM standard sont toujours claires (blanches) — en mode nuit on
// bascule sur les tuiles sombres CartoDB pour que le fond de carte suive le
// thème au lieu de rester une zone blanche au milieu d'une interface sombre.
const TILE_LIGHT = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
// CartoDB dark_all exige désormais une clé API (tuiles bloquées sans elle) —
// Esri "Dark Gray Canvas" reste gratuit et sans clé (ordre y/x, pas de {s}).
const TILE_DARK = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
const ATTR_LIGHT = "&copy; OpenStreetMap contributors";
const ATTR_DARK = "Esri, HERE, Garmin, &copy; OpenStreetMap contributors";
const MAXZOOM_LIGHT = 19;
const MAXZOOM_DARK = 16;

interface Props {
  items: LocationItem[];
  selectedItem: LocationItem | null;
  onSelectItem: (item: LocationItem | null) => void;
}

const TYPE_COLORS: Record<string, string> = {
  activite: "#1E6091",
  garantie: "#15803d",
  domicile: "#7c3aed",
  caution: "#b45309",
};

function markerColor(type: string | null): string {
  return TYPE_COLORS[(type ?? "").toLowerCase()] ?? "#475569";
}

function createPin(color: string, selected: boolean): string {
  const size = selected ? 36 : 28;
  const r = size / 2;
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 10}" viewBox="0 0 ${size} ${size + 10}"><circle cx="${r}" cy="${r}" r="${r - 2}" fill="${color}" stroke="white" stroke-width="${selected ? 3 : 2}"/><polygon points="${r - 5},${size - 3} ${r + 5},${size - 3} ${r},${size + 10}" fill="${color}"/></svg>`
  )}`;
}

function injectLeafletCss() {
  if (document.getElementById("leaflet-css")) return;
  const link = document.createElement("link");
  link.id = "leaflet-css";
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
}

export default function LocationsMapView({ items, selectedItem, onSelectItem }: Props) {
  const { mode } = useThemeMode();
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const tileLayerRef = useRef<any>(null);
  const initDoneRef = useRef(false);

  // Init map once
  useEffect(() => {
    if (typeof window === "undefined" || initDoneRef.current) return;
    initDoneRef.current = true;

    injectLeafletCss();

    // Wait for CSS to paint before creating map
    const timer = setTimeout(async () => {
      const L = (await import("leaflet")).default;
      if (!containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        preferCanvas: true,
      }).setView([12.5, -3.0], 5);

      mapRef.current = map;

      tileLayerRef.current = L.tileLayer(mode === "dark" ? TILE_DARK : TILE_LIGHT, {
        attribution: mode === "dark" ? ATTR_DARK : ATTR_LIGHT,
        maxZoom: mode === "dark" ? MAXZOOM_DARK : MAXZOOM_LIGHT,
        keepBuffer: 4,
      }).addTo(map);

      // Force recalc after layout is stable
      setTimeout(() => map.invalidateSize(), 200);
    }, 50);

    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Basculer le calque de tuiles si le mode change après l'init de la carte.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileLayerRef.current) return;
    import("leaflet").then(({ default: Leaflet }) => {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = Leaflet.tileLayer(mode === "dark" ? TILE_DARK : TILE_LIGHT, {
        attribution: mode === "dark" ? ATTR_DARK : ATTR_LIGHT,
        maxZoom: mode === "dark" ? MAXZOOM_DARK : MAXZOOM_LIGHT,
        keepBuffer: 4,
      }).addTo(map);
    });
  }, [mode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        initDoneRef.current = false;
      }
    };
  }, []);

  // Update markers when items or selection changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    const draw = async () => {
      const map = mapRef.current;
      if (!map) return;

      const L = (await import("leaflet")).default;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      if (items.length === 0) return;

      const bounds: [number, number][] = [];

      items.forEach((loc) => {
        if (loc.latitude == null || loc.longitude == null) return;
        const color = markerColor(loc.type);
        const isSelected = selectedItem?.id === loc.id;

        const icon = L.icon({
          iconUrl: createPin(color, isSelected),
          iconSize: [isSelected ? 36 : 28, isSelected ? 46 : 38],
          iconAnchor: [isSelected ? 18 : 14, isSelected ? 46 : 38],
          popupAnchor: [0, -40],
        });

        const clientLabel = loc.clientName ?? loc.clientCode ?? "Client inconnu";
        const operateur = loc.userName ?? "Inconnu";
        const typeLabel = loc.type ?? "N/A";
        const dateStr = loc.timestamp
          ? new Date(loc.timestamp).toLocaleString("fr-FR", {
              day: "2-digit", month: "2-digit", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })
          : "--";

        const popupHtml = [
          `<div style="font-family:system-ui,sans-serif;font-size:13px;line-height:1.6;min-width:200px">`,
          `<strong style="font-size:14px;color:var(--text-primary)">${clientLabel}</strong>`,
          loc.clientCode ? `<div style="color:var(--text-muted);font-size:11px;margin-bottom:6px">${loc.clientCode}</div>` : "",
          `<div><b>Operateur:</b> ${operateur}</div>`,
          `<div><b>Type:</b> ${typeLabel}</div>`,
          `<div><b>Date:</b> ${dateStr}</div>`,
          loc.address ? `<div style="color:var(--text-secondary);margin-top:4px;font-size:12px">${loc.address}</div>` : "",
          `<a href="https://www.google.com/maps?q=${loc.latitude},${loc.longitude}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:6px;color:#1A73E8;font-size:12px">Voir dans Google Maps</a>`,
          `</div>`,
        ].join("");

        const marker = L.marker([loc.latitude, loc.longitude], { icon })
          .bindPopup(L.popup({ closeButton: true, maxWidth: 280 }).setContent(popupHtml))
          .addTo(map);

        marker.on("click", () => onSelectItem(loc));
        if (isSelected) marker.openPopup();

        bounds.push([loc.latitude, loc.longitude]);
        markersRef.current.push(marker);
      });

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
      }

      // Ensure tiles fill after fitBounds
      setTimeout(() => map.invalidateSize(), 100);
    };

    // Wait for map to be ready if items arrive before map init completes
    const timer = setTimeout(draw, 300);
    return () => clearTimeout(timer);
  }, [items, selectedItem, onSelectItem]);

  return (
    <div
      ref={containerRef}
      style={{
        height: 520,
        width: "100%",
        background: "#E8EEF4",
        position: "relative",
      }}
    />
  );
}
