import { connect } from "react-redux";
import { actions } from "ui/actions";
import SmartTrace from "devtools/client/shared/components/SmartTrace";

export default connect(null, {
  onViewSourceInDebugger: actions.onViewSourceInDebugger,
  // @ts-expect-error some nested field mismatch
})(SmartTrace);
