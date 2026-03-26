export interface PlantCare {
  watering: string;
  sunlight: string;
  soil: string;
  fertilizer: string;
}

export interface DiseaseInfo {
  detected: boolean;
  name?: string;
  symptoms?: string;
  symptomsList?: string[];
  treatment?: string;
  treatmentSteps?: string[];
  prevention?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  imageUrl?: string;
  timestamp: number;
}

export interface PlantScan {
  id: string;
  userId: string;
  imageUrl: string;
  plantName: string;
  scientificName: string;
  confidence: number;
  healthStatus: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  care: PlantCare;
  disease: DiseaseInfo;
  timestamp: number;
  chatHistory?: ChatMessage[];
}

export interface AIResponse {
  plantName: string;
  scientificName: string;
  confidence: number;
  healthStatus: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  care: PlantCare;
  disease: DiseaseInfo;
}

export interface Reminder {
  id: string;
  userId: string;
  plantId: string;
  plantName: string;
  task: string;
  frequency: 'Daily' | 'Weekly' | 'Bi-weekly' | 'Monthly';
  time: string; // HH:mm format
  lastCompleted?: number;
  nextDue: number;
  active: boolean;
}
