export interface AddressData {
  address: string;
  suburb: string;
  state: "NSW" | "VIC" | "QLD" | "SA" | "WA" | "TAS" | "NT" | "ACT";
  postcode: string;
}

// Realistic Australian addresses for demo mode
export const demoAddresses: AddressData[] = [
  {
    address: "42 Oxford Street",
    suburb: "Paddington",
    state: "NSW",
    postcode: "2021",
  },
  {
    address: "15 Beach Road",
    suburb: "Brighton",
    state: "VIC",
    postcode: "3186",
  },
  {
    address: "8 James Street",
    suburb: "Fortitude Valley",
    state: "QLD",
    postcode: "4006",
  },
  {
    address: "23 King Street",
    suburb: "Newtown",
    state: "NSW",
    postcode: "2042",
  },
];

// Obviously fake addresses for dev mode
export const devAddresses: AddressData[] = [
  {
    address: "123 Test Street",
    suburb: "Testville",
    state: "NSW",
    postcode: "2000",
  },
  {
    address: "456 Dev Avenue",
    suburb: "Mocktown",
    state: "VIC",
    postcode: "3000",
  },
];
