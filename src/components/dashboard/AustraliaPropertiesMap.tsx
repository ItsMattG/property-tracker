"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Property {
  id: string;
  address: string;
  suburb: string;
  state: string;
  postcode: string;
}

interface AustraliaPropertiesMapProps {
  properties: Property[];
}

// Convert geographic coordinates to SVG coordinates
// Australia spans ~113°E-154°E longitude, ~10°S-44°S latitude
// ViewBox: 0 0 400 380 with padding
const LON_MIN = 112;
const LON_RANGE = 43; // 112 to 155
const LAT_MIN = 9; // 9°S (top of viewbox)
const LAT_RANGE = 36; // 9°S to 45°S

function geoToSvg(lon: number, lat: number): [number, number] {
  const x = ((lon - LON_MIN) / LON_RANGE) * 400;
  const y = ((Math.abs(lat) - LAT_MIN) / LAT_RANGE) * 380;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

// Simplified mainland Australia outline (~35 points, clockwise from SW)
const MAINLAND_POINTS: [number, number][] = [
  [115.0, -34.5], // SW corner (Cape Leeuwin)
  [114.6, -31.5], // Perth area
  [113.5, -26.5], // Shark Bay
  [113.8, -23.5], // Carnarvon
  [114.8, -22.0], // Exmouth
  [118.5, -20.2], // Port Hedland
  [122.0, -17.8], // Broome
  [126.0, -14.5], // Kimberley
  [129.5, -14.8], // Keep River
  [130.8, -12.3], // Darwin
  [133.0, -11.8], // Arnhem Land
  [136.5, -12.0], // Gulf of Carpentaria north
  [136.8, -15.8], // Gulf west indent
  [138.8, -17.2], // Gulf bottom
  [140.8, -17.5], // Gulf east
  [141.5, -13.0], // Cape York west
  [142.5, -10.7], // Cape York tip
  [143.5, -14.0], // Cape York east
  [145.5, -15.0], // Cooktown
  [146.0, -18.8], // Townsville
  [148.5, -20.0], // Mackay
  [150.5, -23.5], // Gladstone
  [153.0, -27.0], // Brisbane
  [153.4, -28.5], // Gold Coast
  [153.0, -30.5], // Coffs Harbour
  [151.2, -33.8], // Sydney
  [150.2, -36.5], // South coast NSW
  [148.0, -37.5], // East Gippsland
  [146.0, -38.8], // Wilsons Promontory
  [144.5, -38.3], // Melbourne
  [141.0, -38.2], // SA border
  [139.5, -36.0], // Murray mouth
  [138.5, -35.0], // Adelaide
  [136.5, -35.5], // Yorke Peninsula
  [136.0, -34.0], // Spencer Gulf
  [137.5, -32.8], // Spencer Gulf inland
  [136.0, -33.8], // Spencer Gulf west
  [133.5, -32.5], // Ceduna
  [129.0, -32.0], // Nullarbor
  [124.0, -33.5], // Great Australian Bight
  [119.0, -34.5], // SW WA
];

// Tasmania outline (~12 points)
const TASMANIA_POINTS: [number, number][] = [
  [145.0, -40.8], // NW
  [146.5, -41.0], // N
  [148.2, -40.8], // NE
  [148.3, -41.5], // E
  [147.8, -43.0], // SE
  [146.5, -43.4], // S
  [145.0, -43.0], // SW
  [144.5, -41.8], // W
];

function pointsToPath(points: [number, number][]): string {
  return points
    .map(([lon, lat], i) => {
      const [x, y] = geoToSvg(lon, lat);
      return `${i === 0 ? "M" : "L"} ${x},${y}`;
    })
    .join(" ") + " Z";
}

const MAINLAND_PATH = pointsToPath(MAINLAND_POINTS);
const TASMANIA_PATH = pointsToPath(TASMANIA_POINTS);

// Major city coordinates for postcode-based pin placement
// Each state has capital city coords + offset based on postcode range
const STATE_CENTERS: Record<string, { lon: number; lat: number }> = {
  NSW: { lon: 151.2, lat: -33.9 },
  VIC: { lon: 144.9, lat: -37.8 },
  QLD: { lon: 153.0, lat: -27.5 },
  SA: { lon: 138.6, lat: -34.9 },
  WA: { lon: 115.9, lat: -32.0 },
  TAS: { lon: 147.3, lat: -42.0 },
  NT: { lon: 130.8, lat: -12.5 },
  ACT: { lon: 149.1, lat: -35.3 },
};

function postcodeToCoords(postcode: string, state: string): { cx: number; cy: number } {
  const center = STATE_CENTERS[state] || { lon: 134.0, lat: -25.0 };

  // Use postcode to create a deterministic offset within the state
  const pc = parseInt(postcode, 10);
  const hash = ((pc * 2654435761) >>> 0) % 1000;
  const lonOffset = ((hash % 20) - 10) * 0.15;
  const latOffset = (((hash * 7) % 20) - 10) * 0.1;

  const [cx, cy] = geoToSvg(center.lon + lonOffset, center.lat + latOffset);
  return { cx, cy };
}

export function AustraliaPropertiesMap({ properties }: AustraliaPropertiesMapProps) {
  if (!properties || properties.length === 0) return null;

  const pins = properties.map((p) => ({
    ...postcodeToCoords(p.postcode, p.state),
    label: `${p.suburb}, ${p.state} ${p.postcode}`,
    id: p.id,
  }));

  return (
    <Card data-testid="australia-map">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Property Locations</CardTitle>
        <MapPin className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="flex items-center justify-center">
        <TooltipProvider delayDuration={0}>
          <svg
            viewBox="0 0 400 380"
            className="w-full h-auto max-h-[220px]"
            role="img"
            aria-label={`Map of Australia showing ${properties.length} ${properties.length === 1 ? "property" : "properties"}`}
          >
            {/* Mainland Australia */}
            <path
              d={MAINLAND_PATH}
              fill="hsl(var(--primary) / 0.08)"
              stroke="hsl(var(--primary) / 0.25)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />

            {/* Tasmania */}
            <path
              d={TASMANIA_PATH}
              fill="hsl(var(--primary) / 0.08)"
              stroke="hsl(var(--primary) / 0.25)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />

            {/* Property pins */}
            {pins.map((pin) => (
              <Tooltip key={pin.id}>
                <TooltipTrigger asChild>
                  <g className="cursor-pointer" data-testid="map-pin">
                    <circle
                      cx={pin.cx}
                      cy={pin.cy}
                      r="10"
                      fill="hsl(var(--primary) / 0.15)"
                    />
                    <circle
                      cx={pin.cx}
                      cy={pin.cy}
                      r="5"
                      fill="hsl(var(--primary))"
                      stroke="hsl(var(--background))"
                      strokeWidth="1.5"
                    />
                  </g>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {pin.label}
                </TooltipContent>
              </Tooltip>
            ))}
          </svg>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
