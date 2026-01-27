"use client";

import { useEffect, useRef, useCallback } from "react";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { trpc } from "@/lib/trpc/client";
import {
  dashboardTour,
  addPropertyTour,
  bankingTour,
  transactionsTour,
  portfolioTour,
  type TourDefinition,
} from "@/config/tours";

const TOUR_MAP: Record<string, TourDefinition> = {
  dashboard: dashboardTour,
  "add-property": addPropertyTour,
  banking: bankingTour,
  transactions: transactionsTour,
  portfolio: portfolioTour,
};

interface UseTourOptions {
  tourId: string;
  autoStart?: boolean;
}

export function useTour({ tourId, autoStart = true }: UseTourOptions) {
  const driverRef = useRef<Driver | null>(null);
  const hasAutoStarted = useRef(false);
  const utils = trpc.useUtils();

  const { data: onboarding } = trpc.onboarding.getProgress.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  const completeTour = trpc.onboarding.completeTour.useMutation({
    onSuccess: () => {
      utils.onboarding.getProgress.invalidate();
    },
  });

  const disableTours = trpc.onboarding.disableTours.useMutation({
    onSuccess: () => {
      utils.onboarding.getProgress.invalidate();
    },
  });

  const isTourComplete = onboarding?.completedTours?.includes(tourId) ?? false;
  const isToursDisabled = onboarding?.toursDisabled ?? false;

  const startTour = useCallback(() => {
    const tourDef = TOUR_MAP[tourId];
    if (!tourDef) return;

    // Filter steps to only those with existing elements
    const validSteps = tourDef.steps.filter((step) => {
      if (!step.element) return true;
      return document.querySelector(step.element as string);
    });

    if (validSteps.length === 0) return;

    const driverInstance = driver({
      showProgress: true,
      animate: true,
      popoverOffset: 10,
      steps: validSteps,
      onDestroyStarted: () => {
        completeTour.mutate({ tourId });
        driverInstance.destroy();
      },
      onNextClick: () => {
        if (!driverInstance.hasNextStep()) {
          completeTour.mutate({ tourId });
          driverInstance.destroy();
        } else {
          driverInstance.moveNext();
        }
      },
      popoverClass: "property-tracker-tour",
    });

    driverRef.current = driverInstance;
    driverInstance.drive();
  }, [tourId, completeTour]);

  const disableAllTours = useCallback(() => {
    disableTours.mutate();
    if (driverRef.current) {
      driverRef.current.destroy();
    }
  }, [disableTours]);

  // Auto-start tour on first visit
  useEffect(() => {
    if (
      !autoStart ||
      !onboarding ||
      isTourComplete ||
      isToursDisabled ||
      hasAutoStarted.current
    ) {
      return;
    }

    hasAutoStarted.current = true;
    const timer = setTimeout(() => {
      startTour();
    }, 500);

    return () => clearTimeout(timer);
  }, [autoStart, onboarding, isTourComplete, isToursDisabled, startTour]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (driverRef.current) {
        driverRef.current.destroy();
      }
    };
  }, []);

  return {
    startTour,
    isTourComplete,
    isToursDisabled,
    disableAllTours,
  };
}
