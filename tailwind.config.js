module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      screens: {
        short: { raw: "(max-height: 615px)" },
      },
      colors: {
        lightGrey: "var(--light-grey)",
        primaryAccent: "var(--primary-accent)",
        primaryAccentText: "var(--primary-accent-text)",
        primaryAccentHover: "var(--primary-accent-hover)",
        primaryAccentLegacyHover: "var(--primary-accent-legacy-hover)",
        primaryAccentLegacy: "var(--primary-accent-legacy)",
        secondaryAccent: "var(--secondary-accent)",
        secondaryAccentHover: "var(--secondary-accent-hover)",
        textFieldBorder: "var(--text-field-border)",
        toolbarBackground: "var(--theme-toolbar-background)",
        toolbarBackgroundAlt: "var(--theme-toolbar-background-alt)",
        bodyColor: "var(--theme-body-color)",
        jellyfish: "var(--jellyfish)",
        splitter: "var(--theme-splitter-color)",
        chrome: "var(--chrome)",
        menuBgcolor: "var(--menu-bgcolor)",
        menuColor: "var(--menu-color)",
        menuHoverBgcolor: "var(--menu-hover-bgcolor)",
        menuHoverColor: "var(--menu-hover-color)",
        themeToolbarPanelIconColor: "var(--theme-toolbar-panel-icon-color)",
        themeBodyBackground: "var(--theme-body-background)",
        themeMenuHighlight: "var(--theme-menu-highlight)",
        themeTabBackground: "var(--theme-tab-background)",
        themeTabBackgroundAltSubtle: "var(--theme-tab-background-alt-subtle)",
        iconColor: "var(--icon-color)",
        iconColorDisabled: "var(--theme-text-field)",
        themeBorder: "var(--theme-border)",
        themeTextField: "var(--theme-text-field)",
        themeTextFieldColor: "var(--theme-text-field-color)",
        themeFocuser: "var(--theme-focuser)",
        breakpointEditfieldHover: "var(--breakpoint-editfield-hover)",
        breakpointEditfieldActive: "var(--breakpoint-editfield-active)",
        breakpointTip: "var(--breakpoint-tip)",
        breakpointStatusBG: "var(--breakpoint-status-bg)",
        breakpointStatus: "var(--breakpoint-status)",
        checkbox: "var(--checkbox)",
        checkboxBorder: "var(--checkbox-border)",
        themeToggle: "var(--theme-toggle)",
        bigOverlayBgcolor: "var(--big-overlay-bgcolor)",
      },
      lineHeight: {
        "comment-text": "1.125rem",
        2: "10px",
      },
      cursor: {
        "ew-resize": "ew-resize",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
