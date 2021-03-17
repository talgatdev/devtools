import React from "react";
import { SettingItem, Setting, UserSettings } from "./types";
import useToken from "ui/utils/useToken";
import hooks from "ui/hooks";
import "./SettingsBody.css";

interface SettingsBodyItemProps {
  item: SettingItem;
  userSettings: UserSettings;
}

interface SettingsBodyProps {
  selectedSetting: Setting;
  userSettings: UserSettings;
}

function SettingsBodyItem({ item, userSettings }: SettingsBodyItemProps) {
  const { claims } = useToken();
  const userId = claims?.hasura.userId;

  const { label, key, description } = item;
  const value = userSettings[key];

  const updateUserSetting = hooks.useUpdateUserSetting(key);
  const toggleSetting = () => {
    updateUserSetting({
      variables: {
        newValue: !value,
        userId,
      },
    });
  };

  return (
    <li>
      <label className="setting-item" htmlFor={key}>
        <div className="label">{label}</div>
        {description && <div className="description">{description}</div>}
      </label>
      <input type="checkbox" id={key} checked={value} onChange={toggleSetting} />
    </li>
  );
}

function Support() {
  return (
    <li>
      <label className="setting-item">
        <div className="label">Join us on Discord</div>
        <div className="description">
          Come chat with us on our{" "}
          <a href="https://discord.gg/n2dTK6kcRX" target="_blank" rel="noreferrer">
            Discord server
          </a>
          . We’d love to hear your feedback!
        </div>
      </label>
    </li>
  );
}

export default function SettingsBody({ selectedSetting, userSettings }: SettingsBodyProps) {
  const { title, items } = selectedSetting;

  if (title == "Support") {
    return (
      <main>
        <h1>{title}</h1>
        <Support />
      </main>
    );
  }

  return (
    <main>
      <h1>{title}</h1>
      <ul>
        {items.map((item, index) => (
          <SettingsBodyItem {...{ item, userSettings }} key={index} />
        ))}
      </ul>
    </main>
  );
}
