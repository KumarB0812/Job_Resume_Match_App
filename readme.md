# Resume Analyzer

A web app I built to help students and job seekers understand how well their resume matches a job description — and automatically rewrite it to make it ATS friendly.

---

## The Problem

Everyday I open LinkedIn, Indeed, Handshake, Glassdoor etc. and look for job postings, then I take a look at my Resume and try to bridge the gap by reading and comparing the Resume and Job Description. I got fed up by doing it manually, so needed this system to compare and analyze my Resume and give me insights about the strengths and weaknesses.

---

## What It Does

You upload your resume (.pdf, DOC, or text), paste the job description, and the app tells you:

- A match score from 10–100
- What's working in your resume for that specific job
- What keywords and skills are missing
- How to improve it

You can also let the AI rewrite your resume to better fit the role, then download it as a PDF or Word doc that's ready to submit.
Or make changes to your resume manually if there is not much to change.

---

## Stack

- **Frontend** — React
- **Backend** — Node.js + Express
- **AI** — Groq API (Llama 4, because its free and I am broke)
- **PDF parsing** — pdf2json
- **DOC parsing** — mammoth
- **PDF generation** — pdfkit

---

## Running It Locally

You'll need Node.js 18+ and a free Groq API key from [console.groq.com](https://console.groq.com).

**Backend:**
```bash
cd server
npm install
```

Create `server/.env`:
```
GROQ_API_KEY=your_key_here
PORT=5000
FRONTEND_URL=http://localhost:3000
```

```bash
npm run dev
```

**Frontend:**
```bash
cd client
npm install
```

Create `client/.env`:
```
REACT_APP_API_URL=http://localhost:5000
```

```bash
npm start
```

App runs at `http://localhost:3000`.

---

## Deploying

I deployed the backend on [Railway](https://railway.app) and the frontend on [Vercel](https://vercel.com)
I bought a custom domain name(www.greybowl.com) for this app and deployed it online.

Just point `REACT_APP_API_URL` to your Railway URL and you're good.

---

## Notes

- The Groq API key stays on the server — it's never exposed to the browser
- `.env` files are gitignored
- Resume File upload limit is 20MB

---

## Author

Bhupendra Kumar — [GitHub](https://github.com/KumarB0812) · [LinkedIn](https://www.linkedin.com/in/bhupendra-kumar-13ab58341/)
