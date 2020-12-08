import { RecordingId, sessionError, SessionId, PointDescription } from "record-replay-protocol";

export type PanelName = "console" | "debugger" | "inspector";
export type PrimaryPanelName = "explorer" | "debug";
export type ViewMode = "dev" | "non-dev";

export interface Modal {
  type: string;
  recordingId: RecordingId;
  opaque: boolean;
}

export interface ExpectedError {
  message: string;
  action?: string;
}

export interface UploadInfo {
  amount: string;
  total?: string;
}

export interface AppState {
  recordingId: RecordingId | null;
  sessionId: SessionId | null;
  theme: string;
  splitConsoleOpen: boolean;
  loading: number;
  uploading: UploadInfo | null;
  expectedError: ExpectedError | null;
  unexpectedError: sessionError | null;
  modal: Modal | null;
  selectedPanel: PanelName;
  selectedPrimaryPanel: PrimaryPanelName;
  initializedPanels: PanelName[];
  pendingNotification: any;
  analysisPoints: AnalysisPoints;
  viewMode: ViewMode;
  narrowMode: boolean;
}

export interface AnalysisPoints {
  [key: string]: PointDescription;
}
