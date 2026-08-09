import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FaPerson, FaPersonDress } from "react-icons/fa6";
import { getPG, createRoommateRequest, applyToRoommate, requestJoinGroup, getMyJoinStatus, sendRentRequest, getRentStatus } from "../api";
import PGMap from "../components/PGMap";
import Reveal from "../components/Reveal";
import FacilityIcon from "../components/FacilityIcon";

// The features every student cares about — always shown with ✓/✗.
const MANDATORY_FACILITIES = [
  "WiFi",
  "Mess",
  "Washing Machine",
  "Bills Included",
  "Study Table",
  "Cleaning (Biweekly)",
  "Time Restriction",
];

export default function PGDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [slots, setSlots] = useState("1");
  const [notice, setNotice] = useState("");
  const [mainImg, setMainImg] = useState(0);

  const [joinStatus, setJoinStatus] = useState(null);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [joinMsg, setJoinMsg] = useState("");

  const [rentStatus, setRentStatus] = useState(null);
  const [showRentForm, setShowRentForm] = useState(false);
  const [rentMsg, setRentMsg] = useState("");

  const isLoggedIn = !!localStorage.getItem("fairnest_token");
  const me = (() => {
    try {
      return JSON.parse(localStorage.getItem("fairnest_user") || "{}");
    } catch {
      return {};
    }
  })();

  useEffect(() => {
    getPG(id)
      .then((d) => {
        setData(d);
        // If this PG has a group and we're logged in, load our join status.
        if (d.pg.group_id && isLoggedIn) {
          getMyJoinStatus(d.pg.group_id)
            .then((s) => setJoinStatus(s))
            .catch(() => setJoinStatus(null));
        }
        // Rent status (apply to rent on your own, no roommate needed).
        if (isLoggedIn && me.role !== "owner") {
          getRentStatus(id)
            .then(setRentStatus)
            .catch(() => setRentStatus(null));
        }
      })
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleCreateRequest(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      await createRoommateRequest(id, message, slots);
      setShowForm(false);
      setMessage("");
      setData(await getPG(id));
      setNotice("Request posted! Roommates can now join it.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleApply(requestId) {
    setError("");
    setNotice("");
    try {
      await applyToRoommate(requestId);
      setNotice("You applied to join! The person who posted it can see you.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRequestJoin(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      await requestJoinGroup(data.pg.group_id, joinMsg);
      setShowJoinForm(false);
      setJoinMsg("");
      setJoinStatus(await getMyJoinStatus(data.pg.group_id));
      setNotice("Request sent! The group owner will review it.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRent(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      await sendRentRequest(id, rentMsg);
      setShowRentForm(false);
      setRentMsg("");
      setRentStatus(await getRentStatus(id));
      setNotice("Rent request sent! The owner will review it.");
    } catch (err) {
      setError(err.message);
    }
  }

  if (error && !data) return <div className="container py-4 text-danger">{error}</div>;
  if (!data) return <div className="container py-4">Loading...</div>;

  const { pg, photos, requests } = data;
  const facilities = pg.facilities ? pg.facilities.split(", ") : [];
  const extras = facilities.filter((f) => !MANDATORY_FACILITIES.includes(f));

  return (
    <div className="container my-4">
      <nav className="small mb-2">
        <a href="/" className="text-decoration-none text-secondary">Find PG</a>
        <span className="mx-1 text-secondary">/</span>
        <span className="text-secondary">{pg.name}</span>
      </nav>

      <Reveal>
        <h1 className="fn-title">
          {pg.name}
          {pg.gender === "male" && (
            <span className="fn-gender-badge ms-2" title="Boys only"><FaPerson /> Boys</span>
          )}
          {pg.gender === "female" && (
            <span className="fn-gender-badge fn-gender-badge-f ms-2" title="Girls only"><FaPersonDress /> Girls</span>
          )}
        </h1>
        <p className="text-muted">
          {pg.address}, {pg.city} · near {pg.college_nearby}
        </p>
      </Reveal>

      <div className="row g-4">
        <div className="col-lg-5">
          <Reveal>
            {photos.length > 0 ? (
              <img
                src={photos[mainImg].url}
                className="img-fluid rounded fn-hero-img"
                alt={pg.name}
              />
            ) : (
              <div className="rounded fn-hero-img bg-light d-flex align-items-center justify-content-center text-muted">
                No photo yet
              </div>
            )}
          </Reveal>
          {photos.length > 1 && (
            <div className="d-flex gap-2 flex-wrap mt-2">
              {photos.map((p, i) => (
                <img
                  key={p.id}
                  src={p.url}
                  className={`fn-thumb ${i === mainImg ? "border-primary" : ""}`}
                  alt={pg.name}
                  onClick={() => setMainImg(i)}
                />
              ))}
            </div>
          )}
        </div>
        <div className="col-lg-7">
          <Reveal delay={120}>
            <div className="card p-4 h-100">
              <div className="row text-center g-3 mb-3">
                <div className="col-4">
                  <div className="fn-stat-num">Rs {pg.monthly_rent}</div>
                  <div className="small text-muted">per month</div>
                </div>
                <div className="col-4">
                  <div className="fn-stat-num">{pg.capacity}</div>
                  <div className="small text-muted">capacity</div>
                </div>
                <div className="col-4">
                  <div className="fn-stat-num">{pg.owner_name}</div>
                  <div className="small text-muted">managed by</div>
                </div>
              </div>

              {/* Contact the owner directly */}
              <div className="card p-3 bg-light">
                <h6 className="fw-semibold mb-1">Contact the owner</h6>
                <p className="small text-muted mb-2">
                  Talk to {pg.owner_name} directly for visits, availability and rent details.
                </p>
                {pg.owner_phone ? (
                  <div className="d-flex flex-wrap gap-2">
                    <a className="fn-call-btn" href={`tel:${pg.owner_phone}`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      Call {pg.owner_phone}
                    </a>
                    <a
                      className="fn-wa-btn"
                      href={`https://wa.me/${String(pg.owner_phone).replace(/^\+/, "")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <svg viewBox="0 0 32 32" fill="currentColor">
                        <path d="M16.004 3C9.383 3 4 8.383 4 15.004c0 2.117.554 4.188 1.607 6.012L4 29l8.118-1.585A11.94 11.94 0 0 0 16.004 29C22.625 29 28 23.617 28 16.996 28 10.383 22.625 3 16.004 3zm0 23.488c-1.887 0-3.738-.508-5.358-1.465l-.383-.229-4.816.942.943-4.698-.25-.391a9.93 9.93 0 0 1-1.521-5.277c0-5.496 4.473-9.969 9.973-9.969 5.492 0 9.969 4.473 9.969 9.969 0 5.496-4.477 9.969-9.973 9.969zm5.465-7.453c-.3-.148-1.765-.867-2.039-.965-.273-.102-.469-.148-.668.148-.198.297-.766.965-.94 1.164-.172.199-.344.223-.644.074-.3-.148-1.261-.465-2.398-1.48-.883-.785-1.477-1.758-1.653-2.055-.172-.297-.02-.46.132-.605.134-.133.3-.344.445-.516.148-.172.199-.297.301-.496.098-.199.05-.371-.025-.516-.074-.148-.668-1.61-.918-2.203-.242-.578-.485-.5-.668-.508l-.57-.009c-.199 0-.52.074-.793.371-.273.297-1.043 1.02-1.043 2.488s1.066 2.883 1.215 3.082c.148.199 2.098 3.203 5.082 4.492.711.305 1.262.488 1.695.621.711.223 1.355.191 1.867.117.57-.082 1.765-.719 2.012-1.414.25-.695.25-1.293.176-1.418-.074-.129-.273-.203-.57-.348zm0 0"/>
                      </svg>
                      WhatsApp
                    </a>
                  </div>
                ) : (
                  <p className="text-muted small mb-0">
                    Owner hasn't shared a contact number yet.
                  </p>
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      {/* Facilities: mandatory features always shown with ✓/✗ */}
      <Reveal>
        <div className="card p-4 my-4">
          <h2 className="fn-section-title mb-3">Facilities</h2>
          <p className="text-muted small mb-3">
            What's available at {pg.name} — everything below is what the owner has
            confirmed.
          </p>
          <div className="row g-3">
            {MANDATORY_FACILITIES.map((f) => {
              const has = facilities.includes(f);
              return (
                <div className="col-6 col-md-3" key={f}>
                  <div
                    className={`p-2 rounded d-flex align-items-center gap-2 ${
                      has ? "fn-fac-yes" : "fn-fac-no"
                    }`}
                  >
                    <span className="fw-bold">{has ? "✓" : "✗"}</span>
                    <span className="small d-inline-flex align-items-center gap-1">
                      <FacilityIcon name={f} size={14} /> {f}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {extras.length > 0 && (
            <div className="mt-3">
              <div className="small text-muted mb-2">More facilities</div>
              <div className="d-flex flex-wrap gap-2">
                {extras.map((f) => (
                  <span key={f} className="fn-fac-tag">
                    <FacilityIcon name={f} size={14} /> {f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Reveal>

      <Reveal>
        <div className="mb-4">
          <PGMap
            center={{ lat: Number(pg.latitude), lng: Number(pg.longitude) }}
            pgs={[{ ...pg, distance_km: 0 }]}
          />
        </div>
      </Reveal>

      {data.pg.group_id && (
        <Reveal>
          <div className="card p-4 fn-roommates">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
              <h2 className="fn-section-title mb-0">Join this PG's group</h2>
              <span className="fn-fac-tag">group ID {data.pg.group_id}</span>
            </div>
          {!isLoggedIn ? (
            <p className="text-muted mb-0">
              Log in to request joining this PG's group — once the owner accepts, you pay your share monthly.
            </p>
          ) : joinStatus && joinStatus.isMember ? (
            <p className="text-success mb-0 fw-semibold">
              You're already a member of this PG's group.
            </p>
          ) : joinStatus && joinStatus.request === "pending" ? (
            <p className="text-warning mb-0 fw-semibold">
              Your request to join is pending owner approval.
            </p>
          ) : joinStatus && joinStatus.request === "rejected" ? (
            <p className="text-danger mb-0">Your earlier request was declined. You can request again.</p>
          ) : showJoinForm ? (
            <form onSubmit={handleRequestJoin} className="row g-2">
              <div className="col-12">
                <textarea
                  className="form-control"
                  value={joinMsg}
                  onChange={(e) => setJoinMsg(e.target.value)}
                  placeholder="Why do you want to join? (optional)"
                />
              </div>
              <div className="col-6 d-flex gap-2">
                <button type="submit" className="btn btn-primary flex-grow-1">
                  Send request
                </button>
                <button type="button" className="btn btn-outline-secondary" onClick={() => setShowJoinForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <p className="text-muted mb-0">
                Living here? Request to join so you can split rent and pay online with your flatmates.
              </p>
              <button className="btn btn-primary" onClick={() => setShowJoinForm(true)}>
                + Request to join
              </button>
            </div>
          )}
          </div>
        </Reveal>
      )}

      {/* Rent this PG online (no roommate needed) */}
      {me.role !== "owner" && (
        <Reveal>
          <div className="card p-4 fn-rent-online mb-4">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
              <div>
                <h2 className="fn-section-title mb-1">Rent this PG</h2>
                <p className="text-muted small mb-0">
                  No roommate needed — request a room and pay rent online.
                </p>
              </div>
              {isLoggedIn && rentStatus && !rentStatus.isTenant && rentStatus.request !== "pending" && rentStatus.request !== "accepted" && (
                <button className="btn btn-primary" onClick={() => setShowRentForm(!showRentForm)}>
                  {showRentForm ? "Cancel" : "Request to rent"}
                </button>
              )}
            </div>

            {!isLoggedIn ? (
              <p className="text-muted mb-0">
                <a href="/auth" className="text-decoration-none">Log in</a> to send a rent request to the owner.
              </p>
            ) : rentStatus && rentStatus.isTenant ? (
              <p className="text-success mb-0 fw-semibold">
                You're a tenant at this PG. Pay your rent from the dashboard.
              </p>
            ) : rentStatus && rentStatus.request === "accepted" ? (
              <p className="text-success mb-0 fw-semibold">
                Your rent request was accepted — welcome to {pg.name}!
              </p>
            ) : rentStatus && rentStatus.request === "rejected" ? (
              <p className="text-danger mb-0">Your earlier request was declined. You can try again.</p>
            ) : showRentForm ? (
              <form onSubmit={handleRent} className="row g-2">
                <div className="col-12">
                  <textarea
                    className="form-control"
                    value={rentMsg}
                    onChange={(e) => setRentMsg(e.target.value)}
                    placeholder="Tell the owner your move-in date, room preference... (optional)"
                  />
                </div>
                <div className="col-6 d-flex gap-2">
                  <button type="submit" className="btn btn-primary flex-grow-1">
                    Send rent request
                  </button>
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowRentForm(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <p className="text-muted mb-0">
                  Want this room for yourself? Send a request and the owner will confirm.
                </p>
                <button className="btn btn-primary" onClick={() => setShowRentForm(true)}>
                  + Request to rent
                </button>
              </div>
            )}
          </div>
        </Reveal>
      )}

      <Reveal>
        <div className="card p-4 fn-roommates">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <h2 className="fn-section-title mb-0">Need a roommate?</h2>
            {isLoggedIn ? (
              <button
                className="btn btn-primary"
                onClick={() => setShowForm(!showForm)}
              >
                {showForm ? "Cancel" : "+ I need a roommate"}
              </button>
            ) : (
              <span className="text-muted">Log in to post or join requests.</span>
            )}
          </div>

          {showForm && (
            <form onSubmit={handleCreateRequest} className="row g-2 mb-4">
              <div className="col-12">
                <textarea
                  className="form-control"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe who you're looking for..."
                  required
                />
              </div>
              <div className="col-6">
                <input
                  className="form-control"
                  value={slots}
                  onChange={(e) => setSlots(e.target.value)}
                  placeholder="How many roommates?"
                />
              </div>
              <div className="col-6 d-flex align-items-end">
                <button type="submit" className="btn btn-primary w-100">
                  Post request
                </button>
              </div>
            </form>
          )}

          {requests.length === 0 ? (
            <p className="text-muted mb-0">No roommate requests for this PG yet.</p>
          ) : (
            requests.map((r) => (
              <div key={r.id} className="fn-req-row">
                <div>
                  <div className="fw-semibold">{r.message}</div>
                  <div className="small text-muted">
                    {r.owner_name} · {r.slots} slot(s) · {r.applicant_count} applied
                  </div>
                </div>
                {isLoggedIn ? (
                  <button className="btn btn-outline-primary btn-sm" onClick={() => handleApply(r.id)}>
                    Join
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </Reveal>

      {notice && <p className="text-success mt-3">{notice}</p>}
      {error && <p className="text-danger mt-3">{error}</p>}
    </div>
  );
}
