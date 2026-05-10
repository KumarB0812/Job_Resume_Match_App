require("dotenv").config();
const express = require("express");
const cors = require("cors");
const PDFParser = require("pdf2json");
const mammoth = require("mammoth");
const PDFDocument = require("pdfkit");

const app = express();
const PORT = process.env.PORT || 5000;
const GROQ_KEY = process.env.GROQ_API_KEY;

// Middleware
app.use(express.json({ limit: "20mb" }));

const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
}));

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// GROQ Caller
async function callGroq(prompt, maxTokens = 2000) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: "meta-llama/llama-4-scout-17b-16e-instruct", // free model
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// Route 1: Extract text from PDF
// Groq doesn't support PDFs natively, so we use pdf-parse to extract text
app.post("/api/extract-pdf", async (req, res) => {
  try {
    const { base64 } = req.body;
    if (!base64) return res.status(400).json({ error: "base64 is required" });

    console.log("📄 PDF received, extracting text with pdf-parse...");

    // Convert base64 to buffer and parse with pdf-parse
    const buffer = Buffer.from(base64, "base64");
    // Extract text using pdf2json
    const text = await new Promise((resolve, reject) => {
      const parser = new PDFParser();
      parser.on("pdfParser_dataReady", (data) => {
        const text = data.Pages.map(page =>
          page.Texts.map(t => {
            try { return decodeURIComponent(t.R.map(r => r.T).join("")); }
            catch { return t.R.map(r => r.T).join(""); }
          }).join(" ")
        ).join("\n");
        resolve(text);
      });
      parser.on("pdfParser_dataError", (err) => reject(err));
      parser.parseBuffer(buffer);
    });

    console.log("✅ Extracted text length:", text.length);
    res.json({ text });

  } catch (err) {
    console.error("❌ extract-pdf error:", err.message);
    res.status(500).json({ error: "Failed to extract PDF text.", detail: err.message });
  }
});

// Route 2: Analyze resume vs job description
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

// Route 3: Tailor resume
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
- Preserve the candidate's actual experience, education, and skills

Resume:
${resumeText}

Job Description:
${jobDescription}

Return ONLY this JSON structure, no markdown, no code fences, no commentary:
{
  "name": "Full Name",
  "contact": {
    "email": "email@example.com",
    "phone": "123-456-7890",
    "location": "City, State",
    "linkedin": "linkedin.com/in/username or empty string",
    "website": "portfolio url or empty string"
  },
  "summary": "2-3 sentence professional summary tailored to the job",
  "skills": ["skill1", "skill2", "skill3"],
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "location": "City, State",
      "startDate": "Month Year",
      "endDate": "Month Year or Present",
      "bullets": ["achievement 1", "achievement 2", "achievement 3"]
    }
  ],
  "education": [
    {
      "degree": "Degree Name",
      "major": "Major",
      "school": "University Name",
      "location": "City, State",
      "graduationYear": "Year",
      "gpa": "GPA or empty string"
    }
  ],
  "certifications": ["cert1", "cert2"],
  "projects": [
    {
      "name": "Project Name",
      "description": "brief description",
      "bullets": ["detail 1", "detail 2"]
    }
  ]
}
Only include sections that exist in the original resume. Return empty arrays [] for missing sections.`;

    const raw = await callGroq(prompt, 3000);
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const structured = JSON.parse(cleaned);
    res.json({ tailored: structured });

  } catch (err) {
    console.error("❌ tailor error:", err.message);
    res.status(500).json({ error: "Tailoring failed.", detail: err.message });
  }
});

// Route 4: Generate ATS PDF from structured JSON
app.post("/api/generate-pdf", async (req, res) => {
  try {
    const r = req.body; // structured resume JSON
    if (!r?.name) return res.status(400).json({ error: "Invalid resume data" });

    const doc = new PDFDocument({ margin: 48, size: "Letter", bufferPages: true });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=ats_resume.pdf");
    doc.pipe(res);

    const L = 48, W = doc.page.width - 96;
    const colors = { name: "#1a1a2e", heading: "#1a1a2e", text: "#2d2d2d", muted: "#555555", line: "#2d2d2d" };

    const sectionHeading = (title) => {
      doc.moveDown(0.5);
      doc.fontSize(10.5).font("Helvetica-Bold").fillColor(colors.heading).text(title.toUpperCase(), L, doc.y, { width: W });
      const y = doc.y + 2;
      doc.moveTo(L, y).lineTo(L + W, y).strokeColor(colors.line).lineWidth(0.8).stroke();
      doc.moveDown(0.35);
    };

    // Name
    doc.fontSize(22).font("Helvetica-Bold").fillColor(colors.name)
      .text(r.name, L, doc.y, { align: "center", width: W });
    doc.moveDown(0.2);

    // Contact line
    const contactParts = [r.contact?.email, r.contact?.phone, r.contact?.location, r.contact?.linkedin, r.contact?.website].filter(Boolean);
    doc.fontSize(9).font("Helvetica").fillColor(colors.muted)
      .text(contactParts.join("  |  "), L, doc.y, { align: "center", width: W });
    doc.moveDown(0.25);
    doc.moveTo(L, doc.y).lineTo(L + W, doc.y).strokeColor("#bbbbbb").lineWidth(0.6).stroke();
    doc.moveDown(0.4);

    // Summary
    if (r.summary) {
      sectionHeading("Professional Summary");
      doc.fontSize(9.5).font("Helvetica").fillColor(colors.text)
        .text(r.summary, L, doc.y, { width: W, lineGap: 2 });
      doc.moveDown(0.3);
    }

    // Skills
    if (r.skills?.length) {
      sectionHeading("Skills");
      const skillLine = r.skills.join("  •  ");
      doc.fontSize(9.5).font("Helvetica").fillColor(colors.text)
        .text(skillLine, L, doc.y, { width: W, lineGap: 2 });
      doc.moveDown(0.3);
    }

    // Experience
    if (r.experience?.length) {
      sectionHeading("Experience");
      r.experience.forEach((job) => {
        const dateRange = `${job.startDate} – ${job.endDate}`;
        const startY = doc.y;
        doc.fontSize(10).font("Helvetica-Bold").fillColor(colors.text)
          .text(job.title, L, startY, { continued: false, width: W * 0.65 });
        doc.fontSize(9.5).font("Helvetica").fillColor(colors.muted)
          .text(dateRange, L + W * 0.65, startY, { width: W * 0.35, align: "right" });
        doc.fontSize(9.5).font("Helvetica-Oblique").fillColor(colors.muted)
          .text(`${job.company}${job.location ? "  ·  " + job.location : ""}`, L, doc.y, { width: W });
        doc.moveDown(0.2);
        job.bullets?.forEach((b) => {
          doc.fontSize(9.5).font("Helvetica").fillColor(colors.text)
            .text(`• ${b}`, L + 10, doc.y, { width: W - 10, lineGap: 1.5 });
        });
        doc.moveDown(0.4);
      });
    }

    // Education
    if (r.education?.length) {
      sectionHeading("Education");
      r.education.forEach((edu) => {
        const degreeText = [edu.degree, edu.major].filter(Boolean).join(" in ");
        const startY = doc.y;
        doc.fontSize(10).font("Helvetica-Bold").fillColor(colors.text)
          .text(degreeText, L, startY, { width: W * 0.7 });
        doc.fontSize(9.5).font("Helvetica").fillColor(colors.muted)
          .text(edu.graduationYear || "", L + W * 0.7, startY, { width: W * 0.3, align: "right" });
        doc.fontSize(9.5).font("Helvetica-Oblique").fillColor(colors.muted)
          .text(`${edu.school}${edu.location ? "  ·  " + edu.location : ""}${edu.gpa ? "  ·  GPA: " + edu.gpa : ""}`, L, doc.y, { width: W });
        doc.moveDown(0.4);
      });
    }

    // ── Certifications ──
    if (r.certifications?.length) {
      sectionHeading("Certifications");
      r.certifications.forEach((cert) => {
        doc.fontSize(9.5).font("Helvetica").fillColor(colors.text)
          .text(`• ${cert}`, L + 10, doc.y, { width: W - 10, lineGap: 1.5 });
      });
      doc.moveDown(0.3);
    }

    // ── Projects ──
    if (r.projects?.length) {
      sectionHeading("Projects");
      r.projects.forEach((proj) => {
        doc.fontSize(10).font("Helvetica-Bold").fillColor(colors.text)
          .text(proj.name, L, doc.y, { width: W });
        if (proj.description) {
          doc.fontSize(9.5).font("Helvetica-Oblique").fillColor(colors.muted)
            .text(proj.description, L, doc.y, { width: W });
        }
        proj.bullets?.forEach((b) => {
          doc.fontSize(9.5).font("Helvetica").fillColor(colors.text)
            .text(`• ${b}`, L + 10, doc.y, { width: W - 10, lineGap: 1.5 });
        });
        doc.moveDown(0.4);
      });
    }

    doc.end();
  } catch (err) {
    console.error("❌ generate-pdf error:", err.message);
    res.status(500).json({ error: "Failed to generate PDF.", detail: err.message });
  }
});


app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));