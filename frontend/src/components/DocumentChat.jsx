import React from "react";
import { ChevronDown, MessageCircle, Reply, Send, X } from "lucide-react";

import { getDocumentMessages, sendDocumentMessage } from "../services/documentMessageService";

export function DocumentChat({ documentId, variant = "compact" }) {
  const [open, setOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const [messages, setMessages] = React.useState([]);
  const [draft, setDraft] = React.useState("");
  const [replyTo, setReplyTo] = React.useState(null);
  const [dragging, setDragging] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState("");
  const listRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const pointerRef = React.useRef(null);
  const activeDocumentIdRef = React.useRef(documentId);
  activeDocumentIdRef.current = documentId;

  const loadMessages = React.useCallback(async ({ quiet = false } = {}) => {
    if (!documentId) return;
    if (!quiet) setLoading(true);
    try {
      const response = await getDocumentMessages(documentId);
      if (activeDocumentIdRef.current !== documentId) return;
      setMessages(response.messages ?? response.data ?? []);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [documentId]);

  React.useEffect(() => {
    setMessages([]);
    setDraft("");
    setReplyTo(null);
    setError("");
  }, [documentId]);

  React.useEffect(() => {
    if (!open || collapsed) return undefined;
    loadMessages();
    const timer = window.setInterval(() => loadMessages({ quiet: true }), 10000);
    return () => window.clearInterval(timer);
  }, [open, collapsed, loadMessages]);

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function submit(event) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await sendDocumentMessage(documentId, message, replyTo?.id);
      setMessages((current) => [...current, response.document_message ?? response.data]);
      setDraft("");
      setReplyTo(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  }

  function handleComposerKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function selectReply(message) {
    setReplyTo(message);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  function startDrag(event, message) {
    if (event.target.closest("button, textarea, input, a")) {
      return;
    }
    pointerRef.current = { 
      id: event.pointerId,
      message,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
}



  function moveDrag(event) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    const horizontal = event.clientX - pointer.startX;
    const vertical = event.clientY - pointer.startY;
    if (Math.abs(horizontal) > Math.abs(vertical)) {
      setDragging({ id: pointer.message.id, offset: Math.max(-72, Math.min(72, horizontal)) });
    }
  }

  function endDrag(event) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    const horizontal = event.clientX - pointer.startX;
    const vertical = event.clientY - pointer.startY;
    if (Math.abs(horizontal) >= 48 && Math.abs(horizontal) > Math.abs(vertical)) selectReply(pointer.message);
    pointerRef.current = null;
    setDragging(null);
  }

  if (!open) return <button type="button" className="document-chat-button" onClick={() => setOpen(true)} aria-label="Open document chat"><MessageCircle size={22} /> <span>Chat</span></button>;

  return (
    <aside className={`document-chat-panel document-chat-panel--${variant}${collapsed ? " document-chat-panel--collapsed" : ""}`} aria-label="Document chat">
      <header>
        <div><MessageCircle size={19} /><strong>Document Chat</strong></div>
        <div>
          <button type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand chat" : "Collapse chat"}><ChevronDown size={18} /></button>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close chat"><X size={18} /></button>
        </div>
      </header>
      {!collapsed && <>
        <div className="document-chat-messages" ref={listRef} aria-live="polite">
          {loading && <p>Loading messages...</p>}
          {!loading && messages.length === 0 && <p className="document-chat-empty">No messages yet. Start the document conversation.</p>}
          {messages.map((item) => <article
            className={`document-chat-message ${item.is_mine ? "document-chat-message--sent" : "document-chat-message--received"}`} key={item.id}
            onPointerDown={(event) => startDrag(event, item)} onPointerMove={moveDrag} onPointerUp={endDrag}
            onPointerCancel={() => { pointerRef.current = null; setDragging(null); }}
            style={dragging?.id === item.id ? { transform: `translateX(${dragging.offset}px)` } : undefined}
          >
            <div className="document-chat-message__header"><strong>{item.sender || "CONEXIA user"}</strong><span>{formatRole(item.role)}</span></div>
            {item.reply_to && <QuotedMessage message={item.reply_to} />}
            <p>{item.message}</p>
            <footer>
              <small>{item.timestamp ? new Date(item.timestamp).toLocaleString() : ""}{item.is_read ? " · Read" : ""}</small>
              <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setReplyTo(item); }} aria-label={`Reply to ${item.sender || "message sender"}`}><Reply size={14} /> Reply</button>
            </footer>
          </article>)}
        </div>
        {error && <p className="document-chat-error" role="alert">{error}</p>}
        <form onSubmit={submit}>
          {replyTo && <div className="document-chat-reply-preview"><QuotedMessage message={replyTo} /><button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply"><X size={16} /></button></div>}
          <div className="document-chat-compose-row">
            <textarea ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder="Type a message..." maxLength={2000} rows={2} aria-label="Document chat message" />
            <button type="submit" disabled={sending || !draft.trim()} aria-label="Send message"><Send size={18} /></button>
          </div>
        </form>
      </>}
    </aside>
  );
}

function QuotedMessage({ message }) {
  return <blockquote className="document-chat-quote"><strong>{message.sender || "CONEXIA user"}</strong><span>{message.message}</span></blockquote>;
}

function formatRole(role = "") {
  return role.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
