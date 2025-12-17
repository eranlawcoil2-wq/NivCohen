
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

export interface Quote {
  id: string;
  text: string;
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
  healthDeclarationFile?: string; // Base64 string or URL of the uploaded file
  healthDeclarationDate?: string; // ISO Date string of when they signed
  healthDeclarationId?: string; // ID number provided during signature
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
  waitingList?: string[]; // New: List of phone numbers waiting for a spot
  attendedPhoneNumbers?: string[]; // List of users who actually attended (Checked by coach)
  color?: string; // Hex color code for the session theme
  isTrial?: boolean; // Is this a trial session for new users?
  zoomLink?: string; // Optional link for Zoom sessions
  isZoomSession?: boolean; // Flag to mark as Zoom even without link
  isHybrid?: boolean; // New flag: Both In-Person and Zoom
  isHidden?: boolean; // If true, only visible to admin
  isCancelled?: boolean; // New flag for cancelled sessions
  manualHasStarted?: boolean; // New flag: Coach manually marked session as started/happening
}

export interface WeatherLocation {
  name: string;
  lat: number;
  lon: number;
}

export interface WeatherInfo {
  maxTemp: number;
  weatherCode: number;
  hourly?: Record<string, { temp: number; weatherCode: number }>; // Key is "HH" (00-23)
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
  coachAdditionalPhone?: string; // New field for additional number/password
  coachEmail: string;
  defaultCity: string;
  urgentMessage?: string; // New field for urgent announcements
}