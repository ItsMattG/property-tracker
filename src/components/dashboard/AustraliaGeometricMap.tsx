"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AustraliaPropertiesMapProps } from "./AustraliaPropertiesMap";

// Shared coordinate system with dot-matrix version
const PAD = 20;
const SVG_W = 400;
const SVG_H = 340;
const LON_MIN = 112;
const LON_MAX = 155;
const LAT_MIN = -10;
const LAT_MAX = -45;

function toSvg(lon: number, lat: number): [number, number] {
  const x = PAD + ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * (SVG_W - 2 * PAD);
  const y = PAD + ((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * (SVG_H - 2 * PAD);
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

const STATE_CENTERS: Record<string, { lon: number; lat: number }> = {
  NSW: { lon: 151.2, lat: -33.9 },
  VIC: { lon: 144.96, lat: -37.81 },
  QLD: { lon: 153.0, lat: -27.5 },
  SA: { lon: 138.6, lat: -34.9 },
  WA: { lon: 115.9, lat: -32.0 },
  TAS: { lon: 147.3, lat: -42.0 },
  NT: { lon: 130.8, lat: -12.5 },
  ACT: { lon: 149.1, lat: -35.3 },
};

interface Property {
  id: string;
  address: string;
  suburb: string;
  state: string;
  postcode: string;
  latitude: string | null;
  longitude: string | null;
}

function getPropertyCoords(p: Property): { cx: number; cy: number } {
  if (p.latitude && p.longitude) {
    const [cx, cy] = toSvg(parseFloat(p.longitude), parseFloat(p.latitude));
    return { cx, cy };
  }
  const center = STATE_CENTERS[p.state] || { lon: 134.0, lat: -25.0 };
  const pc = parseInt(p.postcode, 10);
  const hash = ((pc * 2654435761) >>> 0) % 1000;
  const lonOffset = ((hash % 20) - 10) * 0.15;
  const latOffset = (((hash * 7) % 20) - 10) * 0.1;
  const [cx, cy] = toSvg(center.lon + lonOffset, center.lat + latOffset);
  return { cx, cy };
}

// Accurate outline paths from coastline data
const MAINLAND_PATH = "M45.1,230 L43.4,221.4 L41.8,204.3 L36.7,191.4 L32.6,161.4 L33.4,144.3 L35.1,135.7 L38.4,127.1 L43.4,122.9 L49.3,118.6 L61.9,110 L74.4,107.4 L82.8,104 L95.3,101.4 L103.7,86.9 L116.3,75.7 L124.7,67.1 L133,58.6 L141.4,54.3 L154,58.6 L162.3,61.1 L166.5,56 L174.9,44 L177.4,39.7 L183.3,37.1 L191.6,35.4 L195.8,38.9 L204.2,37.1 L216.7,38.9 L220.9,41.4 L225.1,37.1 L227.6,50 L225.1,69.7 L233.5,75.7 L241.9,78.3 L246,80 L250.2,81.7 L258.6,84.3 L262.8,67.1 L267,50 L267,41.4 L271.2,28.6 L275.3,26 L279.5,32.9 L283.7,41.4 L286.2,54.3 L292.1,58.6 L296.3,62.9 L300.5,75.7 L304.7,88.6 L308.8,97.1 L313,101.4 L321.4,105.7 L329.8,114.3 L334,122.9 L338.1,131.4 L342.3,135.7 L346.5,144.3 L354.9,152.9 L363.3,165.7 L366.6,172.6 L366.6,178.6 L364.9,187.1 L363.3,195.7 L359.1,208.6 L350.7,221.4 L348.2,224.9 L344.8,234.3 L339.8,242.9 L334,251.4 L325.6,255.7 L317.2,260 L308.8,264.3 L304.7,266.9 L300.5,264.3 L296.3,262.6 L292.1,262.6 L283.7,264.3 L275.3,262.6 L262.8,261.7 L254.4,255.7 L250.2,242.9 L241.9,238.6 L237.7,234.3 L233.5,238.6 L225.1,241.1 L220.9,236 L220.9,225.7 L229.3,217.1 L233.5,217.1 L229.3,225.7 L225.1,230 L216.7,232.6 L204.2,224 L200,212.9 L179.1,204.3 L162.3,208.6 L145.6,212.9 L120.5,217.1 L95.3,224 L78.6,225.7 L61.9,230 Z";
const TASMANIA_PATH = "M296.3,284 L300.5,281.4 L308.8,285.7 L317.2,285.7 L321.4,284 L323.9,287.4 L323.9,294.3 L319.7,302.9 L313,306.3 L304.7,307.1 L300.5,304.6 L296.3,301.1 L292.1,294.3 L293.8,290 L296.3,284 Z";

// Gradient IDs for facet fills
const GRADIENTS = ["g1", "g2", "g3", "g4", "g5"] as const;

// Triangulated facets for mainland (clipped to outline)
// prettier-ignore
const MAINLAND_FACETS: { points: string; grad: number }[] = [
  // Top row (NT/QLD)
  { points: "174.9,44 183.3,37.1 195.8,38.9", grad: 0 },
  { points: "195.8,38.9 204.2,37.1 216.7,38.9", grad: 2 },
  { points: "216.7,38.9 225.1,37.1 227.6,50", grad: 4 },
  { points: "227.6,50 225.1,69.7 218,58.1", grad: 1 },
  { points: "267,41.4 271.2,28.6 275.3,26", grad: 3 },
  { points: "275.3,26 279.5,32.9 267.3,52.9", grad: 0 },
  { points: "267,50 262.8,67.1 258.6,84.3", grad: 2 },
  { points: "283.7,41.4 292.1,58.6 275.6,97", grad: 4 },
  // Wide middle
  { points: "43.4,122.9 64.1,120.8 49.3,118.6", grad: 0 },
  { points: "64.1,120.8 82,116 82.8,104", grad: 2 },
  { points: "82,116 95.3,101.4 113.1,90.3", grad: 4 },
  { points: "113.1,90.3 116.3,75.7 124.7,67.1", grad: 1 },
  { points: "124.7,67.1 133,58.6 146.3,64.6", grad: 3 },
  { points: "141.4,54.3 154,58.6 146.3,64.6", grad: 0 },
  { points: "154,58.6 176.1,58.6 162.3,61.1", grad: 2 },
  { points: "166.5,56 174.9,44 176.1,58.6", grad: 4 },
  { points: "174.9,44 195.8,38.9 186.5,84.2", grad: 1 },
  { points: "195.8,38.9 218,58.1 202.5,97.6", grad: 3 },
  { points: "218,58.1 227.6,50 241.8,82", grad: 0 },
  { points: "241.8,82 241.9,78.3 250.2,81.7", grad: 2 },
  { points: "250.2,81.7 258.6,84.3 262.6,119.5", grad: 4 },
  { points: "258.6,84.3 267.3,52.9 275.6,97", grad: 1 },
  { points: "275.6,97 292.1,85.3 296.3,62.9", grad: 3 },
  { points: "292.1,58.6 296.3,62.9 292.1,85.3", grad: 0 },
  { points: "296.3,62.9 300.5,75.7 306.5,117.2", grad: 2 },
  { points: "304.7,88.6 313,101.4 306.5,117.2", grad: 4 },
  { points: "313,101.4 321.4,105.7 330.3,125.6", grad: 1 },
  { points: "329.8,114.3 334,122.9 330.3,125.6", grad: 3 },
  { points: "334,122.9 338.1,131.4 326.4,142.2", grad: 0 },
  { points: "338.1,131.4 346.5,144.3 336.2,182.9", grad: 2 },
  { points: "346.5,144.3 354.9,152.9 352.4,180.4", grad: 4 },
  { points: "354.9,152.9 363.3,165.7 366.6,172.6", grad: 1 },
  { points: "366.6,172.6 366.6,178.6 352.4,180.4", grad: 3 },
  // Interior fill
  { points: "64.1,120.8 53.4,142.9 43.4,122.9", grad: 2 },
  { points: "64.1,120.8 82,116 97.4,158", grad: 4 },
  { points: "53.4,142.9 97.4,158 67.9,187", grad: 1 },
  { points: "97.4,158 84.5,175.3 67.9,187", grad: 3 },
  { points: "82,116 113.1,90.3 124.6,126.5", grad: 0 },
  { points: "97.4,158 124.6,126.5 118.5,142.5", grad: 2 },
  { points: "118.5,142.5 118.2,181.7 97.4,158", grad: 4 },
  { points: "113.1,90.3 146.3,64.6 150.4,93", grad: 1 },
  { points: "124.6,126.5 150.4,93 152.9,112.2", grad: 3 },
  { points: "150.4,93 176.1,58.6 186.5,84.2", grad: 0 },
  { points: "152.9,112.2 144.3,155.6 118.5,142.5", grad: 2 },
  { points: "186.5,84.2 202.5,97.6 172.2,127.8", grad: 4 },
  { points: "152.9,112.2 186.5,84.2 172.2,127.8", grad: 1 },
  { points: "172.2,127.8 187.8,147.3 144.3,155.6", grad: 3 },
  { points: "202.5,97.6 218,58.1 215.7,113.7", grad: 0 },
  { points: "218,58.1 241.8,82 241.6,123.8", grad: 2 },
  { points: "215.7,113.7 241.6,123.8 207.2,149.4", grad: 4 },
  { points: "241.6,123.8 241.8,82 262.6,119.5", grad: 1 },
  { points: "262.6,119.5 275.6,97 292.1,85.3", grad: 3 },
  { points: "262.6,119.5 292.1,85.3 278,143.6", grad: 0 },
  { points: "292.1,85.3 306.5,117.2 295.9,157.8", grad: 2 },
  { points: "278,143.6 295.9,157.8 262.9,187.5", grad: 4 },
  { points: "306.5,117.2 330.3,125.6 326.4,142.2", grad: 1 },
  { points: "295.9,157.8 306.5,117.2 326.4,142.2", grad: 3 },
  { points: "295.9,157.8 326.4,142.2 300.8,174.3", grad: 0 },
  { points: "326.4,142.2 336.2,182.9 300.8,174.3", grad: 2 },
  { points: "336.2,182.9 352.4,180.4 337.9,232", grad: 4 },
  { points: "322.3,214.6 337.9,232 302.5,208.5", grad: 1 },
  { points: "336.2,182.9 322.3,214.6 300.8,174.3", grad: 3 },
  // Southern
  { points: "67.9,187 52.2,209.5 36.7,191.4", grad: 0 },
  { points: "67.9,187 84.5,175.3 92.6,207.2", grad: 2 },
  { points: "84.5,175.3 118.2,181.7 92.6,207.2", grad: 4 },
  { points: "118.2,181.7 157.5,181.7 124.9,215.6", grad: 1 },
  { points: "144.3,155.6 187.8,147.3 157.5,181.7", grad: 3 },
  { points: "187.8,147.3 207.2,149.4 173.6,175.2", grad: 0 },
  { points: "157.5,181.7 173.6,175.2 142,202.5", grad: 2 },
  { points: "207.2,149.4 235.3,153.8 209.5,187", grad: 4 },
  { points: "235.3,153.8 247,172 232,214.9", grad: 1 },
  { points: "209.5,187 235.3,153.8 213.7,202.9", grad: 3 },
  { points: "247,172 262.9,187.5 275,208.1", grad: 0 },
  { points: "262.9,187.5 278,143.6 295.9,157.8", grad: 2 },
  { points: "300.8,174.3 302.5,208.5 275,208.1", grad: 4 },
  { points: "302.5,208.5 322.3,214.6 294.6,247.4", grad: 1 },
  { points: "275,208.1 302.5,208.5 268,234.5", grad: 3 },
  { points: "337.9,232 344.8,234.3 339.8,242.9", grad: 0 },
  { points: "322.3,214.6 337.9,232 339.8,242.9", grad: 2 },
  // Fill gaps
  { points: "52.2,209.5 92.6,207.2 67.9,187", grad: 4 },
  { points: "92.6,207.2 124.9,215.6 118.2,181.7", grad: 1 },
  { points: "173.6,175.2 209.5,187 213.7,202.9", grad: 3 },
  { points: "213.7,202.9 232,214.9 209.5,187", grad: 0 },
  { points: "232,214.9 268,234.5 247,172", grad: 2 },
  { points: "247,172 275,208.1 262.9,187.5", grad: 4 },
  { points: "241.6,123.8 262.6,119.5 235.3,153.8", grad: 1 },
  { points: "207.2,149.4 241.6,123.8 235.3,153.8", grad: 3 },
];

// Tasmania facets
// prettier-ignore
const TASMANIA_FACETS: { points: string; grad: number }[] = [
  { points: "296.3,284 308.8,285.7 304.7,307.1", grad: 0 },
  { points: "308.8,285.7 323.9,287.4 313,306.3", grad: 2 },
  { points: "296.3,284 304.7,307.1 292.1,294.3", grad: 4 },
  { points: "304.7,307.1 313,306.3 308.8,285.7", grad: 1 },
  { points: "292.1,294.3 304.7,307.1 300.5,304.6", grad: 3 },
  { points: "313,306.3 323.9,294.3 319.7,302.9", grad: 0 },
  { points: "292,299.8 296.3,301.1 293.8,290", grad: 2 },
];

export function AustraliaGeometricMap({ properties }: AustraliaPropertiesMapProps) {
  if (!properties || properties.length === 0) return null;

  const pins = properties.map((p: Property) => ({
    ...getPropertyCoords(p),
    label: `${p.suburb}, ${p.state} ${p.postcode}`,
    id: p.id,
  }));

  return (
    <Card data-testid="australia-map">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Property Locations</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-center pb-4">
        <TooltipProvider delayDuration={0}>
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            className="w-full h-auto"
            role="img"
            aria-label={`Map of Australia showing ${properties.length} ${properties.length === 1 ? "property" : "properties"}`}
          >
            <defs>
              <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" className="[stop-color:var(--color-green-100)] dark:[stop-color:var(--color-green-900)]" />
                <stop offset="100%" className="[stop-color:var(--color-green-200)] dark:[stop-color:var(--color-green-800)]" />
              </linearGradient>
              <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" className="[stop-color:var(--color-green-200)] dark:[stop-color:var(--color-green-800)]" />
                <stop offset="100%" className="[stop-color:var(--color-green-300)] dark:[stop-color:var(--color-green-700)]" />
              </linearGradient>
              <linearGradient id="g3" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" className="[stop-color:var(--color-green-100)] dark:[stop-color:var(--color-green-900)]" />
                <stop offset="100%" className="[stop-color:var(--color-green-50)] dark:[stop-color:var(--color-green-950)]" />
              </linearGradient>
              <linearGradient id="g4" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" className="[stop-color:var(--color-green-200)] dark:[stop-color:var(--color-green-800)]" />
                <stop offset="100%" className="[stop-color:var(--color-green-300)] dark:[stop-color:var(--color-green-700)]" />
              </linearGradient>
              <linearGradient id="g5" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" className="[stop-color:var(--color-green-50)] dark:[stop-color:var(--color-green-950)]" />
                <stop offset="100%" className="[stop-color:var(--color-green-200)] dark:[stop-color:var(--color-green-800)]" />
              </linearGradient>
              <clipPath id="mainland-clip">
                <path d={MAINLAND_PATH} />
              </clipPath>
              <clipPath id="tas-clip">
                <path d={TASMANIA_PATH} />
              </clipPath>
            </defs>

            <style>{`
              @keyframes ring-pulse {
                0% { r: 5; opacity: 0.5; }
                100% { r: 14; opacity: 0; }
              }
              .ring-pulse {
                fill: none;
                stroke: var(--color-green-700);
                stroke-width: 1.5;
                animation: ring-pulse 2.5s ease-out infinite;
              }
            `}</style>

            {/* Mainland facets */}
            <g clipPath="url(#mainland-clip)">
              {MAINLAND_FACETS.map((f, i) => (
                <polygon
                  key={i}
                  points={f.points}
                  fill={`url(#${GRADIENTS[f.grad]})`}
                  className="stroke-white/60 dark:stroke-gray-800/60"
                  strokeWidth={0.6}
                />
              ))}
            </g>

            {/* Tasmania facets */}
            <g clipPath="url(#tas-clip)">
              {TASMANIA_FACETS.map((f, i) => (
                <polygon
                  key={i}
                  points={f.points}
                  fill={`url(#${GRADIENTS[f.grad]})`}
                  className="stroke-white/60 dark:stroke-gray-800/60"
                  strokeWidth={0.6}
                />
              ))}
            </g>

            {/* Property markers */}
            {pins.map((pin, idx) => (
              <Tooltip key={pin.id}>
                <TooltipTrigger asChild>
                  <g className="cursor-pointer" data-testid="map-pin">
                    {/* Ring pulse */}
                    <circle
                      cx={pin.cx}
                      cy={pin.cy}
                      r={5}
                      className="ring-pulse"
                      style={{ animationDelay: `${idx * 0.4}s` }}
                    />
                    {/* Glow */}
                    <circle
                      cx={pin.cx}
                      cy={pin.cy}
                      r={8}
                      className="fill-green-700/10 dark:fill-green-500/10"
                    />
                    {/* Core dot */}
                    <circle
                      cx={pin.cx}
                      cy={pin.cy}
                      r={4.5}
                      className="fill-green-700 dark:fill-green-500"
                    />
                    {/* Center highlight */}
                    <circle
                      cx={pin.cx}
                      cy={pin.cy}
                      r={2}
                      className="fill-white dark:fill-gray-900"
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
