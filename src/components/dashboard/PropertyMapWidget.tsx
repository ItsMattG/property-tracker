"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Grid3X3, Triangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AustraliaPropertiesMap } from "./AustraliaPropertiesMap";
import { AustraliaGeometricMap } from "./AustraliaGeometricMap";
import type { AustraliaPropertiesMapProps } from "./AustraliaPropertiesMap";

type MapStyle = "dots" | "geometric";

const STORAGE_KEY = "bricktrack-map-style";

function getStoredStyle(): MapStyle {
  if (typeof window === "undefined") return "dots";
  return (localStorage.getItem(STORAGE_KEY) as MapStyle) || "dots";
}

export function PropertyMapWidget({ properties }: AustraliaPropertiesMapProps) {
  const [style, setStyle] = useState<MapStyle>("dots");

  useEffect(() => {
    setStyle(getStoredStyle());
  }, []);

  const toggleStyle = (newStyle: MapStyle) => {
    setStyle(newStyle);
    localStorage.setItem(STORAGE_KEY, newStyle);
  };

  if (!properties || properties.length === 0) return null;

  const MapComponent = style === "geometric" ? AustraliaGeometricMap : AustraliaPropertiesMap;

  return (
    <div className="relative" data-testid="property-map-widget">
      {/* Style toggle overlay — positioned in the card header area */}
      <div className="absolute top-3 right-10 z-10 flex gap-0.5 bg-muted/80 backdrop-blur-sm rounded-md p-0.5">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={style === "dots" ? "secondary" : "ghost"}
                size="icon"
                className="h-6 w-6"
                onClick={() => toggleStyle("dots")}
              >
                <Grid3X3 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Dot matrix</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={style === "geometric" ? "secondary" : "ghost"}
                size="icon"
                className="h-6 w-6"
                onClick={() => toggleStyle("geometric")}
              >
                <Triangle className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Geometric</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <MapComponent properties={properties} />
    </div>
  );
}
