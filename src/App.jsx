import React, { useEffect, useMemo, useState } from "react"

const API_BASE = "http://localhost:8000/api"

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed with status ${response.status}`)
  }

  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    return response.json()
  }
  return response.text()
}

const STATUS_STYLES = {
  PENDING: { bg: "#fff7ed", color: "#c2410c", border: "#fdba74" },
  APPROVED: { bg: "#ecfdf3", color: "#15803d", border: "#86efac" },
  REJECTED: { bg: "#fef2f2", color: "#dc2626", border: "#fca5a5" },
}

const formatDate = (value) => {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}

export default function App() {
  const [users, setUsers] = useState([])
  const [requests, setRequests] = useState([])
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [selectedRequestId, setSelectedRequestId] = useState("")
  const [reviewMessage, setReviewMessage] = useState("")
  const [activeList, setActiveList] = useState("PENDING")
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    reviewer_id: "",
  })
  const [reviewForm, setReviewForm] = useState({
    action: "APPROVED",
    comments: "",
  })
  const [editingRequestId, setEditingRequestId] = useState(null)
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    reviewer_id: "",
  })

  const stats = useMemo(() => {
    const total = requests.length
    const pending = requests.filter((r) => r.status === "PENDING").length
    const approved = requests.filter((r) => r.status === "APPROVED").length
    const rejected = requests.filter((r) => r.status === "REJECTED").length
    return { total, pending, approved, rejected }
  }, [requests])

  const isReviewer =
    (user?.role || "").toLowerCase() === "reviewer" ||
    (user?.email || "").toLowerCase() === "mdhanushreddydr@gmail.com"

  const selectedRequest = useMemo(
    () => requests.find((r) => String(r.id) === String(selectedRequestId)) || null,
    [requests, selectedRequestId],
  )

  const reviewQueue = useMemo(
    () => requests.filter((r) => r.status === "PENDING"),
    [requests],
  )
  const pendingRequests = useMemo(
    () => requests.filter((r) => r.status === "PENDING"),
    [requests],
  )
  const approvedRequests = useMemo(
    () => requests.filter((r) => r.status === "APPROVED"),
    [requests],
  )
  const rejectedRequests = useMemo(
    () => requests.filter((r) => r.status === "REJECTED"),
    [requests],
  )
  const reviewers = useMemo(
    () => users.filter((candidate) => (candidate.role || "").toLowerCase() === "reviewer"),
    [users],
  )
  const recentActivity = useMemo(
    () =>
      [...requests]
        .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
        .slice(0, 4),
    [requests],
  )

  const loadData = async () => {
    try {
      const usersRes = await apiRequest(`${API_BASE}/users`)
      setUsers(usersRes || [])

      const endpoint = isReviewer ? `${API_BASE}/reviewer/requests` : `${API_BASE}/requests`
      const requestsRes = await apiRequest(endpoint)
      const safeRequests = Array.isArray(requestsRes) ? requestsRes : []
      setRequests(safeRequests)

      if (!selectedRequestId && safeRequests.length > 0) {
        setSelectedRequestId(String(safeRequests[0].id))
      } else if (
        selectedRequestId &&
        !safeRequests.some((request) => String(request.id) === String(selectedRequestId))
      ) {
        setSelectedRequestId("")
      }
    } catch (error) {
      console.error(error)
    }
  }

  const loadSession = async () => {
    try {
      setAuthLoading(true)
      const response = await apiRequest(`${API_BASE}/auth/me`)
      setUser(response)
    } catch (error) {
      setUser(null)
    } finally {
      setAuthLoading(false)
    }
  }

  useEffect(() => {
    loadSession()
  }, [])

  useEffect(() => {
    if (!authLoading && user) {
      loadData()
      const interval = window.setInterval(() => {
        loadData()
      }, 5000)
      return () => window.clearInterval(interval)
    }
  }, [authLoading, user, isReviewer])

  const handleRequestSubmit = async (e) => {
    e.preventDefault()
    if (!form.title || !form.description || !user) return

    try {
      await apiRequest(`${API_BASE}/requests`, {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          priority: form.priority,
          reviewer_id: form.reviewer_id ? Number(form.reviewer_id) : null,
          created_by: user.id,
        }),
      })

      setForm({ title: "", description: "", priority: "MEDIUM", reviewer_id: "" })
      await loadData()
    } catch (error) {
      console.error(error)
    }
  }

  const handleReviewSubmit = async (e) => {
    e.preventDefault()
    if (!selectedRequestId || !user || !isReviewer) return

    try {
      const requestId = Number(selectedRequestId)
      const endpoint = reviewForm.action === "APPROVED"
        ? `${API_BASE}/reviewer/requests/${requestId}/approve`
        : `${API_BASE}/reviewer/requests/${requestId}/reject`

      await apiRequest(
        `${endpoint}${reviewForm.comments ? `?comments=${encodeURIComponent(reviewForm.comments)}` : ""}`,
        { method: "POST" },
      )

      const nextStatus = reviewForm.action
      setRequests((prev) =>
        prev.map((item) =>
          item.id === requestId
            ? {
                ...item,
                status: nextStatus,
                updated_at: new Date().toISOString(),
                reviewer_id: user.id,
              }
            : item,
        ),
      )
      setReviewMessage(`${nextStatus === "APPROVED" ? "Approved" : "Rejected"} successfully.`)
      setReviewForm({ action: "APPROVED", comments: "" })
      setSelectedRequestId(String(requestId))
      await loadData()
      await loadData()
    } catch (error) {
      setReviewMessage(error.message || "Unable to update request.")
    }
  }

  const handleViewRequest = (requestId) => {
    setSelectedRequestId(String(requestId))
    setReviewMessage("")
    setEditingRequestId(null)
  }

  const startEditing = (request) => {
    setEditingRequestId(request.id)
    setEditForm({
      title: request.title,
      description: request.description,
      priority: request.priority,
      reviewer_id: request.reviewer_id ? String(request.reviewer_id) : "",
    })
  }

  const handleUpdateRequest = async (e) => {
    e.preventDefault()
    if (!editingRequestId || !user) return

    try {
      await apiRequest(`${API_BASE}/requests/${editingRequestId}`, {
        method: "PUT",
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          priority: editForm.priority,
          reviewer_id: editForm.reviewer_id ? Number(editForm.reviewer_id) : null,
          created_by: user.id,
        }),
      })
      setEditingRequestId(null)
      await loadData()
    } catch (error) {
      console.error(error)
    }
  }

  const handleDeleteRequest = async (requestId) => {
    try {
      await apiRequest(`${API_BASE}/requests/${requestId}`, { method: "DELETE" })
      await loadData()
    } catch (error) {
      console.error(error)
    }
  }

  const handleGoogleLogin = () => {
    window.location.href = "http://localhost:8000/api/auth/google/login"
  }

  const handleLogout = async () => {
    try {
      await apiRequest(`${API_BASE}/auth/logout`, { method: "POST" })
      setUser(null)
      window.location.reload()
    } catch (error) {
      console.error(error)
    }
  }

  if (authLoading) {
    return <div style={loadingStyle}>Loading session...</div>
  }

  return (
    <div style={{ background: "linear-gradient(180deg, #f7f3ff 0%, #f8fafc 100%)", minHeight: "100vh", padding: "32px 16px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <header style={{
          background: "linear-gradient(90deg, #111827 0%, #4338ca 50%, #8b5cf6 100%)",
          color: "#fff",
          borderRadius: 24,
          padding: "28px 30px",
          marginBottom: 24,
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.18)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, textTransform: "uppercase", letterSpacing: 2.2, color: "#ddd6fe", fontWeight: 800 }}>
                Workflow Hub
              </p>
              <h1 style={{ margin: "8px 0 0", fontSize: 32, fontWeight: 800 }}>Approval Management System</h1>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {user && (
                <span style={{
                  background: "rgba(255, 255, 255, 0.12)",
                  border: "1px solid rgba(255, 255, 255, 0.18)",
                  color: "#e2e8f0",
                  borderRadius: 999,
                  padding: "8px 12px",
                  fontSize: 13,
                  fontWeight: 700,
                }}>
                  {isReviewer ? "Reviewer workspace" : "Requester workspace"}
                </span>
              )}
              {user ? (
                <button style={logoutButtonStyle} onClick={handleLogout}>Logout</button>
              ) : (
                <button style={loginButtonStyle} onClick={handleGoogleLogin}>Login with Google</button>
              )}
            </div>
          </div>
        </header>

        {!user ? (
          <section style={emptyStateStyle}>
            <h2 style={{ marginTop: 0 }}>Welcome</h2>
            <p style={{ marginBottom: 16 }}>Please sign in with Google to access the workflow dashboard.</p>
            <button style={loginButtonStyle} onClick={handleGoogleLogin}>Continue with Google</button>
          </section>
        ) : isReviewer ? (
          <>
            <section style={{ ...panelStyle, marginBottom: 24, background: "linear-gradient(90deg, #f8f5ff 0%, #eef2ff 100%)", border: "1px solid #ddd6fe" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <p style={{ margin: 0, color: "#6d28d9", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.4 }}>Reviewer</p>
                  <h2 style={{ margin: "6px 0 0", fontSize: 28, fontWeight: 800 }}>{user.name}</h2>
                  <p style={{ margin: "6px 0 0", color: "#64748b" }}>{user.email}</p>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ ...statPillStyle, background: "#eef2ff", color: "#4f46e5" }}>Pending: {stats.pending}</div>
                  <div style={{ ...statPillStyle, background: "#ecfdf3", color: "#15803d" }}>Approved: {stats.approved}</div>
                  <div style={{ ...statPillStyle, background: "#fef2f2", color: "#dc2626" }}>Rejected: {stats.rejected}</div>
                </div>
              </div>
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "0.92fr 1.08fr", gap: 24 }}>
              <div style={{ ...panelStyle, background: "linear-gradient(180deg, #fff 0%, #f9fbff 100%)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <p style={{ margin: 0, color: "#2563eb", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.3 }}>Review Queue</p>
                    <h3 style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 800 }}>
                      {activeList === "PENDING" ? "Pending requests" : activeList === "APPROVED" ? "Approved requests" : "Rejected requests"}
                    </h3>
                  </div>
                  <span style={{ ...statPillStyle, background: "#eef2ff", color: "#4338ca" }}>
                    {activeList === "PENDING" ? reviewQueue.length : activeList === "APPROVED" ? approvedRequests.length : rejectedRequests.length} {activeList.toLowerCase()}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  {[
                    { key: "PENDING", label: "Pending" },
                    { key: "APPROVED", label: "Approved" },
                    { key: "REJECTED", label: "Rejected" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveList(item.key)}
                      style={{
                        ...buttonStyle,
                        padding: "10px 12px",
                        background: activeList === item.key ? "linear-gradient(90deg, #6d28d9, #8b5cf6)" : "#eef2ff",
                        color: activeList === item.key ? "#fff" : "#0f172a",
                        fontSize: 13,
                        boxShadow: activeList === item.key ? "0 10px 18px rgba(109,40,217,.24)" : "none",
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
                  {(activeList === "PENDING"
                    ? reviewQueue
                    : activeList === "APPROVED"
                      ? approvedRequests
                      : rejectedRequests
                  ).map((request) => (
                    <button
                      key={request.id}
                      onClick={() => handleViewRequest(request.id)}
                      style={{
                        ...requestListButtonStyle,
                        borderColor: selectedRequestId === String(request.id) ? "#2563eb" : "#e2e8f0",
                        background: selectedRequestId === String(request.id) ? "#eef8ff" : "#fff",
                        boxShadow: selectedRequestId === String(request.id) ? "inset 0 0 0 1px #bfdbfe" : "0 8px 18px rgba(15, 23, 42, 0.04)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                        <strong style={{ textAlign: "left", fontSize: 15 }}>{request.title}</strong>
                        <span style={{ ...statusBadgeStyle, ...STATUS_STYLES[request.status] }}>{request.status}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, color: "#64748b", fontSize: 13 }}>
                        <span>#{request.id} • {request.priority}</span>
                        <span>{formatDate(request.updated_at)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ ...panelStyle, background: "linear-gradient(180deg, #fff 0%, #f8fbff 100%)" }}>
                {selectedRequest ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <div>
                        <p style={{ margin: 0, color: "#6d28d9", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.4 }}>Selected request</p>
                        <h3 style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 800 }}>{selectedRequest.title}</h3>
                      </div>
                      <span style={{ ...statusBadgeStyle, ...STATUS_STYLES[selectedRequest.status], background: selectedRequest.status === "APPROVED" ? "#ecfdf3" : selectedRequest.status === "REJECTED" ? "#fef2f2" : "#fff7ed" }}>{selectedRequest.status}</span>
                    </div>
                    <p style={{ color: "#475569", marginTop: 14, lineHeight: 1.7 }}>{selectedRequest.description}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginTop: 16 }}>
                      <div style={statCardStyle}><strong>{selectedRequest.priority}</strong><span>Priority</span></div>
                      <div style={statCardStyle}><strong>{selectedRequest.created_by}</strong><span>Requester ID</span></div>
                      <div style={statCardStyle}><strong>{selectedRequest.reviewer_id ?? "Unassigned"}</strong><span>Reviewer</span></div>
                      <div style={statCardStyle}><strong>{formatDate(selectedRequest.updated_at)}</strong><span>Updated</span></div>
                    </div>
                    {reviewMessage && (
                      <div style={{
                        marginTop: 16,
                        padding: "10px 12px",
                        borderRadius: 12,
                        background: selectedRequest.status === "APPROVED" ? "#ecfdf3" : selectedRequest.status === "REJECTED" ? "#fef2f2" : "#eff6ff",
                        color: selectedRequest.status === "APPROVED" ? "#166534" : selectedRequest.status === "REJECTED" ? "#b91c1c" : "#1d4ed8",
                        fontSize: 14,
                        fontWeight: 600,
                      }}>
                        {reviewMessage}
                      </div>
                    )}
                    <div style={{ marginTop: 18, border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, background: "#f8fafc" }}>
                      <p style={{ margin: 0, color: "#0f172a", fontWeight: 800 }}>Decision note</p>
                      <form onSubmit={handleReviewSubmit} style={{ display: "grid", gap: 12, marginTop: 12 }}>
                        <label style={labelStyle}>Decision</label>
                        <select
                          style={inputStyle}
                          value={reviewForm.action}
                          onChange={(e) => setReviewForm({ ...reviewForm, action: e.target.value })}
                        >
                          <option value="APPROVED">Approve</option>
                          <option value="REJECTED">Reject</option>
                        </select>
                        <label style={labelStyle}>Comments</label>
                        <textarea
                          style={{ ...inputStyle, minHeight: 110 }}
                          placeholder="Describe the decision or next action"
                          value={reviewForm.comments}
                          onChange={(e) => setReviewForm({ ...reviewForm, comments: e.target.value })}
                        />
                        <div style={{ display: "flex", gap: 10 }}>
                          <button style={buttonStyle} type="submit">Submit decision</button>
                          <button
                            style={secondaryButtonStyle}
                            type="button"
                            onClick={() => setReviewForm({ action: reviewForm.action, comments: "" })}
                          >
                            Clear
                          </button>
                        </div>
                      </form>
                    </div>
                  </>
                ) : (
                  <div style={{ color: "#64748b", padding: "24px 0" }}>Select a request from the queue to review details.</div>
                )}
              </div>
            </section>
          </>
        ) : (
          <>
            <section style={{ ...panelStyle, marginBottom: 24, background: "linear-gradient(90deg, #f8fafc 0%, #f5f3ff 100%)", border: "1px solid #e9ddff" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 18 }}>
                <div>
                  <p style={{ margin: 0, color: "#6d28d9", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.4 }}>Requester dashboard</p>
                  <h2 style={{ margin: "8px 0 0", fontSize: 30, fontWeight: 800 }}>{user.name}</h2>
                  <p style={{ color: "#64748b", margin: "6px 0 0" }}>{user.email}</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
                  <div style={{ ...statCardStyle, background: "#f8fafc", borderColor: "#e2e8f0" }}><strong>{stats.total}</strong><span>Total</span></div>
                  <div style={{ ...statCardStyle, background: "#fff7ed", borderColor: "#fed7aa" }}><strong>{stats.pending}</strong><span>Pending</span></div>
                  <div style={{ ...statCardStyle, background: "#ecfdf3", borderColor: "#a7f3d0" }}><strong>{stats.approved}</strong><span>Approved</span></div>
                  <div style={{ ...statCardStyle, background: "#fef2f2", borderColor: "#fecaca" }}><strong>{stats.rejected}</strong><span>Rejected</span></div>
                </div>
              </div>
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 24 }}>
              <div style={{ display: "grid", gap: 24 }}>
                <div style={{ ...panelStyle, background: "linear-gradient(180deg, #fff 0%, #f8fbff 100%)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <h3 style={{ margin: 0 }}>Create request</h3>
                    <span style={{ ...statPillStyle, background: "#eef2ff", color: "#4338ca" }}>New</span>
                  </div>
                  <form onSubmit={handleRequestSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
                    <input style={inputStyle} placeholder="Request title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                    <textarea style={{ ...inputStyle, minHeight: 120 }} placeholder="Request description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    <select style={inputStyle} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                    <select style={inputStyle} value={form.reviewer_id} onChange={(e) => setForm({ ...form, reviewer_id: e.target.value })}>
                      <option value="">Assign reviewer (optional)</option>
                      {reviewers.map((reviewer) => (
                        <option key={reviewer.id} value={reviewer.id}>{reviewer.name} ({reviewer.email})</option>
                      ))}
                    </select>
                    <button style={buttonStyle} type="submit">Create request</button>
                  </form>
                </div>

                <div style={{ ...panelStyle, background: "linear-gradient(180deg, #fff 0%, #f9fafb 100%)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <h3 style={{ margin: 0 }}>Recent activity</h3>
                    <span style={{ ...statPillStyle, background: "#ecfdf3", color: "#16a34a" }}>Live</span>
                  </div>
                  <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                    {recentActivity.map((request) => (
                      <div key={request.id} style={{ border: "1px solid #eef2ff", borderRadius: 14, padding: 12, background: "#f8fafc" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <strong style={{ fontSize: 14 }}>{request.title}</strong>
                          <span style={{ ...statusBadgeStyle, ...STATUS_STYLES[request.status] }}>{request.status}</span>
                        </div>
                        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>{formatDate(request.updated_at || request.created_at)}</p>
                      </div>
                    ))}
                    {recentActivity.length === 0 && <p style={{ margin: 0, color: "#64748b" }}>No activity yet.</p>}
                  </div>
                </div>
              </div>

              <div style={{ ...panelStyle, background: "linear-gradient(180deg, #fff 0%, #f8fafc 100%)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div>
                    <p style={{ margin: 0, color: "#2563eb", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.3 }}>Request management</p>
                    <h3 style={{ margin: "6px 0 0" }}>My requests</h3>
                  </div>
                  <span style={{ ...statPillStyle, background: "#eef2ff", color: "#4338ca" }}>{requests.length} total</span>
                </div>
                <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
                  {requests.map((request) => (
                    <div key={request.id} style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 16, background: "#fff" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <h3 style={{ margin: 0 }}>{request.title}</h3>
                            <span style={{ ...statusBadgeStyle, ...STATUS_STYLES[request.status] }}>{request.status}</span>
                          </div>
                          <p style={{ margin: "10px 0", color: "#475569" }}>{request.description}</p>
                          <div style={{ color: "#64748b", fontSize: 13 }}>
                            Reviewer: {reviewers.find((r) => r.id === request.reviewer_id)?.name || request.reviewer_id || "None"} | Priority: {request.priority}
                          </div>
                        </div>
                      </div>

                      {editingRequestId === request.id ? (
                        <form onSubmit={handleUpdateRequest} style={{ display: "grid", gap: 10, marginTop: 12 }}>
                          <input style={inputStyle} value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                          <textarea style={{ ...inputStyle, minHeight: 90 }} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                          <select style={inputStyle} value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}>
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">High</option>
                          </select>
                          <select style={inputStyle} value={editForm.reviewer_id} onChange={(e) => setEditForm({ ...editForm, reviewer_id: e.target.value })}>
                            <option value="">Assign reviewer (optional)</option>
                            {reviewers.map((reviewer) => (
                              <option key={reviewer.id} value={reviewer.id}>{reviewer.name} ({reviewer.email})</option>
                            ))}
                          </select>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button style={buttonStyle} type="submit">Save</button>
                            <button style={secondaryButtonStyle} type="button" onClick={() => setEditingRequestId(null)}>Cancel</button>
                          </div>
                        </form>
                      ) : (
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <button style={buttonStyle} onClick={() => startEditing(request)}>Edit</button>
                          <button style={deleteButtonStyle} onClick={() => handleDeleteRequest(request.id)}>Delete</button>
                          <button style={secondaryButtonStyle} onClick={() => handleViewRequest(request.id)}>View details</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {selectedRequest && (
                  <div style={{ marginTop: 18, border: "1px solid #e2e8f0", borderRadius: 18, padding: 18, background: "linear-gradient(180deg, #f8fafc 0%, #f5f3ff 100%)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <div>
                        <p style={{ margin: 0, color: "#6d28d9", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.3 }}>Request details</p>
                        <h3 style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 800 }}>{selectedRequest.title}</h3>
                      </div>
                      <span style={{ ...statusBadgeStyle, ...STATUS_STYLES[selectedRequest.status] }}>{selectedRequest.status}</span>
                    </div>
                    <p style={{ color: "#475569", lineHeight: 1.7, marginTop: 12 }}>{selectedRequest.description}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginTop: 16 }}>
                      <div style={{ ...statCardStyle, background: "#fff" }}><strong>{selectedRequest.priority}</strong><span>Priority</span></div>
                      <div style={{ ...statCardStyle, background: "#fff" }}><strong>{reviewers.find((r) => r.id === selectedRequest.reviewer_id)?.name || selectedRequest.reviewer_id || "None"}</strong><span>Reviewer</span></div>
                      <div style={{ ...statCardStyle, background: "#fff" }}><strong>{formatDate(selectedRequest.created_at)}</strong><span>Created</span></div>
                      <div style={{ ...statCardStyle, background: "#fff" }}><strong>{formatDate(selectedRequest.updated_at)}</strong><span>Updated</span></div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

const panelStyle = {
  background: "#fff",
  borderRadius: 22,
  padding: 24,
  boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
  border: "1px solid #eef2ff",
}

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #d7deea",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  background: "#f8fafc",
}

const labelStyle = {
  fontSize: 13,
  color: "#334155",
  fontWeight: 700,
}

const buttonStyle = {
  padding: "12px 16px",
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(90deg, #2563eb, #7c3aed)",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 10px 18px rgba(37, 99, 235, 0.18)",
}

const secondaryButtonStyle = {
  ...buttonStyle,
  background: "#eef2ff",
  color: "#0f172a",
}

const logoutButtonStyle = {
  ...buttonStyle,
  background: "#0f172a",
}

const loginButtonStyle = {
  ...buttonStyle,
  background: "linear-gradient(90deg, #16a34a, #15803d)",
}

const loadingStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f8fafc",
  fontSize: 18,
  fontWeight: 600,
}

const emptyStateStyle = {
  ...panelStyle,
  textAlign: "center",
  padding: "48px 24px",
}

const statPillStyle = {
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 999,
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 700,
}

const requestListButtonStyle = {
  width: "100%",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: "14px 16px",
  background: "#fff",
  cursor: "pointer",
  textAlign: "left",
  transition: "transform 0.15s ease, box-shadow 0.15s ease",
}

const statusBadgeStyle = {
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 800,
  border: "1px solid transparent",
  textTransform: "uppercase",
  letterSpacing: 0.6,
}

const statCardStyle = {
  background: "#f8fafc",
  borderRadius: 14,
  padding: "12px 10px",
  display: "grid",
  gap: 4,
  textAlign: "center",
  border: "1px solid #e2e8f0",
}

const deleteButtonStyle = {
  ...buttonStyle,
  background: "linear-gradient(90deg, #f87171, #dc2626)",
}
