// bovenin
import React, { forwardRef, useImperativeHandle } from "react";

export type CoachChatHandle = {
  sendMessage: (text: string) => void;
};

type CoachChatProps = {
  // ... jouw bestaande props
  hideComposer?: boolean; // ✅ nieuw
};

// vervang de export default
const CoachChat = forwardRef<CoachChatHandle, CoachChatProps>(function CoachChat(props, ref) {
  // ... bestaand component
  // stel hier jouw eigen interne 'enqueue/send' functie in:
  function internalSend(text: string) {
    // TODO: gebruik jouw bestaande logic om een user-bericht te sturen
    // bv. addMessage({ role: "user", content: text }); call backend, etc.
  }

  useImperativeHandle(ref, () => ({
    sendMessage: (text: string) => internalSend(text),
  }));

  return (
    <div>
      {/* ... chat messages ... */}

      {/* composer alleen tonen als NIET verborgen */}
      {!props.hideComposer ? (
        <div>{/* jouw bestaande composer + hint */}</div>
      ) : null}
    </div>
  );
});

export default CoachChat;
