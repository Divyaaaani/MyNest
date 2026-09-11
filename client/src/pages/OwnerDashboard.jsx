import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  getOwnerPGs,
  getOwnerPG,
  decideRentRequest,
  addTenant,
  recordTenantPayment,
} from "../api";
import Reveal from "../components/Reveal";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function OwnerDashboard() {
  const token = localStorage.getItem("mynest_token");
  const me = JSON.parse(localStorage.getItem("mynest_user") || "{}");

  const [pgs, setPgs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add-tenant form
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", phone: "", monthlyDue: "", rentDueDay: 29, billDueDay: 25 });

  // Rent request accept/reject
  const [accepting, setAccepting] = useState(null);
  const [acceptDue, setAcceptDue] = useState("");

  if (!token || me.role !== "owner") return <Navigate to="/auth" replace />;

  async function refresh() {
    const res = await getOwnerPGs();
    setPgs(res.pgs);
    if (res.pgs.length > 0 && !res.pgs.some((p) => p.id === selected)) {
      setSelected(res.pgs[0].id);
    } else if (res.pgs.length === 0) {
      setSelected(null);
    }
  }

  useEffect(() => {
    refresh()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll every 5s so new rent requests show up without a manual refresh.
  useEffect(() => {
    if (!selected) return;
    const id = setInterval(() => {
      refresh().catch(() => {});
      getOwnerPG(selected)
        .then(setData)
        .catch(() => {});
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    if (!selected) {
      setData(null);
      return;
    }
    getOwnerPG(selected)
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch((err) => setError(err.message));
  }, [selected]);

  async function handleDecide(requestId, decision) {
    setError("");
    try {
      await decideRentRequest(
        selected,
        requestId,
        decision,
        decision === "accepted" ? Number(acceptDue) : undefined
      );
      setAccepting(null);
      setAcceptDue("");
      setData(await getOwnerPG(selected));
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddTenant(e) {
    e.preventDefault();
    setError("");
    try {
      await addTenant(selected, {
        name: addForm.name,
        phone: addForm.phone,
        monthlyDue: addForm.monthlyDue,
        rentDueDay: addForm.rentDueDay,
        billDueDay: addForm.billDueDay,
      });
      setAddForm({ name: "", phone: "", monthlyDue: "", rentDueDay: 29, billDueDay: 25 });
      setShowAdd(false);
      setData(await getOwnerPG(selected));
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handlePayment(membershipId, type, amount) {
    setError("");
    try {
      await recordTenantPayment(selected, membershipId, type, amount);
      setData(await getOwnerPG(selected));
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading)
    return (
      <div className="container py-4">
        <div className="fn-skeleton mb-3" style={{ height: 34, width: "36%" }} />
        <div className="fn-skeleton mb-3" style={{ height: 120 }} />
        <div className="fn-skeleton fn-skel-line" style={{ width: "65%" }} />
      </div>
    );

  const now = new Date();
  const monthName = MONTHS[now.getMonth()];

  const tenants = data ? data.tenants : [];
  const rentExpected = data ? data.rentExpected : 0;
  const rentCollected = data ? data.rentCollected : 0;
  const billCollected = data ? data.billCollected : 0;
  const outstanding = rentExpected - rentCollected;
  const pct = rentExpected > 0 ? Math.round((rentCollected / rentExpected) * 100) : 0;

  return (
    <div className="container my-4">
      <Reveal>
        <h1 className="fn-title mb-1">Owner dashboard</h1>
        <p className="text-muted mb-4">Manage your PGs, tenants, rent and bills.</p>
      </Reveal>

      {error && <div className="fn-alert fn-alert-error" role="alert">{error}</div>}

      {pgs.length === 0 ? (
        <div className="card p-4 text-center">
          <h5>You don't own any PG yet</h5>
          <p className="text-muted mb-0">
            PGs you list on MyNest will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* PG selector */}
          <div className="mb-4 d-flex gap-2 flex-wrap">
            {pgs.map((p) => (
              <button
                key={p.id}
                className={`btn ${selected === p.id ? "btn-primary" : "btn-outline-primary"}`}
                onClick={() => setSelected(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>

          {data && (
            <>
              {/* Stats */}
              <div className="row g-3 mb-4">
                <div className="col-sm-3">
                  <Reveal>
                    <div className="card fn-stat-card text-center p-3">
                      <div className="fn-stat-num">{tenants.length}</div>
                      <div className="text-muted small">Tenants</div>
                    </div>
                  </Reveal>
                </div>
                <div className="col-sm-3">
                  <Reveal delay={60}>
                    <div className="card fn-stat-card text-center p-3">
                      <div className="fn-stat-num">Rs {Number(rentExpected).toLocaleString("en-IN")}</div>
                      <div className="text-muted small">{monthName} rent expected</div>
                    </div>
                  </Reveal>
                </div>
                <div className="col-sm-3">
                  <Reveal delay={120}>
                    <div className="card fn-stat-card text-center p-3 border-success">
                      <div className="fn-stat-num text-success">Rs {Number(rentCollected).toLocaleString("en-IN")}</div>
                      <div className="text-muted small">Rent collected</div>
                    </div>
                  </Reveal>
                </div>
                <div className="col-sm-3">
                  <Reveal delay={180}>
                    <div className="card fn-stat-card text-center p-3 border-danger">
                      <div className="fn-stat-num text-danger">Rs {Number(outstanding).toLocaleString("en-IN")}</div>
                      <div className="text-muted small">Outstanding</div>
                    </div>
                  </Reveal>
                </div>
              </div>

              {/* Collection progress */}
              <Reveal>
                <div className="card p-4 mb-4">
                  <div className="d-flex justify-content-between mb-2">
                    <h2 className="fn-section-title mb-0">{monthName} collection</h2>
                    <span className="fw-bold text-success">{pct}%</span>
                  </div>
                  <div className="fn-progress">
                    <div className="fn-progress-bar" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </Reveal>

              {/* Add tenant + tenant table */}
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h2 className="fn-section-title mb-0">Tenants</h2>
                <button className="btn btn-sm btn-primary" onClick={() => setShowAdd(!showAdd)}>
                  {showAdd ? "Cancel" : "+ Add tenant"}
                </button>
              </div>

              {showAdd && (
                <form className="card p-4 mb-4" onSubmit={handleAddTenant}>
                  <div className="row g-3">
                    <div className="col-md-3">
                      <input
                        className="form-control"
                        placeholder="Tenant name"
                        value={addForm.name}
                        onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-md-3">
                      <input
                        className="form-control"
                        placeholder="Phone"
                        value={addForm.phone}
                        onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-md-2">
                      <input
                        className="form-control"
                        placeholder="Monthly rent"
                        type="number"
                        min="0"
                        value={addForm.monthlyDue}
                        onChange={(e) => setAddForm({ ...addForm, monthlyDue: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-md-2">
                      <input
                        className="form-control"
                        placeholder="Rent due day"
                        type="number"
                        min="1"
                        max="31"
                        value={addForm.rentDueDay}
                        onChange={(e) => setAddForm({ ...addForm, rentDueDay: e.target.value })}
                      />
                    </div>
                    <div className="col-md-2">
                      <button type="submit" className="btn btn-success w-100">Add</button>
                    </div>
                  </div>
                </form>
              )}

              {tenants.length === 0 ? (
                <div className="card p-4 text-center text-muted mb-4">
                  No tenants yet — accept a rent request or add one above.
                </div>
              ) : (
                <div className="card p-3 mb-4">
                  <div className="table-responsive">
                    <table className="table fn-table align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Tenant</th>
                          <th>Contact</th>
                          <th>Rent due</th>
                          <th>Rent</th>
                          <th>Bill</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tenants.map((t) => (
                          <tr key={t.membership_id}>
                            <td>
                              <div className="fw-semibold">{t.name}</div>
                              <div className="text-muted small">{t.email}</div>
                            </td>
                            <td>
                              <div>{t.phone || "—"}</div>
                              <div className="text-muted small">
                                due {t.rent_due_day}th / bill {t.bill_due_day}th
                              </div>
                            </td>
                            <td>Rs {t.monthly_due}</td>
                            <td>
                              {t.rent_payment_id ? (
                                <span className="badge rounded-pill text-bg-success">
                                  PAID Rs {t.rent_paid_amount}
                                </span>
                              ) : (
                                <>
                                  <span className="badge rounded-pill text-bg-danger me-2">OWES</span>
                                  <button
                                    className="btn btn-sm btn-outline-success"
                                    onClick={() => handlePayment(t.membership_id, "rent", t.monthly_due)}
                                  >
                                    Mark paid
                                  </button>
                                </>
                              )}
                            </td>
                            <td>
                              {t.bill_payment_id ? (
                                <span className="badge rounded-pill text-bg-success">
                                  PAID Rs {t.bill_paid_amount}
                                </span>
                              ) : (
                                <>
                                  <span className="badge rounded-pill text-bg-warning me-2">UNPAID</span>
                                  <button
                                    className="btn btn-sm btn-outline-warning"
                                    onClick={() => handlePayment(t.membership_id, "bill", t.monthly_due * 0.1)}
                                  >
                                    Bill paid
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Pending rent requests */}
              <h2 className="fn-section-title mb-3">Rent requests</h2>
              {data.requests.length === 0 ? (
                <p className="text-muted">No pending requests.</p>
              ) : (
                data.requests.map((r) => (
                  <div key={r.id} className="card p-3 mb-2 fn-req-row">
                    <div>
                      <div className="fw-semibold">{r.name}</div>
                      <div className="text-muted small">{r.phone || r.email}</div>
                      {r.message && (
                        <div className="text-muted small fst-italic mt-1">"{r.message}"</div>
                      )}
                    </div>

                    {accepting === r.id ? (
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <input
                          className="form-control form-control-sm"
                          type="number"
                          min="0"
                          value={acceptDue}
                          onChange={(e) => setAcceptDue(e.target.value)}
                          placeholder="Monthly rent"
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
            </>
          )}
        </>
      )}
    </div>
  );
}
