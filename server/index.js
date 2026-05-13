require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Groq = require("groq-sdk");

const app = express();
const PORT = process.env.PORT || 5000;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: "20mb" }));

const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const isAllowed = allowedOrigins.includes(origin) ||
      /https:\/\/.*\.vercel\.app$/.test(origin);
    if (isAllowed) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
}));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ─── Shared Groq caller ───────────────────────────────────────────────────────
async function callGroq(prompt, maxTokens = 2000) {
  const response = await groq.chat.completions.create({
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    messages: [{ role: "user", content: prompt }],
    max_tokens: maxTokens,
    temperature: 0.3,
  });
  return response.choices[0]?.message?.content || "";
}

// ─── Route 1: Extract text from file ─────────────────────────────────────────
// We send the file as base64 to Groq vision to extract text
// This avoids needing any native PDF parsing libraries
app.post("/api/extract-pdf", async (req, res) => {
  try {
    const { base64, fileType } = req.body;
    if (!base64) return res.status(400).json({ error: "base64 is required" });

    console.log("📄 File received, type:", fileType, "size:", base64.length);

    let text = "";

    if (fileType === "text/plain") {
      // Plain text — just decode base64
      text = Buffer.from(base64, "base64").toString("utf-8");
    } else {
      // For PDF and DOC — use Groq to extract text via prompt
      const response = await groq.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: "This is a base64-encoded resume file. Extract ALL text content from it exactly as it appears. Return only the raw extracted text, preserving the structure with line breaks. No commentary, no explanations.",
            },
            {
              type: "text",
              text: `File type: ${fileType}\nBase64 content (first 2000 chars for reference): ${base64.substring(0, 2000)}`,
            },
          ],
        }],
        max_tokens: 3000,
      });
      text = response.choices[0]?.message?.content || "";

      // If Groq couldn't extract (it's not a vision model), fallback:
      if (!text || text.length < 50) {
        text = Buffer.from(base64, "base64").toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
      }
    }

    console.log("✅ Extracted text length:", text.length);
    res.json({ text });

  } catch (err) {
    console.error("❌ extract-pdf error:", err.message);
    res.status(500).json({ error: "Failed to extract file text.", detail: err.message });
  }
});

// ─── Route 2: Analyze resume vs job description ───────────────────────────────
app.post("/api/analyze", async (req, res) => {
  try {
    const { resumeText, jobDescription } = req.body;
    if (!resumeText || !jobDescription)
      return res.status(400).json({ error: "resumeText and jobDescription are required" });

    const prompt = `You are a resume analyst. Analyze the match between this resume and job description.

Resume:
${resumeText}

Job Description:
${jobDescription}

Respond ONLY with valid JSON, no markdown, no extra text, no code fences:
{"score":<integer 10-100>,"strengths":[<3-5 short strings>],"gaps":[<3-5 short strings>],"tips":[<2-3 short actionable strings>]}`;

    const raw = await callGroq(prompt);
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const result = JSON.parse(cleaned);
    res.json(result);

  } catch (err) {
    console.error("❌ analyze error:", err.message);
    res.status(500).json({ error: "Analysis failed.", detail: err.message });
  }
});

// ─── Route 3: Tailor resume ───────────────────────────────────────────────────
app.post("/api/tailor", async (req, res) => {
  try {
    const { resumeText, jobDescription } = req.body;
    if (!resumeText || !jobDescription)
      return res.status(400).json({ error: "resumeText and jobDescription are required" });

    const prompt = `You are an expert ATS resume writer. Analyze the resume and job description, then return a structured JSON object representing the tailored resume.

Rules:
- Keep all facts accurate, do not invent anything
- Incorporate relevant keywords from the job description naturally
- Strengthen bullet points with action verbs and measurable outcomes
- Keep it concise and ATS-friendly (one page)

Resume:
${resumeText}

Job Description:
${jobDescription}

Return ONLY this JSON structure, no markdown, no code fences:
{
  "name": "Full Name",
  "contact": {
    "email": "email",
    "phone": "phone",
    "location": "City, State",
    "linkedin": "linkedin url or empty string",
    "website": "website or empty string"
  },
  "summary": "2-3 sentence professional summary",
  "skills": ["skill1", "skill2"],
  "experience": [
    {
      "title": "Job Title",
      "company": "Company",
      "location": "City, State",
      "startDate": "Month Year",
      "endDate": "Month Year or Present",
      "bullets": ["achievement 1", "achievement 2"]
    }
  ],
  "education": [
    {
      "degree": "Degree",
      "major": "Major",
      "school": "University",
      "location": "City, State",
      "graduationYear": "Year",
      "gpa": "GPA or empty string"
    }
  ],
  "certifications": ["cert1"],
  "projects": []
}`;

    const raw = await callGroq(prompt, 3000);
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const structured = JSON.parse(cleaned);
    res.json({ tailored: structured });

  } catch (err) {
    console.error("❌ tailor error:", err.message);
    res.status(500).json({ error: "Tailoring failed.", detail: err.message });
  }
});

// ─── Route 4: Generate ATS PDF ────────────────────────────────────────────────
app.post("/api/generate-pdf", async (req, res) => {
  try {
    const r = req.body;
    if (!r?.name) return res.status(400).json({ error: "Invalid resume data" });

    // Build clean HTML and return it — client will trigger download
    const contact = [r.contact?.email, r.contact?.phone, r.contact?.location, r.contact?.linkedin, r.contact?.website].filter(Boolean).join(" | ");

    const expHtml = r.experience?.map(job => `
      <div class="job">
        <div class="job-header">
          <span class="job-title">${job.title} — ${job.company}</span>
          <span class="job-date">${job.startDate} – ${job.endDate}</span>
        </div>
        <div class="job-location">${job.location || ""}</div>
        <ul>${job.bullets?.map(b => `<li>${b}</li>`).join("") || ""}</ul>
      </div>`).join("") || "";

    const eduHtml = r.education?.map(edu => `
      <div class="job">
        <div class="job-header">
          <span class="job-title">${[edu.degree, edu.major].filter(Boolean).join(" in ")}</span>
          <span class="job-date">${edu.graduationYear || ""}</span>
        </div>
        <div class="job-location">${edu.school}${edu.location ? " · " + edu.location : ""}${edu.gpa ? " · GPA: " + edu.gpa : ""}</div>
      </div>`).join("") || "";

    const certsHtml = r.certifications?.length ? `<ul>${r.certifications.map(c => `<li>${c}</li>`).join("")}</ul>` : "";
    const projHtml = r.projects?.map(p => `
      <div class="job">
        <div class="job-title">${p.name}</div>
        ${p.description ? `<div class="job-location">${p.description}</div>` : ""}
        <ul>${p.bullets?.map(b => `<li>${b}</li>`).join("") || ""}</ul>
      </div>`).join("") || "";

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Calibri', Arial, sans-serif; font-size: 10.5pt; color: #222; padding: 0.6in 0.7in; max-width: 8.5in; }
  h1 { font-size: 20pt; text-align: center; color: #1a1a2e; margin-bottom: 4px; }
  .contact { text-align: center; font-size: 9pt; color: #555; border-bottom: 1px solid #bbb; padding-bottom: 8px; margin-bottom: 12px; }
  .section { margin-bottom: 12px; }
  .section-title { font-size: 10.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1.5px solid #1a1a2e; padding-bottom: 2px; margin-bottom: 6px; color: #1a1a2e; }
  .summary { font-size: 9.5pt; line-height: 1.5; }
  .skills { font-size: 9.5pt; line-height: 1.6; }
  .job { margin-bottom: 8px; }
  .job-header { display: flex; justify-content: space-between; align-items: baseline; }
  .job-title { font-weight: bold; font-size: 10pt; }
  .job-date { font-size: 9pt; color: #555; white-space: nowrap; }
  .job-location { font-size: 9pt; color: #555; font-style: italic; margin-bottom: 3px; }
  ul { margin-left: 16px; margin-top: 2px; }
  li { font-size: 9.5pt; margin-bottom: 2px; line-height: 1.4; }
</style>
</head>
<body>
  <h1>${r.name}</h1>
  <div class="contact">${contact}</div>
  ${r.summary ? `<div class="section"><div class="section-title">Professional Summary</div><div class="summary">${r.summary}</div></div>` : ""}
  ${r.skills?.length ? `<div class="section"><div class="section-title">Skills</div><div class="skills">${r.skills.join(" • ")}</div></div>` : ""}
  ${r.experience?.length ? `<div class="section"><div class="section-title">Experience</div>${expHtml}</div>` : ""}
  ${r.education?.length ? `<div class="section"><div class="section-title">Education</div>${eduHtml}</div>` : ""}
  ${r.certifications?.length ? `<div class="section"><div class="section-title">Certifications</div>${certsHtml}</div>` : ""}
  ${r.projects?.length ? `<div class="section"><div class="section-title">Projects</div>${projHtml}</div>` : ""}
</body>
</html>`;

    res.json({ html });

  } catch (err) {
    console.error("❌ generate-pdf error:", err.message);
    res.status(500).json({ error: "Failed to generate resume.", detail: err.message });
  }
});

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
