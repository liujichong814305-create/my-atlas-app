
export type ModuleType = 'daily' | 'deep' | 'learning' | 'journal' | 'settings' | 'profile' | 'private';

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  image?: string; // Base64 string for user uploaded images
  isThinking?: boolean;
  isSaved?: boolean; // Indicates if the message has been explicitly saved to the Archive
  tags?: string[]; // Array of extracted tags (e.g. ['idea', 'journal'])
  attachment?: {
    type: 'letter' | 'summary';
    data: any; // The AtlasLetter object or the Summary string
    isOpened?: boolean;
  };
}

export interface DailyPlanItem {
  id: string;
  timeStart: string;
  timeEnd: string;
  activity: string;
  status: 'pending' | 'completed' | 'failed';
}

export interface LearningItem {
  id: string;
  topic: string;
  goal: string;
  progress: number;
  status: 'active' | 'review' | 'completed';
}

export interface DayLog {
  date: string; // ISO date string YYYY-MM-DD
  plans: DailyPlanItem[];
  chatSummary: string;
  mood: string;
}

export interface UserProfile {
  name: string;
  profession: string;
  details: string; // Interests, values, preferences
  avatarColor: string; 
  avatarImage?: string; // Base64 data URI for custom image
}

export interface AtlasLetter {
    id: string;
    date: string; // YYYY-MM-DD
    type: 'weekly' | 'monthly' | 'yearly';
    title: { en: string; zh: string };
    content: string;
    isRead: boolean;
}
