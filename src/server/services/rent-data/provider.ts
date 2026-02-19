export interface RentDataProvider {
  getMedianRent(
    suburb: string,
    state: string,
    propertyType?: string
  ): Promise<number | null>;
  readonly source: string;
}
