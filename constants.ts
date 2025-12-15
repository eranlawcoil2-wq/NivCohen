
import { User, TrainingSession, PaymentStatus, WorkoutType } from './types';

export const COACH_PHONE_NUMBER = '972500000000'; // החלף במספר שלך

export const INITIAL_USERS: User[] = [
  {
    id: '1',
    fullName: 'ישראל ישראלי',
    phone: '0501234567',
    email: 'israel@example.com',
    startDate: '2023-01-01',
    paymentStatus: PaymentStatus.PAID
  },
  {
    id: '2',
    fullName: 'דנה כהן',
    phone: '0547654321',
    email: 'dana@example.com',
    startDate: '2023-03-15',
    paymentStatus: PaymentStatus.PENDING
  },
  {
    id: '3',
    fullName: 'רוני לוי',
    phone: '0529998888',
    email: 'roni@example.com',
    startDate: '2023-06-10',
    paymentStatus: PaymentStatus.OVERDUE
  },
  {
    id: '4',
    fullName: 'עמית שחר',
    phone: '0500000001',
    email: 'amit@example.com',
    startDate: '2023-08-01',
    paymentStatus: PaymentStatus.PAID
  },
  {
    id: '5',
    fullName: 'נועה ברק',
    phone: '0500000002',
    email: 'noa@example.com',
    startDate: '2023-08-05',
    paymentStatus: PaymentStatus.PAID
  },
  {
    id: '6',
    fullName: 'גיא אלון',
    phone: '0500000003',
    email: 'guy@example.com',
    startDate: '2023-09-01',
    paymentStatus: PaymentStatus.PAID
  },
  {
    id: '7',
    fullName: 'שירה גולן',
    phone: '0500000004',
    email: 'shira@example.com',
    startDate: '2023-09-10',
    paymentStatus: PaymentStatus.PAID
  },
  {
    id: '8',
    fullName: 'איתי כץ',
    phone: '0500000005',
    email: 'itay@example.com',
    startDate: '2023-10-01',
    paymentStatus: PaymentStatus.PAID
  }
];

// Helper to get next few days
const getNextDate = (daysToAdd: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysToAdd);
  return date.toISOString().split('T')[0];
};

const DEMO_ATTENDEES = ['0501234567', '0547654321', '0529998888', '0500000001', '0500000002'];

export const INITIAL_SESSIONS: TrainingSession[] = [
  {
    id: 's1',
    type: WorkoutType.FUNCTIONAL,
    date: getNextDate(0), // Today
    time: '18:00',
    location: 'פארק הירקון, תל אביב',
    maxCapacity: 15,
    description: 'אימון בדופק גבוה המשלב כוח וסיבולת.',
    registeredPhoneNumbers: [...DEMO_ATTENDEES],
    isTrial: false
  },
  {
    id: 's2',
    type: WorkoutType.STRENGTH,
    date: getNextDate(1), // Tomorrow
    time: '07:00',
    location: 'סטודיו פיטנס, רמת גן',
    maxCapacity: 10,
    description: 'עבודה על כוח מתפרץ ומשקולות.',
    registeredPhoneNumbers: [...DEMO_ATTENDEES],
    isTrial: false
  },
  {
    id: 's3',
    type: WorkoutType.HIIT,
    date: getNextDate(2),
    time: '19:30',
    location: 'חוף הים, הרצליה',
    maxCapacity: 20,
    description: 'אימון אינטרוולים עצים בחול.',
    registeredPhoneNumbers: ['0501234567', '0547654321', '0529998888', '0500000001', '0500000002'],
    isTrial: true
  },
  {
    id: 's4',
    type: WorkoutType.PILATES,
    date: getNextDate(3),
    time: '08:00',
    location: 'סטודיו פיטנס, רמת גן',
    maxCapacity: 8,
    description: 'חיזוק שרירי ליבה וגמישות.',
    registeredPhoneNumbers: ['0501234567', '0547654321', '0529998888', '0500000001', '0500000002'],
    isTrial: false
  }
];