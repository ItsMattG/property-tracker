import { z } from "zod";

/** Positive decimal amount (e.g., "100", "100.50"). Used for prices, rates, balances. */
export const positiveAmountSchema = z
  .string()
  .regex(/^\d+\.?\d*$/, "Must be a valid positive number");

/** Signed decimal amount (e.g., "-100.50", "200"). Used for transaction amounts. */
export const signedAmountSchema = z
  .string()
  .regex(/^-?\d+\.?\d*$/, "Must be a valid number");

/** Australian 4-digit postcode. */
export const australianPostcodeSchema = z
  .string()
  .regex(/^\d{4}$/, "Must be a 4-digit Australian postcode");

/** Suburb name — letters, spaces, hyphens, apostrophes only. */
export const suburbSchema = z
  .string()
  .regex(/^[a-zA-Z\s\-']+$/, "Must only contain letters, spaces, hyphens, or apostrophes");

/** Time in HH:MM format (00:00–23:59). */
export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Must be in HH:MM format");

/** Australian Business Number (11 digits). */
export const abnSchema = z
  .string()
  .regex(/^\d{11}$/, "Must be an 11-digit ABN");
