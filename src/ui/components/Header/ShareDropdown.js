import React, { useState } from "react";
import { connect } from "react-redux";
import { useAuth0 } from "@auth0/auth0-react";
import { selectors } from "ui/reducers";
import { actions } from "ui/actions";
import { gql, useQuery, useMutation } from "@apollo/client";
import Dropdown from "ui/components/shared/Dropdown";
import "./ShareDropdown.css";

const UPDATE_IS_PRIVATE = gql`
  mutation SetRecordingIsPrivate($recordingId: uuid!, $isPrivate: Boolean) {
    update_recordings(where: { id: { _eq: $recordingId } }, _set: { is_private: $isPrivate }) {
      returning {
        is_private
        id
      }
    }
  }
`;

const GET_RECORDING_PRIVACY = gql`
  query GetRecordingPrivacy($recordingId: uuid!) {
    recordings(where: { id: { _eq: $recordingId } }) {
      id
      is_private
    }
  }
`;

const GET_OWNER_AUTH_ID = gql`
  query GetOwnerAuthId($recordingId: uuid!) {
    recordings(where: { id: { _eq: $recordingId } }) {
      user {
        auth_id
      }
    }
  }
`;

function useIsOwner(recordingId) {
  const { user, isAuthenticated } = useAuth0();
  const { data, loading } = useQuery(GET_OWNER_AUTH_ID, {
    variables: { recordingId },
  });

  if (!isAuthenticated || loading) {
    return false;
  }

  const recording = data.recordings[0];
  if (!recording?.user) {
    return false;
  }

  return user.sub === recording.user?.auth_id;
}

function CopyUrl({ recordingId }) {
  const [copyClicked, setCopyClicked] = useState(false);

  const handleCopyClick = () => {
    navigator.clipboard.writeText(`https://replay.io/view?id=${recordingId}`);
    setCopyClicked(true);
    setTimeout(() => setCopyClicked(false), 2000);
  };

  if (copyClicked) {
    return (
      <div className="row link">
        <div className="status">
          <div className="success">Link copied</div>
        </div>
      </div>
    );
  }

  return (
    <div className="row link">
      <input
        type="text"
        value={`https://replay.io/view?id=${recordingId}`}
        onKeyPress={e => e.preventDefault()}
        onChange={e => e.preventDefault()}
      />
      <button onClick={handleCopyClick}>
        <div className="img link" />
        <div className="label">Copy Link</div>
      </button>
    </div>
  );
}

function Privacy({ isPrivate, toggleIsPrivate }) {
  return (
    <div className="row privacy" onClick={toggleIsPrivate}>
      <div className={`icon img ${isPrivate ? "locked" : "unlocked"}`} />
      {isPrivate ? (
        <div className="label">
          <div className="label-title">Private</div>
          <div className="label-description">Only you and your collaborators can view</div>
        </div>
      ) : (
        <div className="label">
          <div className="label-title">Public</div>
          <div className="label-description">Anyone with this link can view</div>
        </div>
      )}
      <button className={`toggle ${isPrivate ? "off" : "on"}`}>
        <div className="switch" />
      </button>
    </div>
  );
}

function Collaborators({ setExpanded, setModal }) {
  const { isAuthenticated } = useAuth0();

  const handleClick = () => {
    setModal("sharing");
    setExpanded(null);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="row collaborators">
      <div className="icon img users" />
      <div className="label">
        <div className="label-title">Invite collaborators</div>
        <div className="label-description">Collaborate privately with others</div>
      </div>
      <button className="open-modal" onClick={handleClick}>
        <div className="img invite" />
      </button>
    </div>
  );
}

function OwnerSettings({ recordingId, setModal, setExpanded }) {
  const { data } = useQuery(GET_RECORDING_PRIVACY, {
    variables: { recordingId },
  });

  const isPrivate = data.recordings[0]?.is_private;
  const [updateIsPrivate] = useMutation(UPDATE_IS_PRIVATE, {
    variables: { recordingId, isPrivate: !isPrivate },
    refetchQueries: ["GetRecordingPrivacy"],
  });

  return (
    <>
      <Privacy isPrivate={isPrivate} toggleIsPrivate={updateIsPrivate} />
    </>
  );
}

function ShareDropdown({ recordingId, setModal }) {
  const [expanded, setExpanded] = useState(false);
  const isOwner = useIsOwner(recordingId);
  const buttonContent = <div className="img share" />;

  return (
    <div className="share">
      <Dropdown
        buttonContent={buttonContent}
        buttonStyle="secondary"
        setExpanded={setExpanded}
        expanded={expanded}
      >
        <CopyUrl recordingId={recordingId} />
        {isOwner ? (
          <OwnerSettings recordingId={recordingId} setExpanded={setExpanded} setModal={setModal} />
        ) : null}
        <Collaborators recordingId={recordingId} setExpanded={setExpanded} setModal={setModal} />
      </Dropdown>
    </div>
  );
}

export default connect(
  state => ({
    recordingId: selectors.getRecordingId(state),
  }),
  {
    setModal: actions.setModal,
  }
)(ShareDropdown);
