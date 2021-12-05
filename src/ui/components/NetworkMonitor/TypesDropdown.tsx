import React, { useState } from "react";

import PortalDropdown from "ui/components/shared/PortalDropdown";
import { Dropdown, DropdownItem, DropdownItemContent } from "ui/components/Library/LibraryDropdown";
import MaterialIcon from "ui/components/shared/MaterialIcon";
import { RequestType, REQUEST_TYPES } from "./utils";

export default function TypesDropdown({
  types,
  toggleType,
}: {
  types: Set<RequestType>;
  toggleType: (type: RequestType) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const button = (
    <MaterialIcon className="mr-2" iconSize="lg" outlined={true}>
      filter_alt
    </MaterialIcon>
  );

  const TypeItem = ({ type, label }: { type: RequestType; label: string }) => (
    <DropdownItem onClick={() => toggleType(type)}>
      <DropdownItemContent selected={types.has(type)} icon="bug_report">
        {label}
      </DropdownItemContent>
    </DropdownItem>
  );

  return (
    <PortalDropdown
      buttonContent={button}
      setExpanded={setExpanded}
      expanded={expanded}
      buttonStyle={`${types.size > 0 ? "text-primaryAccent" : "text-gray-400"}`}
      distance={0}
      position="bottom-right"
    >
      <Dropdown>
        {Object.entries(REQUEST_TYPES).map((pair: string[]) => (
          <TypeItem type={pair[0] as RequestType} label={pair[1]} />
        ))}
      </Dropdown>
    </PortalDropdown>
  );
}
