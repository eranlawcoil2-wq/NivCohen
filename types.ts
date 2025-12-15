
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

export interface User {
  id: string;
  fullName: string;
  displayName?: string; // Nickname/Display name
  phone: string;
  email: string; // Now required for registration
  startDate: string;
  paymentStatus: PaymentStatus;
  isNew?: boolean; // Flag for self-registered users pending coach review
}

export interface TrainingSession {
  id: string;
  type: string; 
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  location: string;
  maxCapacity: number;
  description?: string;
  registeredPhoneNumbers: string[];
  color?: string; // Hex color code for the session theme
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
