/**
 * Converts all Date fields in a type to string.
 * Use this instead of manual `Omit<T, 'createdAt'> & { createdAt: string }` patterns.
 *
 * tRPC without superjson serializes Dates as ISO strings. This type reflects
 * the actual shape received on the client.
 */
export type Serialized<T> = {
  [K in keyof T]: T[K] extends Date
    ? string
    : T[K] extends Date | null
      ? string | null
      : T[K] extends Date | undefined
        ? string | undefined
        : T[K];
};
