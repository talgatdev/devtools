import { AppState } from "ui/state/app";
import { AppAction } from "ui/actions/app";
import { UIState } from "ui/state";
const { prefs } = require("../utils/prefs");

function initialAppState(): AppState {
  return {
    recordingId: null,
    expectedError: null,
    unexpectedError: null,
    theme: "theme-light",
    // Whether or not the developer tools toolbox is opened.
    isToolboxOpen: prefs.isToolboxOpen,
    splitConsoleOpen: prefs.splitConsole,
    selectedPanel: prefs.selectedPanel,
    loading: 4,
    uploading: null,
    sessionId: null,
    modal: null,
  };
}

export default function update(state = initialAppState(), action: AppAction) {
  switch (action.type) {
    case "setup_app": {
      return { ...state, recordingId: action.recordingId };
    }

    case "set_uploading": {
      return { ...state, uploading: action.uploading };
    }

    case "set_expected_error": {
      return { ...state, expectedError: action.error };
    }

    case "set_unexpected_error": {
      return { ...state, unexpectedError: action.error };
    }

    case "update_theme": {
      return { ...state, theme: action.theme };
    }

    case "set_selected_panel": {
      return { ...state, selectedPanel: action.panel };
    }

    case "set_split_console": {
      return { ...state, splitConsoleOpen: action.splitConsole };
    }

    case "set_toolbox_open": {
      return { ...state, isToolboxOpen: action.isToolboxOpen };
    }

    case "loading": {
      return { ...state, loading: action.loading };
    }

    case "set_session_id": {
      return { ...state, sessionId: action.sessionId };
    }

    case "set_modal": {
      return { ...state, modal: action.modal };
    }

    default: {
      return state;
    }
  }
}

export const getTheme = (state: UIState) => state.app.theme;
export const isSplitConsoleOpen = (state: UIState) => state.app.splitConsoleOpen;
export const isToolboxOpen = (state: UIState) => state.app.isToolboxOpen;
export const getSelectedPanel = (state: UIState) => state.app.selectedPanel;
export const getLoading = (state: UIState) => state.app.loading;
export const getUploading = (state: UIState) => state.app.uploading;
export const getRecordingId = (state: UIState) => state.app.recordingId;
export const getSessionId = (state: UIState) => state.app.sessionId;
export const getExpectedError = (state: UIState) => state.app.expectedError;
export const getUnexpectedError = (state: UIState) => state.app.unexpectedError;
export const getModal = (state: UIState) => state.app.modal;
