import type { RentDataProvider } from "./provider";

export class ManualProvider implements RentDataProvider {
  readonly source = "manual";

  async getMedianRent(): Promise<number | null> {
    // Manual provider always returns null — user enters market rent themselves
    return null;
  }
}
