export interface MapLocation {
  id: number;
  clientName?: string | null;
  clientCode?: string | null;
  userName?: string | null;
  type?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  timestamp?: string | null;
}

const TYPE_COLOR: Record<string, string> = {
  domicile:  "#7c3aed",
  garantie:  "#15803d",
  activite:  "#1B4F72",
  caution:   "#b45309",
};

function colorForType(type?: string | null): string {
  return TYPE_COLOR[(type ?? "").toLowerCase()] ?? "#475569";
}

function labelForType(type?: string | null): string {
  switch ((type ?? "").toLowerCase()) {
    case "domicile":  return "Domicile";
    case "garantie":  return "Garantie";
    case "activite":  return "Activité";
    case "caution":   return "Caution";
    default:          return type ?? "Autre";
  }
}

export function buildTenantMapHtml(items: MapLocation[]): string {
  const valid = items.filter((i) => i.latitude != null && i.longitude != null);

  const markersJs = valid.map((item) => {
    const color = colorForType(item.type);
    const label = labelForType(item.type);
    const clientLabel = item.clientName || item.clientCode || "Client";
    const operator = item.userName || "";
    const addr = item.address || "";
    const ts = item.timestamp
      ? new Date(item.timestamp).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : "";

    const popup = [
      '<div style="font-family:Inter,sans-serif;min-width:200px;max-width:260px">',
      '<div style="font-weight:700;font-size:13px;color:#0D1B2A;margin-bottom:4px">' + clientLabel.replace(/'/g, "\\'") + "</div>",
      item.clientCode && item.clientName ? '<div style="font-size:10px;color:#94A3B8;font-family:monospace;margin-bottom:6px">' + (item.clientCode || "").replace(/'/g, "\\'") + "</div>" : "",
      '<div style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;color:white;background:' + color + ';margin-bottom:6px">' + label + "</div>",
      operator ? '<div style="font-size:11px;color:#64748B;margin-bottom:3px">Opérateur : ' + operator.replace(/'/g, "\\'") + "</div>" : "",
      addr ? '<div style="font-size:11px;color:#64748B;margin-bottom:3px">📍 ' + addr.replace(/'/g, "\\'") + "</div>" : "",
      ts ? '<div style="font-size:10px;color:#94A3B8;margin-top:4px">' + ts + "</div>" : "",
      '<div style="font-size:10px;color:#CBD5E1;margin-top:3px;font-family:monospace">' + (item.latitude || 0).toFixed(5) + ", " + (item.longitude || 0).toFixed(5) + "</div>",
      "</div>",
    ].join("");

    const icon = [
      'L.divIcon({',
      '  html: \'<div style="background:' + color + ';width:12px;height:12px;border-radius:50%;border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>\',',
      "  className: '', iconSize: [12, 12], iconAnchor: [6, 6]",
      "})",
    ].join("");

    return (
      "mc.addLayer(L.marker([" + item.latitude + "," + item.longitude + "], {icon:" + icon + "})" +
      ".bindPopup(" + JSON.stringify(popup) + "))"
    );
  }).join(";\n");

  const boundsJs = valid.length > 0
    ? "map.fitBounds([" + valid.map((i) => "[" + i.latitude + "," + i.longitude + "]").join(",") + "], {padding:[40,40]});"
    : "";

  const clusterColors = Object.entries(TYPE_COLOR).map(([, c]) => c);
  const clusterJs = [
    "var mc = L.markerClusterGroup({",
    "  maxClusterRadius: 60,",
    "  spiderfyOnMaxZoom: true,",
    "  showCoverageOnHover: false,",
    "  iconCreateFunction: function(cluster) {",
    "    var n = cluster.getChildCount();",
    "    var size = n < 10 ? 32 : n < 100 ? 40 : 48;",
    "    return L.divIcon({",
    "      html: '<div style=\"background:#C49A2E;color:#0D1B2A;border-radius:50%;width:'+size+'px;height:'+size+'px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:'+(size<40?12:14)+'px;border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3)\">'+n+'<" + "/div>',",
    "      className: '', iconSize: [size,size]",
    "    });",
    "  }",
    "});",
  ].join("\n");

  const parts: string[] = [
    "<!DOCTYPE html>",
    "<html>",
    "<head>",
    '<meta charset="utf-8"/>',
    '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>',
    '<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"/>',
    '<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"/>',
    '<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><' + "/script>",
    '<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"><' + "/script>",
    "<style>",
    "  body,html{margin:0;padding:0;height:100%}",
    "  #map{width:100%;height:100vh}",
    "  .leaflet-popup-content-wrapper{border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.18)}",
    "  .leaflet-popup-content{margin:10px 13px}",
    "<" + "/style>",
    "<" + "/head>",
    "<body>",
    '<div id="map"><' + "/div>",
    "<script>",
    "var map = L.map('map',{zoomControl:true}).setView([5,20],4);",
    "L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:19}).addTo(map);",
    clusterJs,
    markersJs + ";",
    "map.addLayer(mc);",
    boundsJs,
    "<" + "/script>",
    "<" + "/body>",
    "<" + "/html>",
  ];

  return parts.join("\n");
}
