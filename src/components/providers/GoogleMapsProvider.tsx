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

// Inner component that uses the hook (only rendered when API key exists)
function GoogleMapsLoaderProvider({
  children,
  apiKey
}: {
  children: ReactNode;
  apiKey: string;
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries,
    preventGoogleFontsLoading: true,
  });

  return (
    <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
      {children}
    </GoogleMapsContext.Provider>
  );
}

// Outer component that conditionally renders the loader
export function GoogleMapsProvider({ children }: GoogleMapsProviderProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

  // If no API key, render children without Google Maps functionality
  if (!apiKey) {
    return (
      <GoogleMapsContext.Provider value={{ isLoaded: false, loadError: undefined }}>
        {children}
      </GoogleMapsContext.Provider>
    );
  }

  return (
    <GoogleMapsLoaderProvider apiKey={apiKey}>
      {children}
    </GoogleMapsLoaderProvider>
  );
}
