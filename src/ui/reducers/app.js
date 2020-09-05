import { prefs } from "../utils/prefs";

function initialAppState() {
  return {
    theme: "theme-light",
    splitConsoleOpen: prefs.splitConsole,
    selectedPanel: prefs.selectedPanel,
    tooltip: null,
    loading: 4,
  };
}

export default function update(state = initialAppState(), action) {
  switch (action.type) {
    case "update_theme": {
      return { ...state, theme: action.theme };
    }

    case "set_selected_panel": {
      return { ...state, selectedPanel: action.panel };
    }

    case "set_split_console": {
      return { ...state, splitConsoleOpen: action.splitConsole };
    }

    case "loading": {
      return { ...state, loading: action.loading };
    }

    default: {
      return state;
    }
  }
}

export function getTheme(state) {
  return state.app.theme;
}

export function isSplitConsoleOpen(state) {
  return state.app.splitConsoleOpen;
}

export function getSelectedPanel(state) {
  return state.app.selectedPanel;
}

export const getLoading = state => state.app.loading;
