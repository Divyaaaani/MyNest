import { useState, useRef, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { createProperty, searchColleges } from "../api";
import Reveal from "../components/Reveal";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const pinIcon = L.divIcon({
  className: "pg-marker",
  html: `<div class="pg-marker-inner" style="background:#00b377;color:#fff">★</div>`,
  iconSize: [26, 34],
  iconAnchor: [13, 32],
});

const DEFAULT_CENTER = { lat: 21.1195, lng: 79.0458 }; // Nagpur/YCCE default

// Standard facilities every student looks for. Owners tick what their PG has.
const FACILITIES = [
  "WiFi",
  "Mess",
  "Washing Machine",
  "Bills Included",
  "Study Table",
  "Cleaning (Biweekly)",
  "Time Restriction",
  "AC",
  "Fridge",
  "Geyser",
  "Laundry",
  "Parking",
  "TV",
  "Kitchen",
  "Attached Bathroom",
  "Housekeeping",
];

// Plain-Leaflet click-to-pin picker (no react-leaflet dependency).
function LocationPicker({ location, onPick }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (mapInstance.current) return;
    mapInstance.current = L.map(mapRef.current).setView(
      [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
      13
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapInstance.current);

    mapInstance.current.on("click", (e) => {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    if (markerRef.current) markerRef.current.remove();
    if (location) {
      markerRef.current = L.marker([location.lat, location.lng], { icon: pinIcon })
        .addTo(map)
        .bindPopup("PG location");
    }
  }, [location]);

  return <div ref={mapRef} style={{ height: "100%", width: "100%", borderRadius: 8 }} />;
}

export default function AddProperty() {
  const token = localStorage.getItem("fairnest_token");
  const me = JSON.parse(localStorage.getItem("fairnest_user") || "{}");

  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    monthlyRent: "",
    gender: "any",
    capacity: "",
    bhk: "",
    areaSqft: "",
    furnished: false,
    description: "",
  });
  const [college, setCollege] = useState(null);
  const [collegeQuery, setCollegeQuery] = useState("");
  const [collegeSuggestions, setCollegeSuggestions] = useState([]);
  const [location, setLocation] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const dropdownRef = useRef(null);

  if (!token || me.role !== "owner") return <Navigate to="/auth" replace />;

  useEffect(() => {
    if (!collegeQuery.trim()) {
      setCollegeSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await searchColleges(collegeQuery);
        setCollegeSuggestions(data.colleges);
      } catch {
        setCollegeSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [collegeQuery]);

  useEffect(() => {
    function onClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setCollegeSuggestions([]);
      }
    }
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, []);

  function pickCollege(c) {
    setCollege(c);
    setCollegeQuery(c.name);
    setCollegeSuggestions([]);
  }

  function handlePhotos(files) {
    const picked = Array.from(files).slice(0, 5);
    setPhotos(picked);
    setPreviews(picked.map((f) => URL.createObjectURL(f)));
  }

  function toggleFacility(name) {
    setFacilities((prev) =>
      prev.includes(name) ? prev.filter((f) => f !== name) : [...prev, name]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (photos.length === 0) {
      setError("Upload at least one photo.");
      return;
    }
    if (!location) {
      setError("Pin the exact location on the map.");
      return;
    }

    const fd = new FormData();
    fd.append("name", form.name);
    fd.append("address", form.address);
    fd.append("city", form.city);
    fd.append("collegeNearby", college ? college.name : "");
    fd.append("collegeId", college ? String(college.id) : "");
    fd.append("monthlyRent", form.monthlyRent);
    fd.append("gender", form.gender);
    fd.append("capacity", form.capacity);
    fd.append("bhk", form.bhk);
    fd.append("areaSqft", form.areaSqft);
    fd.append("furnished", form.furnished ? "1" : "0");
    fd.append("description", form.description);
    fd.append("latitude", location.lat);
    fd.append("longitude", location.lng);
    facilities.forEach((f) => fd.append("facilities", f));
    photos.forEach((p) => fd.append("photos", p));

    setUploading(true);
    try {
      await createProperty(fd);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  if (done) {
    return (
      <div className="container my-5">
        <div className="card p-4 text-center fn-auth-card">
          <div className="fn-check mb-3">✓</div>
          <h4 className="fw-bold">Listing created!</h4>
          <p className="text-muted mb-0">
            {form.name} is now live on MyNest. Students searching near{" "}
            {college ? college.name : form.city || "your area"} will find it.
          </p>
          <a className="btn btn-primary mt-4" href="/owner">
            Back to owner dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="container my-4">
      <Reveal>
        <h1 className="fn-title mb-1">Add property</h1>
        <p className="text-muted mb-4">
          List a PG, flat or room. Pin the exact spot so students can find you.
        </p>
      </Reveal>

      <form onSubmit={handleSubmit} className="card p-4">
        <h2 className="fn-section-title mb-3">Basic details</h2>
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label small text-muted">Listing name</label>
            <input
              className="form-control"
              placeholder="e.g. Comfort Stay, Shivaji Nagar"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="col-md-6">
            <label className="form-label small text-muted">City</label>
            <input
              className="form-control"
              placeholder="e.g. Nagpur"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              required
            />
          </div>
          <div className="col-12">
            <label className="form-label small text-muted">Address</label>
            <input
              className="form-control"
              placeholder="House / plot, area, landmark"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label small text-muted">
              Nearest college (pick from the list so students find you)
            </label>
            <div className="fn-autocomplete" ref={dropdownRef}>
              <input
                className="form-control"
                placeholder="e.g. YCCE Nagpur"
                value={collegeQuery}
                onChange={(e) => {
                  setCollegeQuery(e.target.value);
                  setCollege(null);
                }}
                autoComplete="off"
              />
              {collegeSuggestions.length > 0 && (
                <ul className="fn-suggestions">
                  {collegeSuggestions.map((c) => (
                    <li key={c.id} onClick={() => pickCollege(c)}>
                      <span className="fw-semibold">{c.name}</span>
                      <span className="text-secondary small">{c.city}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {college && (
              <div className="form-text text-success">
                Selected: {college.name}
              </div>
            )}
          </div>
        </div>

        <h2 className="fn-section-title mt-4 mb-3">Pricing & specs</h2>
        <div className="row g-3">
          <div className="col-md-3">
            <label className="form-label small text-muted">Monthly rent (Rs)</label>
            <input
              className="form-control"
              type="number"
              min="0"
              placeholder="15000"
              value={form.monthlyRent}
              onChange={(e) => setForm({ ...form, monthlyRent: e.target.value })}
              required
            />
          </div>
          <div className="col-md-3">
            <label className="form-label small text-muted">BHK / rooms</label>
            <input
              className="form-control"
              type="number"
              min="1"
              placeholder="2"
              value={form.bhk}
              onChange={(e) => setForm({ ...form, bhk: e.target.value })}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label small text-muted">Area (sq.ft.)</label>
            <input
              className="form-control"
              type="number"
              min="0"
              placeholder="1100"
              value={form.areaSqft}
              onChange={(e) => setForm({ ...form, areaSqft: e.target.value })}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label small text-muted">Who can stay?</label>
            <select
              className="form-select"
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            >
              <option value="any">Anyone (mixed)</option>
              <option value="male">Boys only</option>
              <option value="female">Girls only</option>
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label small text-muted">Capacity (people)</label>
            <input
              className="form-control"
              type="number"
              min="1"
              placeholder="4"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            />
          </div>
          <div className="col-12">
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                id="furnished"
                checked={form.furnished}
                onChange={(e) => setForm({ ...form, furnished: e.target.checked })}
              />
              <label className="form-check-label" htmlFor="furnished">
                Furnished
              </label>
            </div>
          </div>
          <div className="col-12">
            <label className="form-label small text-muted">Description</label>
            <textarea
              className="form-control"
              rows="3"
              placeholder="What makes this place great? Nearby shops, transport, food, etc."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </div>

        <h2 className="fn-section-title mt-4 mb-3">Facilities</h2>
        <div className="row g-3">
          <div className="col-12">
            <div className="form-text mb-2">
              Tick what this PG offers — students filter by these and see them on
              the detail page.
            </div>
            <div className="d-flex flex-wrap gap-2">
              {FACILITIES.map((f) => (
                <label
                  key={f}
                  className={`btn btn-sm ${facilities.includes(f) ? "btn-primary" : "btn-outline-secondary"}`}
                >
                  <input
                    type="checkbox"
                    className="d-none"
                    checked={facilities.includes(f)}
                    onChange={() => toggleFacility(f)}
                  />
                  {facilities.includes(f) ? "✓ " : ""}
                  {f}
                </label>
              ))}
            </div>
          </div>
        </div>

        <h2 className="fn-section-title mt-4 mb-3">Exact location</h2>
        <div className="row g-3">
          <div className="col-12">
            <div className="form-text mb-2">
              Click on the map to drop the pin at the exact spot. Students use
              this to find your PG on the map and get directions.
            </div>
            <div className="map" style={{ height: 320 }}>
              <LocationPicker location={location} onPick={setLocation} />
            </div>
            {location && (
              <div className="form-text mt-2">
                Pin set: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
              </div>
            )}
          </div>
        </div>

        <h2 className="fn-section-title mt-4 mb-3">Photos (up to 5)</h2>
        <div className="row g-3">
          <div className="col-12">
            <input
              className="form-control"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handlePhotos(e.target.files)}
            />
            <div className="form-text">Add up to 5 photos — rooms, hall, kitchen, bathroom.</div>
          </div>
          {previews.length > 0 && (
            <div className="col-12 d-flex gap-2 flex-wrap">
              {previews.map((p, i) => (
                <img key={i} src={p} alt="preview" className="fn-photo-preview" />
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-danger mt-3">{error}</p>}

        <button type="submit" className="btn btn-primary btn-lg mt-4" disabled={uploading}>
          {uploading ? "Uploading..." : "Publish listing"}
        </button>
      </form>
    </div>
  );
}
