
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
  maps?: {
    uri?: string;
    title?: string;
    placeAnswerSources?: {
      reviewSnippets?: {
        content?: string;
      }[];
    };
  };
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  visits: number;
  avatarColor: string;
}

export interface Place {
  name: string;
  lat: number;
  lng: number;
  summary: string;
  difficulty: string;
  leaderboard?: LeaderboardEntry[];
}

export interface GeminiResponseData {
  text: string;
  places?: Place[];
  groundingChunks?: GroundingChunk[];
}

export enum LoadingState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface RunMetrics {
  distanceKm: number;
  elapsedTimeSeconds: number;
  currentPace: string;
  path: Coordinates[];
  isTracking: boolean;
}

export interface RunHistoryEntry {
  id: string;
  date: string;
  placeName: string;
  metrics: RunMetrics;
}