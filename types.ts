
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
  name: string;
  address: string;
  color?: string;
}

export interface User {
  id: string;
  fullName: string;
  displayName?: string;
  phone: string;
  email: string;
  startDate: string;
  paymentStatus: PaymentStatus;
  isNew?: boolean;
  userColor?: string;
  monthlyRecord?: number;
  isRestricted?: boolean;
  healthDeclarationFile?: string;
  healthDeclarationDate?: string;
  healthDeclarationId?: string;
}

export interface TrainingSession {
  id: string;
  type: string; 
  date: string;
  time: string;
  location: string;
  maxCapacity: number;
  description?: string;
  registeredPhoneNumbers: string[];
  waitingList?: string[];
  attendedPhoneNumbers?: string[];
  color?: string;
  isTrial?: boolean;
  zoomLink?: string;
  isZoomSession?: boolean;
  isHidden?: boolean;
  isCancelled?: boolean;
  manualHasStarted?: boolean;
  isPersonalTraining?: boolean;
}

export interface WeatherLocation {
  name: string;
  lat: number;
  lon: number;
}

export interface WeatherInfo {
  maxTemp: number;
  weatherCode: number;
  hourly?: Record<string, { temp: number; weatherCode: number }>;
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
  coachAdditionalPhone?: string;
  coachEmail: string;
  defaultCity: string;
  urgentMessage?: string;
  coachBio?: string;
  healthDeclarationTemplate?: string;
  healthDeclarationDownloadUrl?: string; 
}
