import { RecordingId, sessionError, SessionId, PointDescription } from "record-replay-protocol";

export type PanelName = "console" | "debugger" | "inspector";
export type PrimaryPanelName = "explorer" | "debug";

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
  toolboxExpanded: boolean;
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
}

export interface AnalysisPoints {
  [key: string]: PointDescription;
}
