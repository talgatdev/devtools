import React, { useState } from "react";
import hooks from "ui/hooks";
import { WorkspaceUser } from "ui/types";
import PortalDropdown from "ui/components/shared/PortalDropdown";
import useToken from "ui/utils/useToken";
import { connect, ConnectedProps } from "react-redux";
import { selectors } from "ui/reducers";
import { actions } from "ui/actions";
import { UIState } from "ui/state";
import { NonRegisteredTeamMember } from "ui/hooks/invitations";

import "./WorkspaceMember.css";

type WorkspaceMemberProps = { member: WorkspaceUser } & PropsFromRedux;

export function NonRegisteredWorkspaceMember({ member }: { member: NonRegisteredTeamMember }) {
  return (
    <li className="workspace-member">
      <span className="material-icons">mail_outline</span>
      <div className="workspace-member-content">
        <div className="title">{member.invited_email}</div>
      </div>
      <div className="permission-container">
        <span>Pending</span>
      </div>
    </li>
  );
}

function Role({
  member,
  setWorkspaceId,
  workspaceId,
  hideModal,
}: {
  member: WorkspaceUser;
  setWorkspaceId: any;
  workspaceId: string;
  hideModal: any;
}) {
  const [expanded, setExpanded] = useState(false);
  const deleteUserFromWorkspace = hooks.useDeleteUserFromWorkspace();
  const { claims } = useToken();
  const localUserId = claims?.hasura.userId;
  const { user_id: userId } = member;

  const handleDelete = () => {
    setExpanded(false);

    const leaveMsg = `Are you sure you want to leave this team?`;
    const kickMsg = `Are you sure you want to remove ${member.user.name} from this team?`;
    const isPersonal = localUserId == userId;
    const message = isPersonal ? leaveMsg : kickMsg;

    if (window.confirm(message)) {
      deleteUserFromWorkspace({
        variables: { userId, workspaceId },
      });

      // If the user is the member leaving, hide the modal and go back
      // to the personal workspace.
      if (isPersonal) {
        hideModal();
        setWorkspaceId(null);
      }
    }
  };

  let content = (
    <PortalDropdown
      buttonContent={
        <div className="permission-container">
          <span className="material-icons">expand_more</span>
          <span>Admin</span>
        </div>
      }
      setExpanded={setExpanded}
      expanded={expanded}
      buttonStyle=""
      position="bottom-right"
    >
      <div className="permissions-dropdown-item" onClick={handleDelete}>
        {localUserId == userId ? "Leave" : "Remove"}
      </div>
    </PortalDropdown>
  );

  if (member.pending) {
    content = (
      <PortalDropdown
        buttonContent={
          <div className="permission-container">
            <span className="material-icons">expand_more</span>
            <span>Pending</span>
          </div>
        }
        setExpanded={setExpanded}
        expanded={expanded}
        buttonStyle=""
        position="bottom-right"
      >
        <div className="permissions-dropdown-item" onClick={handleDelete}>
          Cancel
        </div>
      </PortalDropdown>
    );
  }

  return <div className="member-permissions">{content}</div>;
}

function WorkspaceMember({ member, setWorkspaceId, hideModal, workspaceId }: WorkspaceMemberProps) {
  return (
    <li className="workspace-member">
      <img src={member.user.picture} />
      <div className="workspace-member-content">
        <div className="title">{member.user.name}</div>
        <div className="subtitle">{member.user.email}</div>
      </div>
      <Role
        member={member}
        setWorkspaceId={setWorkspaceId}
        workspaceId={workspaceId!}
        hideModal={hideModal}
      />
    </li>
  );
}

const connector = connect((state: UIState) => ({ workspaceId: selectors.getWorkspaceId(state) }), {
  setWorkspaceId: actions.setWorkspaceId,
  hideModal: actions.hideModal,
});
export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(WorkspaceMember);
