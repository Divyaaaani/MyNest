import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getMyGroups, getGroup, getMyDues, markPaid, getGroupJoinRequests, decideJoinRequest, getNotifications, getMyRentRequests } from "../api";
import Reveal from "../components/Reveal";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function Dashboard() {
  const token = localStorage.getItem("fairnest_token");
  const me = JSON.parse(localStorage.getItem("fairnest_user") || "{}");
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState(null);
  const [data, setData] = useState(null);
  const [dues, setDues] = useState(null);
  const [requests, setRequests] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [paying, setPaying] = useState(null);      // the due being paid
  const [payStage, setPayStage] = useState(null);  // "confirm" | "processing" | "done"
  const [accepting, setAccepting] = useState(null); // join request being accepted
  const [acceptDue, setAcceptDue] = useState("");
  const [notifs, setNotifs] = useState(null);
  const [apps, setApps] = useState([]);

  if (!token) return <Navigate to="/auth" replace />;

  useEffect(() => {
    getMyGroups()
      .then((res) => {
        setGroups(res.groups);
        if (res.groups.length > 0) setSelected(res.groups[0].id);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    getGroup(selected)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [selected]);

  // Only the owner of the selected group sees pending join requests.
  useEffect(() => {
    if (!selected || !data) {
      setRequests(null);
      return;
    }
    if (data.group.ownerId === me.id) {
      getGroupJoinRequests(selected)
        .then((res) => setRequests(res.requests))
        .catch(() => setRequests([]));
    } else {
      setRequests(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, data]);

  useEffect(() => {
    getMyDues()
      .then(setDues)
      .catch(() => {});
  }, [payStage === "done"]);

  useEffect(() => {
    getNotifications()
      .then(setNotifs)
      .catch(() => {});
  }, []);

  useEffect(() => {
    getMyRentRequests()
      .then((res) => setApps(res.applications))
      .catch(() => setApps([]));
  }, [payStage === "done"]);

  async function handleMarkPaid(membershipId, amount) {
    await markPaid(selected, membershipId, amount);
    setData(await getGroup(selected));
    setDues(await getMyDues());
  }

  async function startPayment(due) {
    setPaying(due);
    setPayStage("confirm");
  }

  async function confirmPayment() {
    setPayStage("processing");
    // Simulated UPI gateway: wait a moment, then record the payment.
    await new Promise((r) => setTimeout(r, 1800));
    await markPaid(paying.groupId, paying.membershipId, paying.monthlyDue);
    setPayStage("done");
    setData(await getGroup(paying.groupId));
    setDues(await getMyDues());
  }

  function closePayment() {
    setPaying(null);
    setPayStage(null);
  }

  async function handleDecide(requestId, decision) {
    setError("");
    try {
      await decideJoinRequest(selected, requestId, decision, decision === "accepted" ? Number(acceptDue) : undefined);
      setAccepting(null);
      setAcceptDue("");
      setRequests((await getGroupJoinRequests(selected)).requests);
      setData(await getGroup(selected));
      setDues(await getMyDues());
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="container py-4">Loading...</div>;

  const paid = data ? data.members.filter((m) => m.paid) : [];
  const collected = paid.reduce((sum, m) => sum + Number(m.paidAmount), 0);
  const due = data ? data.members.reduce((sum, m) => sum + Number(m.monthlyDue), 0) : 0;
  const pct = due > 0 ? Math.round((collected / due) * 100) : 0;

  const ownUnpaid = dues ? dues.dues.filter((d) => !d.paid) : [];

  return (
    <div className="container my-4">
      <Reveal>
        <h1 className="fn-title mb-4">Dashboard</h1>
      </Reveal>

      {/* ---------- My PG applications (rent a PG online) ---------- */}
      <Reveal>
        <div className="card p-4 mb-4 fn-apps">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <h2 className="fn-section-title mb-0">My PG applications</h2>
            {apps.length > 0 && (
              <span className="text-muted small">
                {apps.length} applied PG{apps.length !== 1 && "s"}
              </span>
            )}
          </div>

          {apps.length === 0 ? (
            <p className="text-muted mb-0">
              You haven't applied to any PG yet. Browse PGs and send a rent request.
            </p>
          ) : (
            <div className="row g-3">
              {apps.map((a) => (
                <div className="col-md-6" key={a.requestId}>
                  <div className="fn-due-row">
                    <div className="d-flex align-items-center gap-2">
                      {a.photoUrl ? (
                        <img
                          src={a.photoUrl}
                          alt={a.pgName}
                          className="fn-app-photo"
                          style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8 }}
                        />
                      ) : (
                        <div
                          className="d-flex align-items-center justify-content-center text-muted bg-light"
                          style={{ width: 44, height: 44, borderRadius: 8, fontSize: 20 }}
                        >
                          🏠
                        </div>
                      )}
                      <div>
                        <div className="fw-semibold text-dark">{a.pgName}</div>
                        <div className="text-muted small">
                          {a.status === "accepted"
                            ? `Accepted · Rs ${a.monthlyRent}/month`
                            : a.status === "pending"
                              ? "Request pending"
                              : "Request declined"}
                        </div>
                      </div>
                    </div>

                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      {a.status === "accepted" ? (
                        <>
                          {a.rentPaid ? (
                            <span className="badge rounded-pill text-bg-success fs-6">RENT PAID</span>
                          ) : (
                            <span className="badge rounded-pill text-bg-danger fs-6">RENT DUE</span>
                          )}
                          {a.billPaid ? (
                            <span className="badge rounded-pill text-bg-success fs-6">BILL PAID</span>
                          ) : (
                            <span className="badge rounded-pill text-bg-warning fs-6">BILL DUE</span>
                          )}
                          {!a.rentPaid && (
                            <button
                              className="btn btn-primary btn-sm px-3"
                              onClick={() =>
                                startPayment({
                                  groupId: a.groupId,
                                  membershipId: a.membershipId,
                                  monthlyDue: a.monthlyDue,
                                  groupName: a.pgName,
                                })
                              }
                            >
                              Pay rent
                            </button>
                          )}
                        </>
                      ) : (
                        <span
                          className={`badge rounded-pill fs-6 ${
                            a.status === "pending"
                              ? "text-bg-warning"
                              : "text-bg-secondary"
                          }`}
                        >
                          {a.status === "pending" ? "PENDING" : "DECLINED"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Reveal>

      {groups.length === 0 ? (
        <div className="card p-4 text-center">
          <h5>You are not in any group yet</h5>
          <p className="text-muted mb-0">
            Ask a friend to add you, or create one soon.
          </p>
        </div>
      ) : (
        <>
          {/* ---------- Rent Online ---------- */}
          {dues && (
            <Reveal>
              <div className="card p-4 mb-4 fn-rent-online">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                  <h2 className="fn-section-title mb-0">Rent online</h2>
                  <span className="text-muted small">
                    {MONTHS[dues.month - 1]} {dues.year} · {dues.dues.length} group
                    {dues.dues.length !== 1 && "s"}
                  </span>
                </div>

                {ownUnpaid.length === 0 ? (
                  <p className="text-success fw-semibold mb-0">
                    You're all clear — no pending rent for this month.
                  </p>
                ) : (
                  <div className="row g-3">
                    {ownUnpaid.map((d) => (
                      <div className="col-md-6" key={d.membershipId}>
                        <div className="fn-due-row">
                          <div>
                            <div className="fw-semibold text-dark">{d.groupName}</div>
                            <div className="text-muted small">
                              Rent due · Rs {d.monthlyDue}
                            </div>
                          </div>
                          <button
                            className="btn btn-primary btn-sm px-3"
                            onClick={() => startPayment(d)}
                          >
                            Pay now
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Reveal>
          )}

          {/* ---------- Notifications & rent reminders ---------- */}
          {notifs && (notifs.notifications.length > 0 || notifs.reminders.length > 0) && (
            <Reveal>
              <div className="card p-4 mb-4 fn-notifs">
                <h2 className="fn-section-title mb-3">Notifications</h2>

                {notifs.reminders.length > 0 && (
                  <div className="mb-3">
                    {notifs.reminders.map((r) => (
                      <div key={r.id} className="fn-notif-item warning">
                        <span className="me-2">⏰</span>
                        <div>
                          <div className="fw-semibold">{r.title}</div>
                          <div className="small text-muted">{r.message}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {notifs.notifications.map((n) => (
                  <div key={n.id} className={`fn-notif-item ${n.is_read ? "read" : ""}`}>
                    <div>
                      <div className="fw-semibold">{n.title}</div>
                      <div className="small text-muted">{n.message}</div>
                      <div className="small text-muted mt-1">
                        {n.created_at ? new Date(n.created_at).toLocaleDateString() : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          )}

          <div className="mb-4 d-flex gap-2 flex-wrap">
            {groups.map((g) => (
              <button
                key={g.id}
                className={`btn ${selected === g.id ? "btn-primary" : "btn-outline-primary"}`}
                onClick={() => setSelected(g.id)}
              >
                {g.name}
              </button>
            ))}
          </div>

          {data && (
            <>
              <div className="row g-3 mb-4">
                <div className="col-sm-4">
                  <Reveal>
                    <div className="card fn-stat-card text-center p-3">
                      <div className="fn-stat-num">{data.members.length}</div>
                      <div className="text-muted small">Members</div>
                    </div>
                  </Reveal>
                </div>
                <div className="col-sm-4">
                  <Reveal delay={80}>
                    <div className="card fn-stat-card text-center p-3 border-success">
                      <div className="fn-stat-num text-success">Rs {collected}</div>
                      <div className="text-muted small">Collected</div>
                    </div>
                  </Reveal>
                </div>
                <div className="col-sm-4">
                  <Reveal delay={160}>
                    <div className="card fn-stat-card text-center p-3 border-danger">
                      <div className="fn-stat-num text-danger">Rs {due - collected}</div>
                      <div className="text-muted small">Outstanding</div>
                    </div>
                  </Reveal>
                </div>
              </div>

              <Reveal>
                <div className="card p-4 mb-4">
                  <div className="d-flex justify-content-between mb-2">
                    <h2 className="fn-section-title mb-0">This month's collection</h2>
                    <span className="fw-bold text-success">{pct}%</span>
                  </div>
                  <div className="fn-progress">
                    <div className="fn-progress-bar" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </Reveal>

              <h2 className="fn-section-title mb-3">Who has paid</h2>

              {data.members.map((m, i) => (
                <Reveal delay={i * 60} key={m.membershipId}>
                  <div className="card p-3 mb-2">
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                      <div>
                        <span className="fw-semibold">{m.name}</span>
                        <span className="text-muted small ms-2">due Rs {m.monthlyDue}</span>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        {m.paid ? (
                          <span className="badge rounded-pill text-bg-success fs-6">
                            PAID Rs {m.paidAmount}
                          </span>
                        ) : (
                          <>
                            <span className="badge rounded-pill text-bg-danger fs-6">OWES</span>
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleMarkPaid(m.membershipId, m.monthlyDue)}
                            >
                              Mark paid
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}

              {/* ---------- Owner: pending join requests ---------- */}
              {requests !== null && (
                <div className="card p-4 mt-4 fn-join-reqs">
                  <h2 className="fn-section-title mb-1">Join requests</h2>
                  <p className="text-muted small mb-3">
                    People who asked to join {data.group.name}. Accept to add them as a member.
                  </p>

                  {requests.length === 0 ? (
                    <p className="text-muted mb-0">No pending requests.</p>
                  ) : (
                    requests.map((r) => (
                      <div key={r.id} className="fn-req-row mb-3">
                        <div>
                          <div className="fw-semibold">{r.name}</div>
                          <div className="text-muted small">{r.email}</div>
                          {r.message && (
                            <div className="text-muted small fst-italic mt-1">
                              "{r.message}"
                            </div>
                          )}
                          <div className="small text-muted mt-1">
                            {new Date(r.created_at).toLocaleDateString()}
                          </div>
                        </div>

                        {accepting === r.id ? (
                          <div className="d-flex align-items-center gap-2 flex-wrap">
                            <input
                              className="form-control form-control-sm fn-accept-due"
                              type="number"
                              min="0"
                              value={acceptDue}
                              onChange={(e) => setAcceptDue(e.target.value)}
                              placeholder="Monthly due"
                            />
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => handleDecide(r.id, "accepted")}
                              disabled={!acceptDue}
                            >
                              Accept
                            </button>
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => { setAccepting(null); setAcceptDue(""); }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="d-flex gap-2">
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => setAccepting(r.id)}
                            >
                              Accept
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDecide(r.id, "rejected")}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {error && <p className="text-danger">{error}</p>}

      {/* ---------- Payment modal (simulated UPI) ---------- */}
      {paying && payStage && (
        <div className="fn-modal-backdrop" onClick={payStage === "done" ? closePayment : undefined}>
          <div className="fn-modal" onClick={(e) => e.stopPropagation()}>
            {payStage === "confirm" && (
              <>
                <h5 className="fw-bold">Pay rent online</h5>
                <div className="my-3 text-center">
                  <div className="text-muted small">Amount to pay</div>
                  <div className="fn-pay-amount">Rs {paying.monthlyDue}</div>
                  <div className="text-muted small">for {paying.groupName}</div>
                </div>
                <div className="fn-upi-box">
                  <span className="fw-semibold">UPI</span>
                  <span className="text-muted small">yourname@upi · Pay with any UPI app</span>
                </div>
                <button className="btn btn-primary w-100 mt-3" onClick={confirmPayment}>
                  Pay Rs {paying.monthlyDue}
                </button>
              </>
            )}

            {payStage === "processing" && (
              <div className="text-center py-4">
                <div className="fn-spinner" />
                <p className="mt-3 text-muted">Processing payment...</p>
              </div>
            )}

            {payStage === "done" && (
              <div className="text-center py-3">
                <div className="fn-check">✓</div>
                <h5 className="fw-bold mt-3 mb-1">Payment successful</h5>
                <p className="text-muted small mb-0">
                  Rs {paying.monthlyDue} paid for {paying.groupName}. The group
                  dashboard is updated.
                </p>
                <button className="btn btn-primary w-100 mt-4" onClick={closePayment}>
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
