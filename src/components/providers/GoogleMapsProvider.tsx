"use client";

import { createContext, useContext, ReactNode } from "react";
import { useJsApiLoader } from "@react-google-maps/api";

const libraries: ("places")[] = ["places"];

interface GoogleMapsContextValue {
  isLoaded: boolean;
  loadError: Error | undefined;
}

const GoogleMapsContext = createContext<GoogleMapsContextValue>({
  isLoaded: false,
  loadError: undefined,
});

export function useGoogleMapsLoaded() {
  const context = useContext(GoogleMapsContext);
  return context.isLoaded;
}

export function useGoogleMapsError() {
  const context = useContext(GoogleMapsContext);
  return context.loadError;
}

interface GoogleMapsProviderProps {
  children: ReactNode;
}

export function GoogleMapsProvider({ children }: GoogleMapsProviderProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey || "",
    libraries,
    // Prevent loading if no API key
    preventGoogleFontsLoading: true,
  });

  // If no API key, don't try to load - components will fall back to regular inputs
  const effectiveIsLoaded = apiKey ? isLoaded : false;

  return (
    <GoogleMapsContext.Provider
      value={{ isLoaded: effectiveIsLoaded, loadError }}
    >
      {children}
    </GoogleMapsContext.Provider>
  );
}
