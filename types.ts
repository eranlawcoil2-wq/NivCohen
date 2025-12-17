
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
  color?: string; // Helper color for UI distinction
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
  monthlyRecord?: number; // Personal best: max workouts in a month
  isRestricted?: boolean; // If true, user cannot register for workouts
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
  attendedPhoneNumbers?: string[]; // List of users who actually attended (Checked by coach)
  color?: string; // Hex color code for the session theme
  isTrial?: boolean; // Is this a trial session for new users?
  zoomLink?: string; // Optional link for Zoom sessions
  isZoomSession?: boolean; // Flag to mark as Zoom even without link
  isHidden?: boolean; // If true, only visible to admin
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

export interface AppConfig {
  coachNameHeb: string;
  coachNameEng: string;
  coachPhone: string;
  coachEmail: string;
  defaultCity: string;
}