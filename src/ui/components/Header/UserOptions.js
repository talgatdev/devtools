import React, { useState } from "react";
import { connect } from "react-redux";
import * as actions from "ui/actions/app";
import * as selectors from "ui/reducers/app";
import hooks from "ui/hooks";
import LoginButton from "ui/components/LoginButton";
import Dropdown from "ui/components/shared/Dropdown";
import MaterialIcon from "ui/components/shared/MaterialIcon";
import { isDeployPreview } from "ui/utils/environment";
import useAuth0 from "ui/utils/useAuth0";
import "./UserOptions.css";

function UserOptions({ recordingId, setModal }) {
  const [expanded, setExpanded] = useState(false);
  const { isAuthenticated } = useAuth0();

  const isOwner = hooks.useIsOwner(recordingId || "00000000-0000-0000-0000-000000000000");
  const isCollaborator =
    isAuthenticated &&
    hooks.useIsCollaborator(recordingId || "00000000-0000-0000-0000-000000000000");
  const showShare = isOwner || isCollaborator;

  if (isDeployPreview()) {
    return null;
  }

  if (!isAuthenticated) {
    return <LoginButton />;
  }

  const onLibraryClick = () => {
    const dashboardUrl = `${window.location.origin}/view`;

    if (event.metaKey) {
      return window.open(dashboardUrl);
    }
    window.location = dashboardUrl;
  };
  const onDocsClick = () => {
    const docsUrl = `https://www.notion.so/Docs-56758667f53a4d51b7c6fc7a641adb02`;

    if (event.metaKey) {
      return window.open(docsUrl, "replaydocs");
    }
    window.open(docsUrl, "replaydocs");
  };
  const onLaunchClick = () => {
    const launchUrl = `${window.location.origin}/welcome`;
    if (event.metaKey) {
      return window.open(launchUrl);
    }
    // right now we just send you to the download screen, but eventually this will launch Replay
    window.location = launchUrl;
  };
  const onShareClick = () => {
    setExpanded(false);
    setModal("sharing", { recordingId });
  };
  const onSettingsClick = () => {
    setExpanded(false);
    setModal("settings");
  };

  return (
    <div className="user-options text-blue-400">
      <Dropdown
        buttonContent={<MaterialIcon className="more">more_horiz</MaterialIcon>}
        setExpanded={setExpanded}
        expanded={expanded}
        orientation="bottom"
      >
        <button className="row" onClick={onDocsClick}>
          <MaterialIcon>menu_book</MaterialIcon>
          <span>Docs</span>
        </button>
        <button className="row" onClick={onSettingsClick}>
          <MaterialIcon>settings</MaterialIcon>
          <span>Settings</span>
        </button>
        <button className="row" onClick={onLaunchClick}>
          <MaterialIcon>download</MaterialIcon>
          <span>Download Replay</span>
        </button>
        <LoginButton />
      </Dropdown>
    </div>
  );
}

export default connect(state => ({ recordingId: selectors.getRecordingId(state) }), {
  setModal: actions.setModal,
})(UserOptions);
