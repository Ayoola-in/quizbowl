# Quizr

A web app for running any kind of quiz competition (school, church, community, office or pub quizzes) with questions, teams, live scoring and an audience-facing display. Create as many quizzes as you like; each keeps its own questions, teams, history and settings.

## Features
- **Client-Side Storage**: Uses `localStorage` to operate without a backend.
- **MathJax Integration**: Render complex LaTeX mathematical equations.
- **Dynamic Question Types**: MCQ, Calculation, Theory, True/False.
- **State Management**: Track available/answered questions, team scores, and competition history.
- **Fast Client-Side Search**: Instantly find questions by keywords, topic, or ID.

## Running Locally

Because this application does not use ES Modules (`type="module"`), you can simply double-click `index.html` to open it in any modern browser!

Alternatively, you can serve it via a local development server:
```bash
# Using Node.js
npx serve .

# Using Python
python -m http.server 8000
```

## Install on a Phone (Web App)
Quizr is an installable web app (PWA). Once installed it opens from the home screen like a normal app, full screen, and **works offline**. All quizzes, questions and scores are stored on the phone itself.

Install it from the deployed **https** site (e.g. your Vercel URL). Phones only allow installing over https, so opening `index.html` as a file or over plain `http://` on your Wi-Fi will not offer the install option.

- **Android (Chrome):** open the site, then tap **Install App** in the sidebar menu, or browser menu (⋮) → **Install app** / **Add to Home screen**.
- **iPhone / iPad (Safari):** open the site, tap **Share** → **Add to Home Screen**.

Open the app once while online so everything is saved for offline use. After that it runs with no connection. Math formulas (MathJax) and fonts are also stored the first time they load online.

Notes:
- Data lives inside the installed app on that device. It is not synced between devices. On iPhone, the home screen app also keeps separate data from Safari.
- Inside the installed app, **Public Display** opens in the same window. Use the back arrow in its header to return to the admin pages.
- Updates you deploy are picked up automatically the next time the app is opened online. If you add or rename files, also add them to `APP_SHELL` in `sw.js` and bump `CACHE_VERSION`.

## AI Question Generator
Open **AI Generator** in the sidebar (or **Generate with AI** on the Questions page) to create questions from your own material:

1. **Source material**: upload PDFs, Word (.docx), PowerPoint (.pptx), OpenDocument, text/Markdown/CSV/HTML files, or photos and screenshots (paste them too). You can also paste notes, or type just a topic.
2. **AI model**: pick ChatGPT (OpenAI), Claude (Anthropic), Gemini (Google), OpenRouter (Llama, DeepSeek, Mistral, Grok and many more) or any OpenAI-compatible server (Groq, DeepSeek, Mistral, xAI, Together, or a local Ollama / LM Studio). Paste your API key from that service. **Load my models** lists every model your key can use.
3. **Questions**: choose how many multiple-choice, true/false, short-answer and calculation questions; options per multiple-choice question (2–6); difficulty; audience; language; an optional fixed category; and extra instructions.
4. **Review**: edit or untick questions, then add them. They always go into the quiz you were in when you uploaded, with that quiz's default marks.

Notes:
- **Your API key** is stored only in this browser and sent only to the service you choose. Usage is billed to your account with that service.
- **Quality checks**: questions are checked before you see them. Broken or duplicate questions are dropped and replaced, and multiple-choice answers are shuffled so the correct letter varies. Questions already in the quiz are not repeated (optional).
- **Explanations** (optional) appear under the answer on the public display.
- **Scanned PDFs** are read as page pictures, using up to the first 12 pages.
- **Old file formats** (.doc, .ppt, .xls) aren't supported. Save them as PDF or the newer format first.
- **Large requests**: up to 100 questions per run, generated in batches of 15.

## Accounts & Cloud Sync (optional)
People can sign in with **Google** or with **email and password**. Email sign-ups must confirm their address first. Signing in lets them back up quizzes and use them on several devices.

- Open **Account & Sync** in the sidebar. Each quiz can be **uploaded**, **downloaded**, **synced**, or kept only on the device.
- **Auto-sync** can be turned on per quiz to keep it up to date whenever the device is online.
- If a quiz was changed on two devices, you choose which version to keep.
- The installed app still works fully offline. Without signing in, nothing changes.

To turn this on for your site, follow **[SETUP-CLOUD.md](SETUP-CLOUD.md)**. It covers creating a free Supabase project, running `supabase/schema.sql`, and setting up Google sign-in. Then fill in `js/cloud/config.js`.

## Export to PDF
Open **Export PDF** in the sidebar (or **Export PDF** on the Questions page) to make a printable question paper:

1. **Choose questions**: everything, whole question types (tick one or more), or hand-picked questions with search and type filters. You can limit it to questions not used yet, or only ones already used. Ticking questions in the Question Bank and pressing **Export PDF** opens the export page with them pre-selected.
2. **Answers**:
   - **Show the answers**: correct options are highlighted and ticked for multiple choice and true/false, and answers appear under short-answer and calculation questions.
   - **Answer key at the end**: questions first, then a separate answer key page.
   - **No answers**: a clean question paper.
3. **Layout**: title, instructions, A4 or Letter, normal or large text, explanations, marks, sections per question type, name/date/score lines, writing lines for answers, shuffled order, and the app's question numbers (e.g. MCQ004).
4. **Organization and watermark** (optional): add your organization's logo (PNG, JPG, WebP or SVG) and name, and they're centered at the top of the first page, with the name also in the footer. A **watermark** can be printed faintly across the middle of every page: either text (e.g. CONFIDENTIAL, or the organization name by default) or the logo. A logo with a transparent background makes the cleanest watermark. The logo is remembered on this device.

**Download PDF** saves a real PDF file. It uses an embedded Unicode font, so accented letters (é, ẹ, ọ, ṣ) work, and maths is converted to readable symbols (x², √(16), π, ≤).

**Print** opens the browser's print window, where you can choose "Save as PDF". Use it for scripts the PDF font doesn't include (Arabic, Chinese and others) or for fully typeset maths.

In the **AI Generator**, the review list also has **Download PDF**. It downloads the generated questions straight away without adding them to the quiz.

## Host a Quiz
Besides running a live team quiz, you can host a quiz that people take on their own, one question at a time, from their own phones or computers. Open **Host a Quiz** in the sidebar and choose **Host a new quiz**:

1. **Quiz and questions**: pick any of your quizzes, then use all its questions, whole types, whole categories, or hand-picked questions. Disabled questions are left out.
2. **Question order**: group questions by category (categories A to Z), shuffle the questions, and shuffle multiple-choice options. With shuffling on, each person gets their own order.
3. **Timer**:
   - **Per question**: each question has its own countdown (seconds per question type, starting from the quiz's timer settings). **Next**, or running out of time, closes the question and opens the next. Earlier questions can be viewed but not changed.
   - **Total time**: one countdown for the whole quiz. People move freely and can change answers until they submit. When the time runs out, the attempt is submitted automatically.
4. **After the quiz**: show the answers after submitting (or just the score), and allow more than one attempt per person.

**Launch quiz** gives a 6-character code and a link (`…/#take/CODE`). Share either one: anyone signs in to their Quizr account, enters their name and starts, on any device. Their name, email and account ID are saved with the score. Hosting needs you to be signed in, and the cloud database set up (see [SETUP-CLOUD.md](SETUP-CLOUD.md); if you set it up before hosting existed, run `supabase/schema.sql` again). **End quiz** (with a confirmation) submits early, and unanswered questions score 0. The clock keeps running if the page is refreshed or closed, and coming back resumes the same attempt.

**Marking**: multiple choice and true/false are marked automatically. Calculation answers are compared as numbers: the answer counts if it rounds to the expected value at the same number of decimal places. Short answers count when they match the expected answer, ignoring case, accents and punctuation. Anything else waits for you on the scores page, where you can mark it or change any mark.

Each hosted quiz has a **Scores** page with the code and link, the rules, everyone's scores (ranked, with time taken and how the attempt ended, updated every 10 seconds) and **Download CSV**. You can also close a quiz so no new attempts start.

**Edit** on that page changes a hosted quiz after launch, keeping its code: the title, question order and shuffling, the timer, showing answers, and retakes. People already taking the quiz keep the timer and order they started with; new attempts use the new rules. Showing answers and retakes change for everyone straight away. The questions themselves can be changed (kept, or chosen again from a quiz, including edits made since launch) until the first person starts; after that they're locked, so every score is out of the same questions.

The quiz runs in full screen with the rest of the app locked. If someone leaves full screen (or reloads or closes the quiz page), it's recorded with the time: the scores page pops up a note while you have it open, shows who is out of full screen right now and how many times each person left, and each person's answers page lists every time with how long they were away. The CSV includes the count too.

The timing and marking happen on the server: people taking the quiz never receive the correct answers before they submit, questions that haven't opened yet aren't sent, and the clock is the server's. Question text from the host is cleaned before it's shown, so it can't run code in anyone's browser.

On a copy of Quizr without accounts set up, hosting still works, but quizzes and scores stay on the device that hosts them (people take the quiz on that device).

## Adding Questions
Click **Questions** on the sidebar, then click **+ Add Question**. Enter the question details. You can use standard LaTeX syntax wrapped in `$$` for block math or `\\(` `\\)` for inline math.

## Keyboard Shortcuts
| Where | Key | Action |
|---|---|---|
| Admin | `Ctrl+K` | Focus question search |
| Admin | `Alt+N` | Add a new question |
| Public Display | `Enter` | Show the typed question number |
| Public Display | `A` | Reveal / hide the answer |
| Public Display | `F` | Toggle fullscreen |
| Public Display | `Esc` | Close question / celebration |

The sun/moon button in the header toggles dark mode (shared by the admin and public pages).

## Vercel Deployment
This project is configured as a static site and is ready to deploy to Vercel.
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the project root.

## Architecture
The application uses a modular Repository/Service pattern mapped to `window.QuizBowl`:
- `Data`: Wraps `localStorage` providing a database-like API (`questions-db.js`). This layer can be swapped out for Supabase or a SQL backend later.
- `Services`: Business logic (scoring, stats).
- `Views`: UI rendering logic.
