<<<<<<< HEAD
# Quiz Bowl Management System

A professional, single-device web application for managing university engineering department quiz competitions.

## Features
- **Client-Side Storage**: Uses `localStorage` to operate without a backend.
- **MathJax Integration**: Render complex LaTeX mathematical equations.
- **Dynamic Question Types**: MCQ, Calculation, Theory, True/False.
- **State Management**: Track available/answered questions, team scores, and competition history.
- **Display Mode**: A full-screen projector-friendly mode to hide administrator controls.
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

## Adding Questions
Click **Questions** on the sidebar, then click **+ Add Question**. Enter the question details. You can use standard LaTeX syntax wrapped in `$$` for block math or `\\(` `\\)` for inline math.

## Display Mode
Click the **Display Mode** button in the top right corner. This will expand the main view and hide the sidebar, header, and administrative scoring controls, making it perfect for projecting onto a screen for the audience.
Press `ESC` to exit Display Mode.

## Vercel Deployment
This project is configured as a static site and is ready to deploy to Vercel.
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the project root.

## Architecture
The application uses a modular Repository/Service pattern mapped to `window.QuizBowl`:
- `Data`: Wraps `localStorage` providing a database-like API (`questions-db.js`). This layer can be swapped out for Supabase or a SQL backend later.
- `Services`: Business logic (scoring, stats).
- `Views`: UI rendering logic.
=======
# quizbowl
>>>>>>> db258ffca8f1b390b73a07c96e5d8b73443c2c31
