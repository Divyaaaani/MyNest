import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { FaLocationDot, FaMagnifyingGlass, FaMoneyBillWave, FaRoute, FaPerson, FaPersonDress, FaRegPaperPlane } from "react-icons/fa6";
import { searchPGs, searchColleges } from "../api";
import PGMap from "../components/PGMap";
import Reveal from "../components/Reveal";
import FacilityIcon from "../components/FacilityIcon";
import {
  HouseIcon,
  BuildingIcon,
  PaidCheckIcon,
  ChecklistIcon,
  HandshakeIcon,
  GroupIcon,
  EnvelopeIcon,
  FlagIcon,
  ChatIcon,
  HouseArt,
} from "../components/Illustrations";

const RENT_FILTERS = [
  { key: "all",     label: "Any budget",      min: null, max: null },
  { key: "under5k", label: "Under ₹5,000",    min: null, max: 5000 },
  { key: "mid",     label: "₹5,000–₹7,000",   min: 5000, max: 7000 },
  { key: "over7k",  label: "Above ₹7,000",    min: 7000, max: null },
];

const DISTANCE_OPTIONS = [
  { value: "1", label: "Within 1 km" },
  { value: "3", label: "Within 3 km" },
  { value: "5", label: "Within 5 km" },
  { value: "10", label: "Within 10 km" },
  { value: "20", label: "Within 20 km" },
];

const GENDER_FILTERS = [
  { key: "any",    label: "Anyone",  icon: null },
  { key: "male",   label: "Boys",    icon: FaPerson },
  { key: "female", label: "Girls",   icon: FaPersonDress },
];

const JOURNEY = [
  {
    step: "1",
    title: "Find a PG",
    text: "Search by college, compare rent & distance to choose where you want to live.",
  },
  {
    step: "2",
    title: "Check facilities",
    text: "AC, WiFi, study table, fridge, meals — see exactly what each PG offers.",
  },
  {
    step: "3",
    title: "Find a roommate",
    text: "Post a roommate request or apply to join one that fits your budget and vibe.",
  },
  {
    step: "4",
    title: "Join the group & pay",
    text: "Once the owner accepts you, join the PG group and track rent & bills together.",
  },
];

const JOURNEY_ICONS = [HouseIcon, ChecklistIcon, HandshakeIcon, GroupIcon];

const MARQUEE_COLLEGES = [
  "YCCE Nagpur",
  "VNIT Nagpur",
  "COEP Pune",
  "Fergusson College Pune",
  "IIT Bombay",
  "VJTI Mumbai",
];

const TRUST_ITEMS = ["No brokerage", "Facility-wise comparison", "Roommate matching", "Rent & bill tracking"];

export default function Home() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [college, setCollege] = useState(null);
  const [radius, setRadius] = useState("3");
  const [gender, setGender] = useState("any");
  const [rentFilter, setRentFilter] = useState("all");
  const [pgs, setPgs] = useState(null);
  const [allPgs, setAllPgs] = useState(null);
  const [center, setCenter] = useState({ lat: 18.5295, lng: 73.8569 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const dropdownRef = useRef(null);
  const resultsRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await searchColleges(query);
        setSuggestions(data.colleges);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function onClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setSuggestions([]);
      }
    }
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, []);

  function pickCollege(c) {
    setCollege(c);
    setQuery(c.name);
    setSuggestions([]);
  }

  async function runSearch(c, r, rf, g) {
    const filter = RENT_FILTERS.find((f) => f.key === rf);
    setLoading(true);
    setError("");
    try {
      const data = await searchPGs(
        c.latitude,
        c.longitude,
        r,
        filter.min,
        filter.max,
        c.name,
        g === "any" ? "" : g
      );
      setAllPgs(data.pgs);
      setPgs(data.pgs);
      setCenter({ lat: Number(c.latitude), lng: Number(c.longitude) });
      // Results render below the fold — take the user straight to them
      // so it's obvious the search finished.
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!college) {
      setError("Pick a college from the suggestions first.");
      return;
    }
    await runSearch(college, radius, rentFilter, gender);
  }

  async function handleGender(key) {
    setGender(key);
    if (college) await runSearch(college, radius, rentFilter, key);
  }

  // Rent filter applies instantly to the results already loaded (no server round-trip).
  function handleRentFilter(key) {
    setRentFilter(key);
    const filter = RENT_FILTERS.find((f) => f.key === key);
    const list = allPgs || [];
    setPgs(
      filter.min == null && filter.max == null
        ? list
        : list.filter(
            (p) =>
              (filter.min == null || Number(p.monthly_rent) >= filter.min) &&
              (filter.max == null || Number(p.monthly_rent) < filter.max)
          )
    );
  }

  function splitFacilities(pg) {
    return pg.facilities ? pg.facilities.split(", ").slice(0, 4) : [];
  }

  function SkeletonCard() {
    return (
      <div className="col-md-6 col-lg-4">
        <div className="fn-skeleton" style={{ height: "100%", minHeight: 360 }}>
          <div className="fn-skel-img fn-skeleton" />
        </div>
      </div>
    );
  }

  // Floating hero cards — drag them around inside the illustration panel.
  function DraggableCard({ className, children }) {
    const ref = useRef(null);
    const drag = useRef({ active: false, dx: 0, dy: 0, startX: 0, startY: 0 });

    function onPointerDown(e) {
      if (e.button !== 0) return;
      drag.current = { active: true, dx: 0, dy: 0, startX: e.clientX, startY: e.clientY };
      ref.current.setPointerCapture(e.pointerId);
      ref.current.classList.add("fn-art-dragging");
      e.preventDefault();
    }

    function onPointerMove(e) {
      const d = drag.current;
      if (!d.active) return;
      const card = ref.current;
      const parent = card.parentElement;
      const pr = parent.getBoundingClientRect();
      const cr = card.getBoundingClientRect();
      let nx = d.dx + (e.clientX - d.startX);
      let ny = d.dy + (e.clientY - d.startY);
      const maxX = pr.width - cr.width;
      const maxY = pr.height - cr.height;
      nx = Math.max(0, Math.min(nx, maxX));
      ny = Math.max(0, Math.min(ny, maxY));
      d.dx = nx;
      d.dy = ny;
      d.startX = e.clientX;
      d.startY = e.clientY;
      card.style.transform = `translate(${nx}px, ${ny}px)`;
    }

    function onPointerUp() {
      if (!drag.current.active) return;
      drag.current.active = false;
      ref.current.classList.remove("fn-art-dragging");
      ref.current.classList.add("fn-art-fixed");
    }

    return (
      <div
        ref={ref}
        className={`fn-art-card ${className}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        title="Drag me"
      >
        {children}
      </div>
    );
  }

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="fn-hero">
        <div className="fn-blob fn-blob-1" />
        <div className="fn-blob fn-blob-2" />
        <div className="fn-blob fn-blob-3" />
        <div className="container position-relative">
          <div className="row align-items-center">
            <div className="col-lg-7">
              <Reveal>
                <span className="fn-hero-badge">Zero brokerage · Verified listings</span>
                <h1>
                  Your next <em className="fn-grad-text">home</em>
                  <br />
                  is closer than you think
                </h1>
                <p className="fn-hero-sub">
                  Find a PG, meet your roommates, and make a new place feel like
                  home.
                </p>
              </Reveal>

              <Reveal delay={120}>
                <div className="fn-search-card">
                  <form onSubmit={handleSearch}>
                    {/* Row 1: location + search */}
                    <div className="fn-search-row">
                      <div className="fn-autocomplete" ref={dropdownRef}>
                        <span className="fn-input-icon fn-input-icon-loc">
                          <FaLocationDot />
                        </span>
                        <input
                          className="fn-input-with-icon"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Search college or area, e.g. YCCE Nagpur"
                          autoComplete="off"
                        />
                        {suggestions.length > 0 && (
                          <ul className="fn-suggestions">
                            {suggestions.map((c) => (
                              <li key={c.id} onClick={() => pickCollege(c)}>
                                <span className="fw-semibold">{c.name}</span>
                                <span className="text-secondary small">{c.city}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <button type="submit" className="btn btn-primary fn-search-btn fn-btn-shine" disabled={loading}>
                        {loading ? (
                          <span className="fn-btn-spinner" aria-hidden="true" />
                        ) : (
                          <FaMagnifyingGlass className="me-1" />
                        )}
                        {loading ? "Finding…" : "Find PGs"}
                      </button>
                    </div>

                    {/* Row 2: distance + budget + gender */}
                    <div className="fn-search-filters">
                      <div className="fn-filter-group">
                        <span className="fn-filter-ico"><FaRoute /></span>
                        <select
                          className="fn-filter-select"
                          value={radius}
                          onChange={(e) => setRadius(e.target.value)}
                          aria-label="Search radius"
                        >
                          {DISTANCE_OPTIONS.map((d) => (
                            <option key={d.value} value={d.value}>{d.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="fn-filter-group">
                        <span className="fn-filter-ico"><FaMoneyBillWave /></span>
                        <select
                          className="fn-filter-select"
                          value={rentFilter}
                          onChange={(e) => handleRentFilter(e.target.value)}
                          aria-label="Budget"
                        >
                          {RENT_FILTERS.map((f) => (
                            <option key={f.key} value={f.key}>{f.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="fn-gender-pills">
                        {GENDER_FILTERS.map((g) => {
                          const Icon = g.icon;
                          return (
                            <button
                              key={g.key}
                              type="button"
                              className={`fn-gender-pill ${gender === g.key ? "active" : ""}`}
                              onClick={() => handleGender(g.key)}
                            >
                              {Icon && <Icon />} {g.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </form>
                </div>
              </Reveal>

              <Reveal delay={220}>
                <div className="fn-trust">
                  {TRUST_ITEMS.map((t) => (
                    <span key={t}>
                      <i>✓</i> {t}
                    </span>
                  ))}
                </div>
              </Reveal>

              {error && <p className="text-danger mt-2 mb-0">{error}</p>}
            </div>

            {/* Floating illustration cards on the right */}
            <div className="col-lg-5 d-none d-lg-block">
              <Reveal delay={160}>
                <div className="fn-hero-art">
                  <DraggableCard className="fn-art-card-1">
                    <div className="fn-art-glass">
                      <span className="fn-art-icon fn-art-icon-house">
                        <HouseIcon />
                      </span>
                      <div className="fn-art-info">
                        <div className="fn-art-label">Sunrise PG</div>
                        <div className="fn-art-sub">2.1 km · Rs 7,200</div>
                      </div>
                      <span className="fn-art-house">
                        <HouseArt tone="terracotta" />
                      </span>
                    </div>
                  </DraggableCard>
                  <DraggableCard className="fn-art-card-2">
                    <div className="fn-art-glass">
                      <span className="fn-art-icon fn-art-icon-building">
                        <BuildingIcon />
                      </span>
                      <div className="fn-art-info">
                        <div className="fn-art-label">Green Residency</div>
                        <div className="fn-art-sub">1 room left</div>
                      </div>
                      <span className="fn-art-house">
                        <HouseArt tone="green" />
                      </span>
                    </div>
                  </DraggableCard>
                  <DraggableCard className="fn-art-card-3">
                    <div className="fn-art-glass">
                      <span className="fn-art-icon fn-art-icon-paid">
                        <PaidCheckIcon />
                      </span>
                      <div className="fn-art-info">
                        <div className="fn-art-label">Rent paid</div>
                        <div className="fn-art-sub">August · all clear</div>
                      </div>
                      <span className="fn-art-house">
                        <HouseArt tone="amber" />
                      </span>
                    </div>
                  </DraggableCard>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Animated marquee of colleges ---------- */}
      <div className="fn-marquee">
        <div className="fn-marquee-track">
          {[...MARQUEE_COLLEGES, ...MARQUEE_COLLEGES].map((c, i) => (
            <span key={i}>
              <em>★</em> PGs near {c}
            </span>
          ))}
        </div>
      </div>

      <div className="container my-5">
        {/* ---------- The journey ---------- */}
        <section className="fn-journey">
          <Reveal>
            <h2 className="fn-section-title text-center fn-flourish">How MyNest works</h2>
            <p className="fn-section-sub text-center">
              From finding a PG to paying rent together — four simple steps
            </p>
          </Reveal>
          <div className="row g-4">
            {JOURNEY.map((s, i) => {
              const Icon = JOURNEY_ICONS[i];
              return (
                <div className="col-md-6 col-lg-3" key={s.step}>
                  <Reveal delay={i * 120}>
                    <div className="fn-journey-card">
                      <span className="fn-journey-step">{s.step}</span>
                      <span className={`fn-journey-ico fn-journey-ico-${i + 1}`}>
                        {Icon && <Icon />}
                      </span>
                      <h6>{s.title}</h6>
                      <p className="mb-0">{s.text}</p>
                    </div>
                  </Reveal>
                </div>
              );
            })}
          </div>
        </section>

        {college && (
          <Reveal>
            <p className="text-muted mb-3">
              Showing PGs within <strong>{radius} km</strong> of{" "}
              <strong>{college.name}</strong>
            </p>
          </Reveal>
        )}

        {/* Scroll target: search results land here */}
        <div ref={resultsRef} className="fn-results-anchor" />

        {/* Results summary strip */}
        {!loading && pgs && (
          <Reveal>
            <div className="fn-rent-bar">
              <span className="fn-rent-label">
                {pgs.length} result{pgs.length !== 1 && "s"}
              </span>
              <span className="fn-result-chip">
                <FaRoute /> {radius} km
              </span>
              <span className="fn-result-chip">
                <FaMoneyBillWave />{" "}
                {RENT_FILTERS.find((f) => f.key === rentFilter)?.label}
              </span>
              {gender !== "any" && (
                <span className="fn-result-chip">
                  {gender === "male" ? <FaPerson /> : <FaPersonDress />}{" "}
                  {gender === "male" ? "Boys only" : "Girls only"}
                </span>
              )}
            </div>
          </Reveal>
        )}

        {/* Results first, map below */}
        {loading ? (
          <div className="row g-4">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <SkeletonCard key={n} />
            ))}
          </div>
        ) : (
          pgs && (
            <>
              <Reveal>
                <h2 className="fn-section-title mb-3">
                  {pgs.length} PG{pgs.length !== 1 && "s"} found
                </h2>
              </Reveal>
              <div className="row g-4 mb-5">
                {pgs.map((pg, i) => (
                  <div className="col-md-6 col-lg-4" key={pg.id}>
                    <Reveal delay={i * 100}>
                      <Link to={`/pg/${pg.id}`} className="text-decoration-none">
                        <div className="card fn-pg-card h-100">
                          <div className="fn-pg-img-wrap">
                            {pg.photo_url ? (
                              <img
                                src={pg.photo_url}
                                className="fn-pg-img"
                                alt={pg.name}
                                loading="lazy"
                              />
                            ) : (
                              <div className="fn-pg-noimg" aria-hidden="true">
                                <HouseIcon />
                              </div>
                            )}
                            <span className="fn-pg-flag fn-pg-flag-l">{Number(pg.distance_km).toFixed(1)} km away</span>
                            <span className="fn-pg-flag fn-pg-flag-r">✓ Verified</span>
                          </div>
                          <div className="card-body">
                            <div className="d-flex justify-content-between align-items-start gap-2">
                              <h5 className="card-title mb-0 fn-pg-name">{pg.name}</h5>
                              {pg.gender === "male" ? (
                                <span className="fn-gender-badge" title="Boys only"><FaPerson /> Boys</span>
                              ) : pg.gender === "female" ? (
                                <span className="fn-gender-badge fn-gender-badge-f" title="Girls only"><FaPersonDress /> Girls</span>
                              ) : null}
                            </div>
                            <p className="card-text text-muted small mb-2">
                              {pg.address}, {pg.city}
                            </p>
                            <div className="fn-fac-badges mb-2">
                              {splitFacilities(pg).map((f) => (
                                <span key={f} className="fn-fac-badge">
                                  <FacilityIcon name={f} /> {f}
                                </span>
                              ))}
                            </div>
                            <p className="fn-price mb-0">
                              Rs {Number(pg.monthly_rent).toLocaleString("en-IN")} <span className="small text-muted">/month</span>
                            </p>
                            <span className="btn btn-primary btn-sm w-100 fn-view-btn mt-3">
                              View details
                            </span>
                          </div>
                        </div>
                      </Link>
                    </Reveal>
                  </div>
                ))}
              </div>

              <Reveal>
                <h2 className="fn-section-title mb-3">On the map</h2>
                <div className="mb-4">
                  <PGMap center={center} pgs={pgs} />
                </div>
              </Reveal>
            </>
          )
        )}
      </div>

      {/* ---------- Contact / report ---------- */}
      <section className="fn-contact">
        <div className="container">
          <Reveal>
            <h2 className="fn-section-title text-center fn-flourish">
              Got a question or a report?
              <span className="fn-contact-wave" aria-hidden="true">
                <svg className="fn-plane-trail" viewBox="0 0 96 60" fill="none" aria-hidden="true">
                  <path
                    d="M8 52 C 30 50, 46 44, 62 26"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray="1 7"
                    opacity="0.65"
                  />
                  <circle cx="7" cy="52" r="3.5" stroke="currentColor" strokeWidth="2" strokeDasharray="2 3" opacity="0.65" />
                </svg>
                <FaRegPaperPlane className="fn-plane" />
              </span>
            </h2>
            <p className="fn-section-sub text-center">
              Spotted something wrong on a listing, or want to reach the myNest team?
              We're one message away.
            </p>
          </Reveal>
          <div className="row g-4 justify-content-center mt-1">
            <div className="col-md-6 col-lg-4">
              <Reveal delay={60}>
                <div className="fn-contact-card">
                  <span className="fn-contact-icon fn-contact-icon-mail">
                    <EnvelopeIcon />
                  </span>
                  <h6>Email us</h6>
                  <p className="mb-2">For anything general — questions, feedback, suggestions.</p>
                  <a className="fw-semibold" href="mailto:hello@mynest.in">hello@mynest.in</a>
                </div>
              </Reveal>
            </div>
            <div className="col-md-6 col-lg-4">
              <Reveal delay={140}>
                <div className="fn-contact-card">
                  <span className="fn-contact-icon fn-contact-icon-report">
                    <FlagIcon />
                  </span>
                  <h6>Report a problem</h6>
                  <p className="mb-2">Wrong photos, fake rent, or a listing that doesn't exist.</p>
                  <a className="fw-semibold" href="mailto:report@mynest.in?subject=Listing%20report">report@mynest.in</a>
                </div>
              </Reveal>
            </div>
            <div className="col-md-6 col-lg-4">
              <Reveal delay={220}>
                <div className="fn-contact-card">
                  <span className="fn-contact-icon fn-contact-icon-wa">
                    <ChatIcon />
                  </span>
                  <h6>WhatsApp</h6>
                  <p className="mb-2">Fastest reply for urgent issues — 9am to 9pm.</p>
                  <a className="fw-semibold" href="https://wa.me/919876500011" target="_blank" rel="noreferrer">Chat on WhatsApp</a>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
