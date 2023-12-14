import React from 'react';
import Chat, { Bubble, useMessages } from '@chatui/core';
import '@chatui/core/dist/index.css';

export default function ChatApp() {

    const {messages, appendMsg, setTyping} = useMessages([]);

    function handleSend(type, val) {
        if (type === 'text' && val.trim()) {
            appendMsg({
                type: 'text',
                content: {text: val},
                position: 'right',
            });

            setTyping(true);

            setTimeout(() => {
                appendMsg({
                    type: 'text',
                    content: {text: "Bla Bla"},
                });
            }, 1000);
        }
    }

    function renderMessageContent(msg) {
        const {content} = msg;
        return <Bubble content={content.text} />
    }
  return (
    <Chat
    navbar={{title: 'Asistant'}}
    messages={messages}
    renderMessageContent={renderMessageContent}
    onSend={handleSend}
    />
  )
}
