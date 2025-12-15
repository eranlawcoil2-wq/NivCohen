
export enum PaymentStatus {
  PAID = 'PAID',
  PENDING = 'PENDING',
  OVERDUE = 'OVERDUE'
}

export enum WorkoutType {
  FUNCTIONAL = 'פונקציונלי',
  HIIT = 'HIIT',
  STRENGTH = 'כוח',
  PILATES = 'פילאטיס',
  RUNNING = 'ריצה',
  HYBRID = 'היברידי'
}

export interface LocationDef {
  id: string;
  name: string; // The display name (e.g., "Park Hayarkon")
  address: string; // The physical address for Waze
}

export interface User {
  id: string;
  fullName: string;
  displayName?: string; // Nickname/Display name
  phone: string;
  email: string; // Now required for registration
  startDate: string;
  paymentStatus: PaymentStatus;
  isNew?: boolean; // Flag for self-registered users pending coach review
  userColor?: string; // Custom color for the user name in lists
}

export interface TrainingSession {
  id: string;
  type: string; 
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  location: string; // Stores the Location Name
  maxCapacity: number;
  description?: string;
  registeredPhoneNumbers: string[];
  color?: string; // Hex color code for the session theme
  isTrial?: boolean; // Is this a trial session for new users?
  zoomLink?: string; // Optional link for Zoom sessions
}

export interface WeatherLocation {
  name: string;
  lat: number;
  lon: number;
}

export interface PaymentLink {
  id: string;
  title: string;
  url: string;
}