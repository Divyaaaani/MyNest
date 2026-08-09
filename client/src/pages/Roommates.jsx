import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getCommunityPosts,
  getPostComments,
  createCommunityPost,
  addPostComment,
} from "../api";
import Reveal from "../components/Reveal";

function initials(name) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Roommates() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [city, setCity] = useState("");
  const [budgetMax, setBudgetMax] = useState("");

  const [openComments, setOpenComments] = useState(null); // post id with open comments
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");

  const isLoggedIn = !!localStorage.getItem("fairnest_token");

  async function loadPosts() {
    setLoading(true);
    try {
      const data = await getCommunityPosts();
      setPosts(data.posts);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPosts();
  }, []);

  async function handleCreatePost(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      await createCommunityPost({
        title,
        message,
        city,
        budgetMax: budgetMax || null,
      });
      setTitle("");
      setMessage("");
      setCity("");
      setBudgetMax("");
      setShowForm(false);
      await loadPosts();
      setNotice("Post published! People can now comment to reach you.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleComments(postId) {
    if (openComments === postId) {
      setOpenComments(null);
      setComments([]);
      return;
    }
    setOpenComments(postId);
    const data = await getPostComments(postId);
    setComments(data.comments);
  }

  async function handleComment(e, postId) {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      await addPostComment(postId, commentText);
      setCommentText("");
      const data = await getPostComments(postId);
      setComments(data.comments);
      const list = await getCommunityPosts();
      setPosts(list.posts);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="container my-5">
      <Reveal>
        <div className="text-center mb-4">
          <h1 className="fn-title">Find your perfect roommate</h1>
          <p className="fn-section-sub">
            Students and working professionals post what they're looking for —
            comment to reach them directly
          </p>
          {isLoggedIn ? (
            <button
              className="btn btn-primary px-4"
              onClick={() => setShowForm(!showForm)}
            >
              {showForm ? "Cancel" : "+ Post what you're looking for"}
            </button>
          ) : (
            <p className="text-muted">
              <Link to="/auth" className="text-decoration-none">
                Log in
              </Link>{" "}
              to post or comment
            </p>
          )}
        </div>
      </Reveal>

      {showForm && (
        <Reveal>
          <div className="card p-4 mb-4" style={{ maxWidth: "720px", margin: "0 auto" }}>
            <h2 className="fn-section-title mb-3">Post a personals ad</h2>
            <form onSubmit={handleCreatePost}>
              <div className="mb-3">
                <input
                  className="form-control"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title, e.g. Female roommate wanted near COEP"
                  required
                />
              </div>
              <div className="mb-3">
                <textarea
                  className="form-control"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe who you're looking for, your lifestyle, budget..."
                  rows={3}
                  required
                />
              </div>
              <div className="row g-2 mb-3">
                <div className="col-md-6">
                  <input
                    className="form-control"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City, e.g. Pune"
                    required
                  />
                </div>
                <div className="col-md-6">
                  <input
                    className="form-control"
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(e.target.value)}
                    placeholder="Max budget (optional)"
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary w-100">
                Publish post
              </button>
            </form>
          </div>
        </Reveal>
      )}

      {notice && <p className="text-success text-center">{notice}</p>}
      {error && <p className="text-danger text-center">{error}</p>}

      {loading ? (
        <div className="text-center py-5 text-muted">Loading posts...</div>
      ) : posts.length === 0 ? (
        <div className="card p-5 text-center text-muted">
          No posts yet — be the first to look for a roommate.
        </div>
      ) : (
        <div className="row justify-content-center">
          <div className="col-lg-8">
            {posts.map((p, i) => (
              <Reveal delay={i * 80} key={p.id}>
                <div className="card p-4 mb-3 fn-community-card">
                  <div className="d-flex gap-3">
                    <div className="fn-avatar">{initials(p.author_name)}</div>
                    <div className="flex-grow-1">
                      <div className="d-flex flex-wrap justify-content-between gap-2">
                        <div>
                          <span className="fw-bold text-dark">{p.author_name}</span>
                          <span className="text-muted small ms-2">{timeAgo(p.created_at)}</span>
                        </div>
                        <span className="fn-distance">{p.city}</span>
                      </div>

                      <h5 className="mt-2 mb-1 fn-pg-name">{p.title}</h5>
                      <p className="text-muted mb-2">{p.message}</p>

                      {p.budget_max && (
                        <span className="fn-fac-badge">
                          Budget up to Rs {p.budget_max}
                        </span>
                      )}

                      <div className="mt-3">
                        <button
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => toggleComments(p.id)}
                        >
                          {p.comment_count} comment{p.comment_count !== 1 && "s"}
                        </button>
                      </div>

                      {openComments === p.id && (
                        <div className="mt-3 fn-comments">
                          {comments.length === 0 ? (
                            <p className="text-muted small mb-2">
                              No comments yet — be the first.
                            </p>
                          ) : (
                            comments.map((c) => (
                              <div key={c.id} className="fn-comment">
                                <div className="fn-comment-avatar">{initials(c.author_name)}</div>
                                <div>
                                  <span className="fw-semibold small text-dark">
                                    {c.author_name}
                                  </span>
                                  <span className="text-muted small ms-2">{timeAgo(c.created_at)}</span>
                                  <div className="small">{c.message}</div>
                                </div>
                              </div>
                            ))
                          )}

                          {isLoggedIn ? (
                            <form onSubmit={(e) => handleComment(e, p.id)} className="d-flex gap-2 mt-3">
                              <input
                                className="form-control"
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                placeholder="Comment to reach the poster..."
                                required
                              />
                              <button type="submit" className="btn btn-primary btn-sm text-nowrap">
                                Comment
                              </button>
                            </form>
                          ) : (
                            <p className="text-muted small mt-2 mb-0">
                              <Link to="/auth" className="text-decoration-none">
                                Log in
                              </Link>{" "}
                              to comment.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
