import React, { useState, useEffect } from "react";
import "./zCnrNumber.css";

function CnrNumber({ prefilledCnr, clearPrefill, forceSearchOnLoad, clearForceSearch, user }) {
    const [cnr, setCnr] = useState("");
    const [captcha, setCaptcha] = useState("");
    const [captchaImage, setCaptchaImage] = useState("");
    const [sessionId, setSessionId] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [activeTab, setActiveTab] = useState("info");
    const [followed, setFollowed] = useState(false);

    // Backend URL
    const BASE_URL = "http://localhost:5080/api/ECourt";

    // Load captcha from backend
    const refreshCaptcha = async () => {
        try {
            setCaptchaImage("");
            const response = await fetch(`${BASE_URL}/captcha`);
            const data = await response.json();

            // Save session id
            setSessionId(data.sessionId);

            // Convert base64 into image src
            setCaptchaImage(`data:image/png;base64,${data.captchaBase64}`);
        } catch (error) {
            console.error("Error refreshing CAPTCHA:", error);
        }
    };

    // Check followed status of a specific CNR number
    const checkFollowedStatus = async (cnrNumber) => {
        if (!cnrNumber) return;
        try {
            const response = await fetch(`${BASE_URL}/followed-status/${cnrNumber.trim()}`, {
                headers: {
                    "Authorization": `Bearer ${user?.token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setFollowed(data.followed);
            }
        } catch (error) {
            console.error("Error checking followed status:", error);
        }
    };

    // Toggle follow status of a CNR
    const handleToggleFollow = async (cnrNumber) => {
        if (!cnrNumber) return;
        try {
            setLoading(true);
            if (followed) {
                // Unfollow case
                const response = await fetch(`${BASE_URL}/unfollow/${cnrNumber.trim()}`, {
                    method: "DELETE",
                    headers: {
                        "Authorization": `Bearer ${user?.token}`
                    }
                });
                if (response.ok) {
                    setFollowed(false);
                } else {
                    const data = await response.json();
                    throw new Error(data.error || "Failed to unfollow case.");
                }
            } else {
                // Follow case
                const response = await fetch(`${BASE_URL}/follow`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${user?.token}`
                    },
                    body: JSON.stringify({ cnrNumber: cnrNumber.trim() })
                });
                if (response.ok) {
                    setFollowed(true);
                } else {
                    const data = await response.json();
                    throw new Error(data.error || "Failed to follow case.");
                }
            }
        } catch (error) {
            console.error("Toggle follow failed:", error);
            alert(error.message || "Failed to toggle follow status.");
        } finally {
            setLoading(false);
        }
    };

    // DO NOT load captcha automatically on mount. This completely prevents unnecessary hits to the eCourts website!
    useEffect(() => {
        // refreshCaptcha(); // Removed to support pure lazy loading
    }, []);

    // Handle Prefills from Dashboard
    useEffect(() => {
        if (prefilledCnr) {
            setCnr(prefilledCnr);
            if (forceSearchOnLoad) {
                // Instantly trigger search using the prefilled value
                triggerAutoSearch(prefilledCnr);
            }
            if (clearPrefill) clearPrefill();
            if (clearForceSearch) clearForceSearch();
        }
    }, [prefilledCnr, forceSearchOnLoad]);

    // Search case (Manual Search)
    const handleSearch = async () => {
        if (!cnr) {
            alert("Please enter the CNR number.");
            return;
        }

        // 1. If CAPTCHA has not been fetched yet, check local PostgreSQL cache first!
        if (!sessionId) {
            try {
                setLoading(true);
                setResult(null);
                setActiveTab("info");

                const response = await fetch(`${BASE_URL}/case/${cnr.trim()}`);
                if (response.ok) {
                    const data = await response.json();
                    setResult(data);
                    setLoading(false);
                    // Check follow status instantly
                    checkFollowedStatus(cnr.trim());
                    return; // Retreived from PG Cache! Absolutely zero requests sent to eCourts.
                }
            } catch (error) {
                console.error("Database cache lookup failed:", error);
            } finally {
                setLoading(false);
            }

            // 2. Case not found in cache: Initialize Playwright session and fetch CAPTCHA lazily on-demand
            setLoading(true);
            try {
                await refreshCaptcha();
                alert("Case not found in database. Initializing live eCourts scraper session... Please enter the CAPTCHA when it loads.");
            } catch (err) {
                alert("Failed to initialize scraper session. Please try again.");
            } finally {
                setLoading(false);
            }
            return;
        }

        // If CAPTCHA is displayed but user hasn't entered code
        if (!captcha) {
            alert("Please enter the CAPTCHA code shown.");
            return;
        }

        // 3. CAPTCHA is filled: Proceed to do a live manual search
        try {
            setLoading(true);
            setResult(null);
            setActiveTab("info");

            const response = await fetch(`${BASE_URL}/search`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${user?.token}`
                },
                body: JSON.stringify({
                    sessionId: sessionId,
                    cnrNumber: cnr.trim(),
                    captcha: captcha.trim()
                })
            });

            const data = await response.json();
            setResult(data);

            if (data.success && data.caseDetails) {
                checkFollowedStatus(cnr.trim());
            }

            // Clean up session since it's consumed
            setSessionId("");
            setCaptchaImage("");
            setCaptcha("");
        } catch (error) {
            console.error("Search API failed:", error);
            setResult({
                success: false,
                message: "Failed to connect to server. Please ensure backend is running."
            });
            setSessionId("");
            setCaptchaImage("");
            setCaptcha("");
        } finally {
            setLoading(false);
        }
    };

    // Helper to trigger automated search directly (used for dashboard navigations)
    const triggerAutoSearch = async (cnrVal) => {
        if (!cnrVal) return;
        try {
            setLoading(true);
            setResult(null);
            setActiveTab("info");

            const response = await fetch(`${BASE_URL}/autosearch`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${user?.token}`
                },
                body: JSON.stringify({
                    cnrNumber: cnrVal.trim()
                })
            });

            const data = await response.json();
            setResult(data);

            if (data.success && data.caseDetails) {
                checkFollowedStatus(cnrVal.trim());
            }

            refreshCaptcha();
            setCaptcha("");
        } catch (error) {
            console.error("AutoSearch API failed:", error);
            setResult({
                success: false,
                message: "Failed to execute automated search pipeline. Ensure backend is running."
            });
            refreshCaptcha();
        } finally {
            setLoading(false);
        }
    };

    // Admin function to delete case cache from PG Database
    const handleDeleteCache = async (cnrVal) => {
        if (!window.confirm(`Are you sure you want to delete case ${cnrVal} from the database cache?`)) {
            return;
        }
        try {
            setLoading(true);
            const response = await fetch(`${BASE_URL}/case/${cnrVal.trim()}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${user?.token}`
                }
            });
            const data = await response.json();
            if (response.ok) {
                alert(data.message || "Case successfully removed from database cache!");
                setResult(null);
            } else {
                throw new Error(data.error || "Failed to delete case cache.");
            }
        } catch (error) {
            console.error("Delete cache failed:", error);
            alert(error.message || "Failed to delete cache from server.");
        } finally {
            setLoading(false);
        }
    };

    // Automated OCR Search Case (from UI button)
    const handleAutoSearch = async () => {
        if (!cnr) {
            alert("Please enter the CNR number.");
            return;
        }
        await triggerAutoSearch(cnr);
    };

    const caseData = result?.caseDetails;

    // Determine status styling class
    const getStatusClass = (status) => {
        if (!status) return "default";
        const lower = status.toLowerCase();
        if (lower.includes("pending") || lower.includes("hearing")) return "pending";
        if (lower.includes("disposed") || lower.includes("decided")) return "disposed";
        return "default";
    };

    return (
        <div className="page">
            {/* Search Panel Card */}
            <div className="card">
                <h1>eCourts Case Portal</h1>
                <p className="subtitle">
                    Comprehensive Centralized Search by 16-Digit CNR Number
                </p>

                {/* CNR Input */}
                <div className="input-group">
                    <input
                        type="text"
                        placeholder="Enter 16-digit CNR Number (e.g. MHAU0199999992015)"
                        value={cnr}
                        onChange={(e) => setCnr(e.target.value)}
                    />
                </div>

                <p className="required">
                    * CNR Number is required
                </p>

                {/* Captcha */}
                <div className="captcha-section">
                    <span className="label">
                        CAPTCHA <span className="star">*</span>
                    </span>

                    {!sessionId ? (
                        <button
                            type="button"
                            className="fetch-captcha-btn"
                            onClick={refreshCaptcha}
                            disabled={loading}
                            style={{
                                background: 'var(--accent-bg)',
                                border: '1px dashed var(--accent-border)',
                                color: 'var(--accent)',
                                padding: '12px 24px',
                                borderRadius: '12px',
                                fontWeight: '600',
                                fontSize: '14px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                flexGrow: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                boxShadow: 'var(--shadow)',
                                outline: 'none'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--accent)';
                                e.currentTarget.style.color = '#fff';
                                e.currentTarget.style.borderStyle = 'solid';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'var(--accent-bg)';
                                e.currentTarget.style.color = 'var(--accent)';
                                e.currentTarget.style.borderStyle = 'dashed';
                            }}
                        >
                            {loading ? '🔌 Initializing Scraper session...' : '⚡ Get CAPTCHA Challenge'}
                        </button>
                    ) : (
                        <>
                            <div className="captcha-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 150 }}>
                                {captchaImage ? (
                                    <img src={captchaImage} alt="CAPTCHA Challenge" />
                                ) : (
                                    <span style={{ fontSize: 11, color: "#94a3b8" }}>Loading fresh CAPTCHA...</span>
                                )}
                            </div>

                            {/* Refresh Button */}
                            <button
                                className="icon-btn"
                                onClick={refreshCaptcha}
                                disabled={loading}
                                title="Reload Captcha Image"
                            >
                                Refresh
                            </button>

                            <input
                                type="text"
                                placeholder="Enter Captcha"
                                value={captcha}
                                onChange={(e) => setCaptcha(e.target.value)}
                                className="captcha-input"
                                autoFocus
                            />
                        </>
                    )}
                </div>

                {/* Buttons */}
                <div className="buttons">
                    <button
                        className="autosearch-btn"
                        onClick={handleAutoSearch}
                        disabled={loading}
                        title="Bypasses CAPTCHA automatically using integrated OCR"
                    >
                        {loading ? " Solving CAPTCHA & Scraping..." : " Automated Search (OCR Bypassed)"}
                    </button>
                    <button
                        className="search"
                        onClick={handleSearch}
                        disabled={loading}
                        title="Requires manually entering the CAPTCHA code above"
                    >
                        Manual Search
                    </button>
                    <button
                        className="reset"
                        onClick={() => {
                            setCnr("");
                            setCaptcha("");
                            setResult(null);
                        }}
                        disabled={loading}
                    >
                        Reset
                    </button>
                </div>

                {/* Show Error Message if Search returned success = false */}
                {result && !result.success && (
                    <div className="error-message">
                        <strong>⚠️ Notice:</strong> {result.message || "Case details could not be retrieved."}
                    </div>
                )}
            </div>

            {/* Feature-rich Premium Results Panel */}
            {result && result.success && caseData && (
                <div className="results-container">
                    {/* Header */}
                    <div className="results-header">
                        <div>
                            <h2>🏛️ {caseData.caseTitle || "Case Record Details"}</h2>
                            {caseData.courtEstablishment && (
                                <div style={{ fontSize: 14, color: "#94a3b8", marginTop: 4 }}>
                                    📍 {caseData.courtEstablishment}
                                </div>
                            )}
                        </div>
                        <div className="header-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            {/* Follow/Unfollow Button */}
                            <button
                                className="follow-btn"
                                onClick={() => handleToggleFollow(caseData.cnrNumber)}
                                disabled={loading}
                                title={followed ? "Stop tracking this case" : "Track updates for this case"}
                                style={{
                                    background: followed ? 'rgba(168, 85, 247, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                                    border: followed ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid var(--border)',
                                    color: followed ? '#a855f7' : 'var(--text-h)',
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    fontWeight: '600',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    outline: 'none'
                                }}
                                onMouseEnter={(e) => {
                                    if (followed) {
                                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                                        e.currentTarget.style.color = '#ef4444';
                                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                                    } else {
                                        e.currentTarget.style.background = 'var(--accent-bg)';
                                        e.currentTarget.style.color = 'var(--accent)';
                                        e.currentTarget.style.borderColor = 'var(--accent-border)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = followed ? 'rgba(168, 85, 247, 0.1)' : 'rgba(255, 255, 255, 0.05)';
                                    e.currentTarget.style.color = followed ? '#a855f7' : 'var(--text-h)';
                                    e.currentTarget.style.borderColor = followed ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid var(--border)';
                                }}
                            >
                                {followed ? '★ Following' : '☆ Follow Case'}
                            </button>

                            <div className="cnr-badge">
                                CNR: {caseData.cnrNumber}
                            </div>
                            {user?.role === 'Admin' && (
                                <button
                                    className="delete-cache-btn"
                                    onClick={() => handleDeleteCache(caseData.cnrNumber)}
                                    title="Delete this case from PostgreSQL Database Cache (Admin Only)"
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        border: '1px solid rgba(239, 68, 68, 0.2)',
                                        color: '#ef4444',
                                        padding: '8px 16px',
                                        borderRadius: '8px',
                                        fontWeight: '600',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        outline: 'none'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = '#ef4444';
                                        e.currentTarget.style.color = '#fff';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                                        e.currentTarget.style.color = '#ef4444';
                                    }}
                                >
                                    🗑️ Delete Cache
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Navigation Tabs System */}
                    <div className="results-tabs">
                        <button
                            className={`tab-btn ${activeTab === "info" ? "active" : ""}`}
                            onClick={() => setActiveTab("info")}
                        >
                            📋 General Info
                        </button>
                        <button
                            className={`tab-btn ${activeTab === "parties" ? "active" : ""}`}
                            onClick={() => setActiveTab("parties")}
                        >
                            👥 Parties & Advocates
                        </button>
                        <button
                            className={`tab-btn ${activeTab === "acts" ? "active" : ""}`}
                            onClick={() => setActiveTab("acts")}
                        >
                            📜 Acts ({caseData.acts?.length || 0})
                        </button>
                        <button
                            className={`tab-btn ${activeTab === "hearings" ? "active" : ""}`}
                            onClick={() => setActiveTab("hearings")}
                        >
                            🗓️ Hearing History ({caseData.hearings?.length || 0})
                        </button>
                        <button
                            className={`tab-btn ${activeTab === "orders" ? "active" : ""}`}
                            onClick={() => setActiveTab("orders")}
                        >
                            ⚖️ Orders ({caseData.orders?.length || 0})
                        </button>
                        <button
                            className={`tab-btn ${activeTab === "processes" ? "active" : ""}`}
                            onClick={() => setActiveTab("processes")}
                        >
                            🖨️ Processes ({caseData.processes?.length || 0})
                        </button>
                        <button
                            className={`tab-btn ${activeTab === "transfers" ? "active" : ""}`}
                            onClick={() => setActiveTab("transfers")}
                        >
                            🔄 Transfers ({caseData.transferDetails?.length || 0})
                        </button>
                        <button
                            className={`tab-btn ${activeTab === "ia" ? "active" : ""}`}
                            onClick={() => setActiveTab("ia")}
                        >
                            📄 IA Status ({caseData.iaStatuses?.length || 0})
                        </button>
                    </div>

                    {/* Tabs Content Views */}
                    <div className="tab-content">
                        {/* 1. General Info View */}
                        {activeTab === "info" && (
                            <div className="info-grid">
                                <div className="info-card">
                                    <div className="info-label">Case Type</div>
                                    <div className="info-value">{caseData.caseType || "N/A"}</div>
                                </div>
                                <div className="info-card">
                                    <div className="info-label">Filing Number</div>
                                    <div className="info-value">{caseData.filingNumber || "N/A"}</div>
                                </div>
                                <div className="info-card">
                                    <div className="info-label">Filing Date</div>
                                    <div className="info-value">{caseData.filingDate || "N/A"}</div>
                                </div>
                                <div className="info-card">
                                    <div className="info-label">Registration Number</div>
                                    <div className="info-value">{caseData.registrationNumber || "N/A"}</div>
                                </div>
                                <div className="info-card">
                                    <div className="info-label">Registration Date</div>
                                    <div className="info-value">{caseData.registrationDate || "N/A"}</div>
                                </div>
                                <div className="info-card">
                                    <div className="info-label">Case Stage / Status</div>
                                    <div className="info-value">
                                        <span className={`status-badge ${getStatusClass(caseData.caseStatus)}`}>
                                            {caseData.caseStatus || "Unspecified"}
                                        </span>
                                    </div>
                                </div>
                                <div className="info-card">
                                    <div className="info-label">First Hearing Date</div>
                                    <div className="info-value">{caseData.firstHearingDate || "N/A"}</div>
                                </div>
                                {caseData.nextHearingDate ? (
                                    <div className="info-card">
                                        <div className="info-label">Next Hearing Date</div>
                                        <div className="info-value">{caseData.nextHearingDate}</div>
                                    </div>
                                ) : null}
                                {caseData.decisionDate ? (
                                    <div className="info-card">
                                        <div className="info-label">Decision Date</div>
                                        <div className="info-value">{caseData.decisionDate}</div>
                                    </div>
                                ) : null}
                                {caseData.judge ? (
                                    <div className="info-card">
                                        <div className="info-label">Presiding Judge / Bench</div>
                                        <div className="info-value">{caseData.judge}</div>
                                    </div>
                                ) : null}
                            </div>
                        )}

                        {/* 2. Parties View */}
                        {activeTab === "parties" && (
                            <div>
                                <div className="party-section">
                                    <div className="section-title"> Petitioner(s)</div>
                                    {caseData.petitioners && caseData.petitioners.length > 0 ? (
                                        <ul className="party-list">
                                            {caseData.petitioners.map((p, i) => (
                                                <li key={i}>{p}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p style={{ color: "#94a3b8", fontSize: 14 }}>No petitioner listed</p>
                                    )}
                                    {caseData.petitionerAdvocate && (
                                        <div className="advocate-box">
                                            <span>💼 <strong>Petitioner Advocate:</strong> {caseData.petitionerAdvocate}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="party-section" style={{ marginTop: 32 }}>
                                    <div className="section-title">⚔️ Respondent(s)</div>
                                    {caseData.respondents && caseData.respondents.length > 0 ? (
                                        <ul className="party-list" style={{ borderLeftColor: "#ec4899" }}>
                                            {caseData.respondents.map((r, i) => (
                                                <li key={i} style={{ borderLeftColor: "#ec4899" }}>{r}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p style={{ color: "#94a3b8", fontSize: 14 }}>No respondent listed</p>
                                    )}
                                    {caseData.respondentAdvocate && (
                                        <div className="advocate-box" style={{ background: "rgba(236, 72, 153, 0.1)", borderColor: "rgba(236, 72, 153, 0.2)", color: "#f472b6" }}>
                                            <span>💼 <strong>Respondent Advocate:</strong> {caseData.respondentAdvocate}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 3. Acts View */}
                        {activeTab === "acts" && (
                            <div>
                                {caseData.acts && caseData.acts.length > 0 ? (
                                    <div className="table-responsive">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>Act / Section Detail</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {caseData.acts.map((act, idx) => (
                                                    <tr key={idx}>
                                                        <td style={{ width: 60, color: "#94a3b8", fontWeight: 600 }}>{idx + 1}</td>
                                                        <td style={{ fontWeight: 500 }}>{act}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="empty-state">No statutory Acts or sections mapped to this case record.</div>
                                )}
                            </div>
                        )}

                        {/* 4. Hearing History View */}
                        {activeTab === "hearings" && (
                            <div>
                                {caseData.hearings && caseData.hearings.length > 0 ? (
                                    <div className="table-responsive">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Judge</th>
                                                    <th>Business On Date</th>
                                                    <th>Hearing Date</th>
                                                    <th>Purpose of Hearing</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {caseData.hearings.map((h, idx) => (
                                                    <tr key={idx}>
                                                        <td style={{ fontWeight: 500 }}>{h.judge || "-"}</td>
                                                        <td>{h.businessOnDate || "-"}</td>
                                                        <td style={{ color: "#60a5fa", fontWeight: 600 }}>{h.hearingDate || "-"}</td>
                                                        <td>{h.purpose || "-"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="empty-state">No past hearing dates recorded for this case.</div>
                                )}
                            </div>
                        )}

                        {/* 5. Orders View */}
                        {activeTab === "orders" && (
                            <div>
                                {caseData.orders && caseData.orders.length > 0 ? (
                                    <div className="table-responsive">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Order Number / Label</th>
                                                    <th>Order Date</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {caseData.orders.map((o, idx) => (
                                                    <tr key={idx}>
                                                        <td style={{ fontWeight: 600, color: "#e2e8f0" }}>{o.orderNumber || "-"}</td>
                                                        <td style={{ color: "#4ade80", fontWeight: 500 }}>📅 {o.orderDate || "-"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="empty-state">No uploaded court orders found.</div>
                                )}
                            </div>
                        )}

                        {/* 6. Processes View */}
                        {activeTab === "processes" && (
                            <div>
                                {caseData.processes && caseData.processes.length > 0 ? (
                                    <div className="table-responsive">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Process ID</th>
                                                    <th>Process Title / Type</th>
                                                    <th>Issued / Process Date</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {caseData.processes.map((p, idx) => (
                                                    <tr key={idx}>
                                                        <td style={{ fontFamily: "monospace", color: "#f472b6" }}>{p.processId || "-"}</td>
                                                        <td style={{ fontWeight: 500 }}>{p.title || "-"}</td>
                                                        <td>{p.date || "-"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="empty-state">No process issuance details documented.</div>
                                )}
                            </div>
                        )}

                        {/* 7. Transfers View */}
                        {activeTab === "transfers" && (
                            <div>
                                {caseData.transferDetails && caseData.transferDetails.length > 0 ? (
                                    <div className="table-responsive">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Registration No.</th>
                                                    <th>Transfer Date</th>
                                                    <th>From Court Establishment</th>
                                                    <th>To Court Establishment</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {caseData.transferDetails.map((t, idx) => (
                                                    <tr key={idx}>
                                                        <td style={{ fontWeight: 600 }}>{t.registrationNumber || "-"}</td>
                                                        <td style={{ color: "#fbbf24" }}>{t.transferDate || "-"}</td>
                                                        <td>{t.fromCourt || "-"}</td>
                                                        <td style={{ color: "#60a5fa", fontWeight: 500 }}>{t.toCourt || "-"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="empty-state">No internal case transfer records available.</div>
                                )}
                            </div>
                        )}

                        {/* 8. IA Status View */}
                        {activeTab === "ia" && (
                            <div>
                                {caseData.iaStatuses && caseData.iaStatuses.length > 0 ? (
                                    <div className="table-responsive">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>IA Number</th>
                                                    <th>Party Name</th>
                                                    <th>Filing Date</th>
                                                    <th>Next Date</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {caseData.iaStatuses.map((ia, idx) => (
                                                    <tr key={idx}>
                                                        <td style={{ fontWeight: 600, color: "#38bdf8" }}>{ia.iaNumber || "-"}</td>
                                                        <td>{ia.partyName || "-"}</td>
                                                        <td>{ia.filingDate || "-"}</td>
                                                        <td>{ia.nextDate || "-"}</td>
                                                        <td>
                                                            <span className="status-badge default" style={{ fontSize: 12, padding: "4px 8px" }}>
                                                                {ia.status || "-"}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="empty-state">No Interlocutory Applications (IA) status entries found.</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default CnrNumber;