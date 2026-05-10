import { useState, useRef, useEffect } from "react";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";
const font = "'Poppins', sans-serif";

// Helpers
const getScoreColor = (score) => {
  if (score >= 75) return { stroke: "#22c55e", track: "#bbf7d0", bg: "#f0fdf4", text: "#15803d", badge: "#dcfce7" };
  if (score >= 50) return { stroke: "#f59e0b", track: "#fde68a", bg: "#fffbeb", text: "#b45309", badge: "#fef3c7" };
  return { stroke: "#ef4444", track: "#fecaca", bg: "#fff5f5", text: "#dc2626", badge: "#fee2e2" };
};

function formatResumeHTML(r) {
  const section = (title, content) => content ? `
    <div style="margin-top:12px;">
      <div style="font-size:10.5pt;font-weight:bold;text-transform:uppercase;border-bottom:1.5px solid #1a1a2e;padding-bottom:2px;margin-bottom:6px;color:#1a1a2e;">${title}</div>
      ${content}
    </div>` : "";

  const contact = [r.contact?.email, r.contact?.phone, r.contact?.location, r.contact?.linkedin, r.contact?.website].filter(Boolean).join(" &nbsp;|&nbsp; ");

  const experience = r.experience?.map(job => `
    <div style="margin-bottom:8px;">
      <table width="100%" style="border-collapse:collapse;"><tr>
        <td style="font-size:10pt;font-weight:bold;color:#2d2d2d;">${job.title}</td>
        <td style="font-size:9pt;color:#555;text-align:right;">${job.startDate} – ${job.endDate}</td>
      </tr></table>
      <div style="font-size:9.5pt;font-style:italic;color:#555;margin-bottom:3px;">${job.company}${job.location ? " · " + job.location : ""}</div>
      <ul style="margin:2px 0 0 16px;padding:0;">${job.bullets?.map(b => `<li style="font-size:9.5pt;margin-bottom:2px;">${b}</li>`).join("") || ""}</ul>
    </div>`).join("") || "";

  const education = r.education?.map(edu => `
    <div style="margin-bottom:6px;">
      <table width="100%" style="border-collapse:collapse;"><tr>
        <td style="font-size:10pt;font-weight:bold;color:#2d2d2d;">${[edu.degree, edu.major].filter(Boolean).join(" in ")}</td>
        <td style="font-size:9pt;color:#555;text-align:right;">${edu.graduationYear || ""}</td>
      </tr></table>
      <div style="font-size:9.5pt;font-style:italic;color:#555;">${edu.school}${edu.location ? " · " + edu.location : ""}${edu.gpa ? " · GPA: " + edu.gpa : ""}</div>
    </div>`).join("") || "";

  const skills = r.skills?.length ? `<div style="font-size:9.5pt;line-height:1.6;">${r.skills.join(" &nbsp;•&nbsp; ")}</div>` : "";
  const certs = r.certifications?.length ? `<ul style="margin:2px 0 0 16px;padding:0;">${r.certifications.map(c => `<li style="font-size:9.5pt;margin-bottom:2px;">${c}</li>`).join("")}</ul>` : "";
  const projects = r.projects?.map(p => `
    <div style="margin-bottom:6px;">
      <div style="font-size:10pt;font-weight:bold;">${p.name}</div>
      ${p.description ? `<div style="font-size:9.5pt;font-style:italic;color:#555;">${p.description}</div>` : ""}
      <ul style="margin:2px 0 0 16px;padding:0;">${p.bullets?.map(b => `<li style="font-size:9.5pt;">${b}</li>`).join("") || ""}</ul>
    </div>`).join("") || "";

  return `
    <div style="font-family:Calibri,sans-serif;max-width:720px;margin:0 auto;padding:0.5in;color:#2d2d2d;">
      <h1 style="font-size:22pt;text-align:center;margin:0 0 4px;color:#1a1a2e;">${r.name}</h1>
      <div style="text-align:center;font-size:9pt;color:#555;border-bottom:1px solid #bbb;padding-bottom:8px;margin-bottom:4px;">${contact}</div>
      ${section("Professional Summary", r.summary ? `<p style="font-size:9.5pt;margin:0;line-height:1.5;">${r.summary}</p>` : "")}
      ${section("Skills", skills)}
      ${section("Experience", experience)}
      ${section("Education", education)}
      ${section("Certifications", certs)}
      ${section("Projects", projects)}
    </div>`;
}

async function downloadPDF(structured, apiUrl) {
  const res = await fetch(`${apiUrl}/api/generate-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(structured),
  });
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ats_resume.pdf";
  a.click();
}

function downloadDoc(structured, filename) {
  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office'
    xmlns:w='urn:schemas-microsoft-com:office:word'
    xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>ATS Resume</title></head>
    <body>${formatResumeHTML(structured)}</body></html>`;
  const blob = new Blob([html], { type: "application/msword" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}


// Sub components
const ScoreCircle = ({ score }) => {
  const [anim, setAnim] = useState(10);
  useEffect(() => { const t = setTimeout(() => setAnim(score), 100); return () => clearTimeout(t); }, [score]);
  const c = getScoreColor(score);
  const r = 52, circ = 2 * Math.PI * r;
  const dash = ((anim - 10) / 90) * circ;
  const label = score >= 75 ? "Strong match 🎉" : score >= 50 ? "Moderate match 👍" : "Weak match 💪";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <svg width="148" height="148" viewBox="0 0 148 148">
        <circle cx="74" cy="74" r={r} fill={c.bg} stroke={c.track} strokeWidth="22" />
        <circle cx="74" cy="74" r={r} fill="none" stroke={c.stroke} strokeWidth="22"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 74 74)"
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)" }} />
        <text x="74" y="68" textAnchor="middle" fontSize="32" fontWeight="700" fill={c.text} style={{ fontFamily: font }}>{score}</text>
        <text x="74" y="88" textAnchor="middle" fontSize="12" fill={c.text} opacity="0.7" style={{ fontFamily: font }}>out of 100</text>
      </svg>
      <span style={{ fontSize: 14, fontWeight: 600, color: c.text, background: c.badge, padding: "5px 16px", borderRadius: 20 }}>{label}</span>
    </div>
  );
};

const Chip = ({ label, color }) => {
  const s = color === "green"
    ? { bg: "#dcfce7", color: "#15803d", border: "#86efac" }
    : { bg: "#fee2e2", color: "#dc2626", border: "#fca5a5" };
  return (
    <span style={{ display: "inline-block", padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, margin: "3px 3px 3px 0", background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{label}</span>
  );
};

const Tab = ({ label, active, onClick, accent }) => (
  <button onClick={onClick} style={{
    flex: 1, padding: "10px 0", fontSize: 14, fontWeight: active ? 600 : 400,
    background: active ? accent : "transparent", color: active ? "#fff" : "#9ca3af",
    border: "none", borderRadius: 12, cursor: "pointer", fontFamily: font,
    transition: "all 0.2s", boxShadow: active ? "0 2px 8px rgba(0,0,0,0.15)" : "none"
  }}>{label}</button>
);

const ANALYSIS_STEPS = [
  { icon: "📄", text: "Reading your resume…", sub: "Extracting skills and experience" },
  { icon: "🔍", text: "Scanning job description…", sub: "Identifying key requirements" },
  { icon: "🧠", text: "Running AI analysis…", sub: "Comparing your profile to the role" },
  { icon: "📊", text: "Calculating match score…", sub: "Almost there!" },
];

const TAILOR_STEPS = [
  { icon: "✍️", text: "Rewriting your resume…", sub: "Aligning your experience" },
  { icon: "🔑", text: "Injecting keywords…", sub: "Matching job requirements" },
  { icon: "💎", text: "Polishing bullet points…", sub: "Adding impact and clarity" },
  { icon: "🎨", text: "Finalizing your resume…", sub: "Almost ready!" },
];

const LoadingScreen = ({ steps }) => {
  const [step, setStep] = useState(0);
  const [dots, setDots] = useState(0);
  const [particles] = useState(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i, x: 15 + Math.random() * 70, y: 10 + Math.random() * 80,
      size: 4 + Math.random() * 8, delay: Math.random() * 2, dur: 2 + Math.random() * 2,
      color: ["#c4b5fd","#a78bfa","#818cf8","#6ee7b7","#fde68a"][Math.floor(Math.random() * 5)]
    }))
  );
  useEffect(() => {
    const i1 = setInterval(() => setStep(s => (s + 1) % steps.length), 1800);
    const i2 = setInterval(() => setDots(d => (d + 1) % 4), 400);
    return () => { clearInterval(i1); clearInterval(i2); };
  }, [steps.length]);
  const cur = steps[step];
  return (
    <div style={{ position: "relative", background: "linear-gradient(135deg,#1e1b4b,#312e81,#4c1d95)", borderRadius: 24, padding: "40px 24px", textAlign: "center", overflow: "hidden", minHeight: 280 }}>
      <style>{`
        @keyframes float{0%,100%{transform:translateY(0) scale(1);opacity:.6}50%{transform:translateY(-18px) scale(1.2);opacity:1}}
        @keyframes pulse-ring{0%{transform:scale(.8);opacity:1}100%{transform:scale(2.2);opacity:0}}
        @keyframes fade-slide{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%,100%{opacity:.4}50%{opacity:1}}
      `}</style>
      {particles.map(p => (
        <div key={p.id} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, borderRadius: "50%", background: p.color, animation: `float ${p.dur}s ${p.delay}s ease-in-out infinite`, pointerEvents: "none" }} />
      ))}
      <div style={{ position: "relative", display: "inline-block", marginBottom: 24 }}>
        <div style={{ position: "absolute", inset: -12, borderRadius: "50%", border: "3px solid rgba(167,139,250,.5)", animation: "pulse-ring 1.5s ease-out infinite" }} />
        <div style={{ position: "absolute", inset: -6, borderRadius: "50%", border: "2px solid rgba(167,139,250,.3)", animation: "pulse-ring 1.5s .4s ease-out infinite" }} />
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(255,255,255,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, border: "2px solid rgba(255,255,255,.2)" }}>
          <span key={step} style={{ animation: "fade-slide .4s ease" }}>{cur.icon}</span>
        </div>
      </div>
      <p key={`t${step}`} style={{ fontSize: 17, fontWeight: 700, color: "#fff", margin: "0 0 4px", animation: "fade-slide .4s ease", fontFamily: font }}>
        {cur.text}{".".repeat(dots)}
      </p>
      <p key={`s${step}`} style={{ fontSize: 13, color: "rgba(255,255,255,.6)", margin: 0, animation: "fade-slide .4s ease", fontFamily: font }}>{cur.sub}</p>
      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 28 }}>
        {steps.map((_, i) => (
          <div key={i} style={{ height: 6, borderRadius: 3, background: i === step ? "#a78bfa" : "rgba(255,255,255,.2)", width: i === step ? 24 : 6, transition: "all .4s ease" }} />
        ))}
      </div>
      <div style={{ marginTop: 20, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        {["Reviewing","Matching","Scoring","Comparing"].map((tag, i) => (
          <span key={i} style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,.7)", background: "rgba(255,255,255,.1)", padding: "4px 10px", borderRadius: 20, animation: `shimmer ${1 + i * .3}s ${i * .2}s infinite` }}>{tag}</span>
        ))}
      </div>
    </div>
  );
};

// Main App
export default function App() {
  const [jd, setJd] = useState("");
  const [pdfText, setPdfText] = useState("");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState(null);
  const [tailored, setTailored] = useState("");
  const [loading, setLoading] = useState(false);
  const [tailoring, setTailoring] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("analysis");
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setFileName(file.name); setError("");
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result.split(",")[1];
      try {
        const res = await fetch(`${API}/api/extract-pdf`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setPdfText(data.text);
      } catch (err) { setError("Could not read PDF: " + err.message); }
    };
    reader.readAsDataURL(file);
  };

  const analyze = async () => {
    if (!pdfText || !jd.trim()) { setError("Please upload a resume and enter a job description."); return; }
    setError(""); setLoading(true); setResult(null); setTailored("");
    try {
      const res = await fetch(`${API}/api/analyze`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: pdfText, jobDescription: jd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data); setTab("analysis");
    } catch (err) { setError("Analysis failed: " + err.message); }
    setLoading(false);
  };

  const tailorResume = async () => {
    setTailoring(true); setTailored("");
    try {
      const res = await fetch(`${API}/api/tailor`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: pdfText, jobDescription: jd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTailored(data.tailored);
    } catch (err) { setError("Tailoring failed: " + err.message); }
    setTailoring(false);
  };

  const reset = () => { setResult(null); setPdfText(""); setFileName(""); setJd(""); setError(""); setTailored(""); setTab("analysis"); };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`*{box-sizing:border-box}body{margin:0;background:#f8f7ff}@keyframes fade-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.fade-in{animation:fade-in .5s ease forwards}`}</style>

      <div style={{ fontFamily: font, maxWidth: 560, margin: "0 auto", padding: "0 1rem 3rem" }}>
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7)", borderRadius: 28, padding: "2rem 1.5rem 2.4rem", textAlign: "center", marginBottom: "1.8rem" }}>
          <div style={{ fontSize: 42, marginBottom: 8 }}>📋</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#fff", margin: "0 0 6px" }}>Resume Analyzer</h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,.8)", margin: 0 }}>Match & tailor your resume to any job</p>
        </div>

        {/* Input form */}
        {!result && !loading && (
          <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>📄 Your Resume (PDF)</label>
              <div onClick={() => fileRef.current.click()} style={{ border: `2px dashed ${pdfText ? "#22c55e" : "#c4b5fd"}`, borderRadius: 16, padding: "22px 16px", textAlign: "center", cursor: "pointer", background: pdfText ? "#f0fdf4" : "#faf5ff", transition: "all .2s" }}>
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" style={{ display: "none" }} onChange={handleFile} />
                {pdfText ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    <span style={{ fontSize: 22 }}>✅</span>
                    <span style={{ fontSize: 14, color: "#15803d", fontWeight: 600 }}>{fileName}</span>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>☁️</div>
                    <p style={{ fontSize: 14, color: "#7c3aed", fontWeight: 600, margin: 0 }}>Click to upload your resume</p>
                    <p style={{ fontSize: 12, color: "#a78bfa", margin: "4px 0 0" }}>PDF, DOC, DOCX or TXT</p>
                  </>
                )}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>💼 Job Description</label>
              <textarea value={jd} onChange={e => setJd(e.target.value)} placeholder="Paste the full job description here..."
                style={{ width: "100%", minHeight: 148, fontSize: 14, lineHeight: 1.7, borderRadius: 16, border: "2px solid #e9d5ff", padding: "13px 15px", resize: "vertical", outline: "none", background: "#faf5ff", color: "#1f2937", fontFamily: font, transition: "border .2s" }}
                onFocus={e => e.target.style.borderColor = "#a855f7"} onBlur={e => e.target.style.borderColor = "#e9d5ff"} />
            </div>

            {error && <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 12, padding: "10px 14px" }}><p style={{ color: "#dc2626", fontSize: 13, margin: 0 }}>⚠️ {error}</p></div>}

            <button onClick={analyze} disabled={!pdfText || !jd.trim()} style={{
              background: !pdfText || !jd.trim() ? "#e5e7eb" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
              color: !pdfText || !jd.trim() ? "#9ca3af" : "#fff", border: "none", borderRadius: 16,
              padding: "15px 0", fontSize: 16, fontWeight: 700, cursor: !pdfText || !jd.trim() ? "not-allowed" : "pointer",
              width: "100%", fontFamily: font, boxShadow: pdfText && jd.trim() ? "0 4px 16px rgba(99,102,241,.4)" : "none", transition: "all .2s"
            }}>🚀 Analyze Match</button>
          </div>
        )}

        {/* Loading */}
        {loading && <LoadingScreen steps={ANALYSIS_STEPS} />}

        {/* Results */}
        {result && !loading && (
          <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 6, background: "#f3f4f6", borderRadius: 16, padding: 5 }}>
              <Tab label="📊 Analysis" active={tab === "analysis"} onClick={() => setTab("analysis")} accent="linear-gradient(135deg,#6366f1,#8b5cf6)" />
              <Tab label="✏️ Tailored Resume" active={tab === "tailored"} onClick={() => setTab("tailored")} accent="linear-gradient(135deg,#22c55e,#16a34a)" />
            </div>

            {tab === "analysis" && (
              <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ background: "#fff", border: "1.5px solid #e9d5ff", borderRadius: 22, padding: "28px 24px", textAlign: "center", boxShadow: "0 4px 20px rgba(139,92,246,.1)" }}>
                  <ScoreCircle score={result.score} />
                </div>
                <div style={{ background: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "1.5px solid #86efac", borderRadius: 18, padding: "18px 20px" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#15803d", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "1px" }}>✅ Strengths</p>
                  <div>{result.strengths?.map((s, i) => <Chip key={i} label={s} color="green" />)}</div>
                </div>
                <div style={{ background: "linear-gradient(135deg,#fff5f5,#fee2e2)", border: "1.5px solid #fca5a5", borderRadius: 18, padding: "18px 20px" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "1px" }}>⚠️ Gaps</p>
                  <div>{result.gaps?.map((g, i) => <Chip key={i} label={g} color="red" />)}</div>
                </div>
                <div style={{ background: "linear-gradient(135deg,#faf5ff,#ede9fe)", border: "1.5px solid #c4b5fd", borderRadius: 18, padding: "18px 20px" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "1px" }}>💡 Tips to Improve</p>
                  {result.tips?.map((t, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                      <span style={{ background: "#7c3aed", color: "#fff", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                      <p style={{ fontSize: 14, color: "#4c1d95", margin: 0, lineHeight: 1.6 }}>{t}</p>
                    </div>
                  ))}
                </div>
                <button onClick={() => setTab("tailored")} style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", border: "none", borderRadius: 16, padding: "15px 0", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%", fontFamily: font, boxShadow: "0 4px 16px rgba(34,197,94,.35)" }}>✏️ Tailor My Resume →</button>
              </div>
            )}

            {tab === "tailored" && (
              <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {!tailored && !tailoring && (
                  <div style={{ background: "linear-gradient(135deg,#faf5ff,#ede9fe)", border: "1.5px solid #c4b5fd", borderRadius: 22, padding: "36px 24px", textAlign: "center" }}>
                    <div style={{ fontSize: 52, marginBottom: 14 }}>🪄</div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "#4c1d95", margin: "0 0 8px", fontFamily: font }}>Ready to tailor your resume?</h3>
                    <p style={{ fontSize: 14, color: "#7c3aed", margin: "0 0 24px", lineHeight: 1.6 }}>Our AI will rewrite your resume to perfectly align with the job — keeping your facts, boosting your impact.</p>
                    <button onClick={tailorResume} style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 16, padding: "14px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: font, boxShadow: "0 4px 16px rgba(99,102,241,.4)" }}>✨ Tailor My Resume Now</button>
                  </div>
                )}
                {tailoring && <LoadingScreen steps={TAILOR_STEPS} />}
                {tailored && !tailoring && (
                  <>
                    <div style={{ background: "#fff", border: "1.5px solid #86efac", borderRadius: 18, padding: "20px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#15803d", margin: 0, textTransform: "uppercase", letterSpacing: ".8px" }}>📄 ATS Tailored Resume</p>
                        <span style={{ fontSize: 11, background: "#dcfce7", color: "#15803d", padding: "4px 12px", borderRadius: 20, fontWeight: 600 }}>✨ Tailored</span>
                      </div>
                      {/* Preview */}
                      <div style={{ fontSize: 13, lineHeight: 1.75, color: "#1f2937", maxHeight: 380, overflowY: "auto", fontFamily: font }}>
                        <p style={{ fontWeight: 700, fontSize: 15, textAlign: "center", margin: "0 0 2px" }}>{tailored.name}</p>
                        <p style={{ textAlign: "center", fontSize: 11, color: "#6b7280", margin: "0 0 10px" }}>
                          {[tailored.contact?.email, tailored.contact?.phone, tailored.contact?.location].filter(Boolean).join(" | ")}
                        </p>
                        {tailored.summary && <p style={{ fontSize: 12, margin: "0 0 8px", lineHeight: 1.6 }}>{tailored.summary}</p>}
                        {tailored.skills?.length > 0 && <p style={{ fontSize: 12, margin: "0 0 8px" }}><strong>Skills:</strong> {tailored.skills.join(", ")}</p>}
                        {tailored.experience?.map((job, i) => (
                          <div key={i} style={{ marginBottom: 8 }}>
                            <p style={{ fontWeight: 700, fontSize: 12, margin: "0 0 1px" }}>{job.title} — {job.company}</p>
                            <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 3px" }}>{job.startDate} – {job.endDate}</p>
                            {job.bullets?.map((b, j) => <p key={j} style={{ fontSize: 11, margin: "1px 0 1px 10px" }}>• {b}</p>)}
                          </div>
                        ))}
                        {tailored.education?.map((edu, i) => (
                          <div key={i} style={{ marginBottom: 6 }}>
                            <p style={{ fontWeight: 700, fontSize: 12, margin: "0 0 1px" }}>{[edu.degree, edu.major].filter(Boolean).join(" in ")}</p>
                            <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>{edu.school} · {edu.graduationYear}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Download buttons */}
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textAlign: "center", margin: "4px 0 0", textTransform: "uppercase", letterSpacing: "0.8px" }}>⬇️ Download ATS Resume as</p>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={() => downloadPDF(tailored, API)} style={{ flex: 1, background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff", border: "none", borderRadius: 16, padding: "14px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: font, boxShadow: "0 4px 14px rgba(239,68,68,.35)" }}>📄 PDF</button>
                      <button onClick={() => downloadDoc(tailored, "ats_resume.doc")} style={{ flex: 1, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 16, padding: "14px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: font, boxShadow: "0 4px 14px rgba(99,102,241,.35)" }}>📝 DOC</button>
                    </div>
                    <button onClick={tailorResume} style={{ background: "transparent", border: "2px solid #c4b5fd", borderRadius: 16, padding: "13px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", color: "#7c3aed", fontFamily: font, width: "100%" }}>🔄 Regenerate</button>
                  </>
                )}
              </div>
            )}

            <button onClick={reset} style={{ background: "transparent", border: "2px solid #e5e7eb", borderRadius: 16, padding: "12px 0", fontSize: 14, fontWeight: 500, cursor: "pointer", color: "#6b7280", fontFamily: font, width: "100%" }}>← Start Over</button>
          </div>
        )}
      </div>
    </>
  );
}