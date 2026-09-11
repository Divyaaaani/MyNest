import { useEffect, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { getChats, openChat, getChatMessages, sendChatMessage } from "../api";
import Reveal from "../components/Reveal";

function initials(name) {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function fmtTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Chats() {
  const token = localStorage.getItem("mynest_token");
  const me = (() => {
    try {
      return JSON.parse(localStorage.getItem("mynest_user") || "{}");
    } catch {
      return {};
    }
  })();

  const [searchParams, setSearchParams] = useSearchParams();
  const [convos, setConvos] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  if (!token) return <Navigate to="/auth" replace />;

  const withUser = searchParams.get("with");
  const openConvo = (convos || []).find((c) => c.id === openId);

  async function loadList() {
    try {
      const d = await getChats();
      setConvos(d.conversations);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadThread(id) {
    try {
      const d = await getChatMessages(id);
      setMsgs(d.messages);
    } catch (err) {
      setError(err.message);
    }
  }

  // Conversation list refreshes quietly in the background.
  useEffect(() => {
    loadList();
    const id = setInterval(loadList, 8000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opened from someone's profile card (?with=userId): find-or-create the
  // thread, select it, then drop the param so refreshes stay clean.
  useEffect(() => {
    if (!withUser) return;
    openChat(Number(withUser))
      .then((c) => {
        setOpenId(c.id);
        setSearchParams({}, { replace: true });
        loadList();
      })
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withUser]);

  // Open thread: load + poll for new messages while it stays open.
  useEffect(() => {
    if (!openId) return;
    setMsgs([]);
    loadThread(openId);
    const id = setInterval(() => loadThread(openId), 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  // Always show the newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  async function handleSend(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !openId) return;
    setDraft("");
    try {
      await sendChatMessage(openId, text);
      await loadThread(openId);
      loadList();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="container my-4">
      <Reveal>
        <h1 className="fn-title mb-1">Chats</h1>
        <p className="fn-section-sub mb-4">
          Personal 1-on-1 conversations — only you two can see them.
        </p>
      </Reveal>

      {error && (
        <div className="fn-alert fn-alert-error" role="alert">
          {error}
        </div>
      )}

      <div className="row g-4">
        {/* Conversation list */}
        <div className={`col-lg-4 ${openId ? "d-none d-lg-block" : ""}`}>
          <div className="card p-3">
            {convos === null ? (
              <div className="fn-skeleton" style={{ height: 120 }} />
            ) : convos.length === 0 ? (
              <div className="text-center text-muted p-4">
                <p className="fw-semibold mb-1">No chats yet</p>
                <p className="small mb-0">
                  Tap anyone's avatar on the Roommates page and hit Chat.
                </p>
              </div>
            ) : (
              convos.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`fn-chat-item ${c.id === openId ? "active" : ""}`}
                  onClick={() => setOpenId(c.id)}
                >
                  <span className="fn-avatar" aria-hidden="true">
                    {initials(c.partner_name)}
                  </span>
                  <span className="flex-grow-1 text-start min-w-0">
                    <span className="d-flex justify-content-between align-items-center gap-2">
                      <strong className="text-truncate">{c.partner_name}</strong>
                      <small className="text-muted flex-shrink-0">{fmtTime(c.last_at)}</small>
                    </span>
                    <span className="d-block text-muted small text-truncate">
                      {c.last_body || "Say hello!"}
                    </span>
                  </span>
                  {c.unread_count > 0 && (
                    <span className="fn-chat-unread" title="Unread messages">
                      {c.unread_count}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Open thread */}
        <div className={`col-lg-8 ${openId ? "" : "d-none d-lg-block"}`}>
          {openConvo ? (
            <div className="card p-3 p-md-4">
              <div className="d-flex align-items-center gap-2 mb-3">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary d-lg-none"
                  onClick={() => setOpenId(null)}
                >
                  ← Back
                </button>
                <span className="fn-avatar" aria-hidden="true">
                  {initials(openConvo.partner_name)}
                </span>
                <div>
                  <div className="fw-bold">{openConvo.partner_name}</div>
                  <div className="text-muted small">
                    {openConvo.partner_role === "owner" ? "PG Owner" : "Student"}
                  </div>
                </div>
              </div>

              <div className="fn-chat-thread">
                {msgs.length === 0 ? (
                  <p className="text-muted small text-center my-3">
                    No messages yet — say hello below.
                  </p>
                ) : (
                  msgs.map((m) => (
                    <div key={m.id} className={`fn-bubble ${m.mine ? "me" : "them"}`}>
                      {m.body}
                      <small>{fmtTime(m.created_at)}</small>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={handleSend} className="d-flex gap-2 mt-3">
                <input
                  className="form-control"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={`Message ${openConvo.partner_name.split(" ")[0]}...`}
                  maxLength={2000}
                />
                <button type="submit" className="btn btn-primary flex-shrink-0" disabled={!draft.trim()}>
                  Send
                </button>
              </form>
            </div>
          ) : (
            <div className="card p-5 text-center text-muted">
              <p className="fw-semibold mb-1">Pick a conversation</p>
              <p className="small mb-0">Your messages appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
