// Central file for ALL backend calls. Every page imports functions from here.
// Local dev: "/api" works because of the Vite proxy (client -> server).
// Production (Vercel frontend + Render backend): set VITE_API_URL to the
// backend origin INCLUDING /api, e.g. https://mynest-api.onrender.com/api
const API = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

export async function searchPGs(lat, lng, radius, minRent, maxRent, college, gender) {
  const params = new URLSearchParams({ lat, lng, radius });
  if (minRent) params.set("min_rent", minRent);
  if (maxRent) params.set("max_rent", maxRent);
  if (college) params.set("college", college);
  if (gender) params.set("gender", gender);
  const res = await fetch(`${API}/pgs?${params}`);
  if (!res.ok) throw new Error("Failed to fetch PGs");
  return res.json();
}

export async function searchColleges(q) {
  const res = await fetch(`${API}/colleges?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error("Failed to search colleges");
  return res.json();
}

export async function getPG(id) {
  const res = await fetch(`${API}/pgs/${id}`);
  if (!res.ok) throw new Error("Failed to load PG");
  return res.json();
}

export async function createRoommateRequest(pgId, message, slots) {
  const res = await fetch(`${API}/pgs/${pgId}/roommates`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ message, slots }),
  });
  if (res.status === 401) throw new Error("Please log in first");
  if (!res.ok) throw new Error("Failed to create request");
  return res.json();
}

export async function applyToRoommate(requestId, message) {
  const res = await fetch(`${API}/roommates/${requestId}/apply`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ message }),
  });
  if (res.status === 401) throw new Error("Please log in first");
  if (!res.ok) throw new Error((await res.json()).error || "Failed to apply");
  return res.json();
}

export async function register(name, email, password, role, phone) {
  const res = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, role, phone }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Registration failed");
  return res.json();
}

export async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Login failed");
  return res.json();
}

// ---- Protected calls: attach the saved JWT as a Bearer token ----

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("mynest_token")}`,
  };
}

export async function getMyGroups() {
  const res = await fetch(`${API}/groups/mine`, { headers: authHeaders() });
  if (res.status === 401) throw new Error("Session expired — please log in again");
  if (!res.ok) throw new Error("Failed to load groups");
  return res.json();
}

export async function getMyDues() {
  const res = await fetch(`${API}/groups/mine/dues`, { headers: authHeaders() });
  if (res.status === 401) throw new Error("Session expired — please log in again");
  if (!res.ok) throw new Error("Failed to load dues");
  return res.json();
}

export async function getGroup(id) {
  const res = await fetch(`${API}/groups/${id}`, { headers: authHeaders() });
  if (res.status === 401) throw new Error("Session expired — please log in again");
  if (!res.ok) throw new Error("Failed to load group");
  return res.json();
}

export async function markPaid(groupId, membershipId, amount) {
  const res = await fetch(`${API}/groups/${groupId}/payments`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ membershipId, amount }),
  });
  if (!res.ok) throw new Error("Failed to record payment");
  return res.json();
}

// ---- Community (find-your-roommate personals) ----

export async function getCommunityPosts() {
  const res = await fetch(`${API}/community/posts`);
  if (!res.ok) throw new Error("Failed to load posts");
  return res.json();
}

export async function getPostComments(postId) {
  const res = await fetch(`${API}/community/posts/${postId}/comments`);
  if (!res.ok) throw new Error("Failed to load comments");
  return res.json();
}

export async function createCommunityPost({ title, message, city, budgetMax }) {
  const res = await fetch(`${API}/community/posts`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ title, message, city, budgetMax }),
  });
  if (res.status === 401) throw new Error("Please log in first");
  if (!res.ok) throw new Error("Failed to post");
  return res.json();
}

export async function addPostComment(postId, message) {
  const res = await fetch(`${API}/community/posts/${postId}/comments`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ message }),
  });
  if (res.status === 401) throw new Error("Please log in first");
  if (!res.ok) throw new Error("Failed to comment");
  return res.json();
}

// Ping a post's author ("I want to contact you") — lands in their dashboard
// notifications. Best-effort: callers should still open the channel on failure.
export async function pingPostAuthor(postId) {
  const res = await fetch(`${API}/community/posts/${postId}/contact`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (res.status === 401) throw new Error("Please log in first");
  if (!res.ok) throw new Error("Failed to notify");
  return res.json();
}

// ---- Join Group (student requests, owner approves) ----

export async function requestJoinGroup(groupId, message) {
  const res = await fetch(`${API}/groups/${groupId}/join-requests`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ message }),
  });
  if (res.status === 401) throw new Error("Please log in first");
  if (!res.ok) throw new Error((await res.json()).error || "Failed to send request");
  return res.json();
}

export async function getMyJoinStatus(groupId) {
  const res = await fetch(`${API}/groups/${groupId}/my-request`, { headers: authHeaders() });
  if (res.status === 401) throw new Error("Session expired — please log in again");
  if (!res.ok) throw new Error("Failed to load status");
  return res.json();
}

export async function getGroupJoinRequests(groupId) {
  const res = await fetch(`${API}/groups/${groupId}/join-requests`, { headers: authHeaders() });
  if (res.status === 401) throw new Error("Session expired — please log in again");
  if (res.status === 403) throw new Error("Only the group owner can review requests");
  if (!res.ok) throw new Error("Failed to load requests");
  return res.json();
}

export async function decideJoinRequest(groupId, requestId, decision, monthlyDue) {
  const res = await fetch(`${API}/groups/${groupId}/join-requests/${requestId}/decide`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ decision, monthlyDue }),
  });
  if (res.status === 401) throw new Error("Session expired — please log in again");
  if (res.status === 403) throw new Error("Only the group owner can decide");
  if (!res.ok) throw new Error((await res.json()).error || "Failed to decide");
  return res.json();
}

// ---- Rent a PG online (student applies to owner) ----

export async function sendRentRequest(pgId, message) {
  const res = await fetch(`${API}/pgs/${pgId}/rent-requests`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ message }),
  });
  if (res.status === 401) throw new Error("Please log in first");
  if (!res.ok) throw new Error((await res.json()).error || "Failed to send request");
  return res.json();
}

export async function getRentStatus(pgId) {
  const res = await fetch(`${API}/pgs/${pgId}/rent-status`, { headers: authHeaders() });
  if (res.status === 401) throw new Error("Please log in first");
  if (!res.ok) throw new Error("Failed to load status");
  return res.json();
}

export async function getMyRentRequests() {
  const res = await fetch(`${API}/pgs/my/rent-requests`, { headers: authHeaders() });
  if (res.status === 401) throw new Error("Please log in first");
  if (!res.ok) throw new Error("Failed to load your PG applications");
  return res.json();
}

// ---- Owner dashboard ----

// Create a property listing (multipart: fields + up to 5 photo files).
export async function createProperty(formData) {
  const res = await fetch(`${API}/properties`, {
    method: "POST",
    headers: { Authorization: `Bearer ${localStorage.getItem("mynest_token")}` },
    body: formData,
  });
  if (res.status === 401) throw new Error("Please log in first");
  if (res.status === 403) throw new Error("Owners only");
  if (!res.ok) throw new Error((await res.json()).error || "Failed to create listing");
  return res.json();
}

export async function getOwnerPGs() {
  const res = await fetch(`${API}/owner/pgs`, { headers: authHeaders() });
  if (res.status === 401) throw new Error("Session expired — please log in again");
  if (res.status === 403) throw new Error("Owners only");
  if (!res.ok) throw new Error("Failed to load PGs");
  return res.json();
}

export async function getOwnerPG(id) {
  const res = await fetch(`${API}/owner/pgs/${id}`, { headers: authHeaders() });
  if (res.status === 401) throw new Error("Session expired — please log in again");
  if (res.status === 403) throw new Error("Owners only");
  if (!res.ok) throw new Error("Failed to load PG");
  return res.json();
}

export async function decideRentRequest(pgId, requestId, decision, monthlyDue) {
  const res = await fetch(`${API}/owner/pgs/${pgId}/rent-requests/${requestId}/decide`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ decision, monthlyDue }),
  });
  if (res.status === 401) throw new Error("Session expired — please log in again");
  if (!res.ok) throw new Error((await res.json()).error || "Failed to decide");
  return res.json();
}

export async function addTenant(pgId, payload) {
  const res = await fetch(`${API}/owner/pgs/${pgId}/tenants`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (res.status === 401) throw new Error("Session expired — please log in again");
  if (!res.ok) throw new Error((await res.json()).error || "Failed to add tenant");
  return res.json();
}

export async function recordTenantPayment(pgId, membershipId, type, amount) {
  const res = await fetch(`${API}/owner/pgs/${pgId}/members/${membershipId}/payment`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ type, amount }),
  });
  if (res.status === 401) throw new Error("Session expired — please log in again");
  if (!res.ok) throw new Error((await res.json()).error || "Failed to record payment");
  return res.json();
}

// ---- Notifications ----

export async function getNotifications() {
  const res = await fetch(`${API}/notifications`, { headers: authHeaders() });
  if (res.status === 401) throw new Error("Session expired — please log in again");
  if (!res.ok) throw new Error("Failed to load notifications");
  return res.json();
}

export async function markNotificationsRead() {
  const res = await fetch(`${API}/notifications/read`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to update notifications");
  return res.json();
}
