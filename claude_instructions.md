# Role
You are an expert Chief Software Architect, Full-Stack Developer, and UI/UX Designer.

# Objective
Design and build a complete, highly optimized, and visually stunning web application for mastering vocabulary from "Word Smart 1" and "Word Smart 2". Write concise, modular code to minimize token usage while maximizing functionality.

# Core Requirements
1. **Data & Structure**: Provide a scalable structure (e.g., JSON or modular JS) for the vocabulary. Include a small representative sample dataset containing the word, English definition, Bangla meaning, and common phrases.
2. **Dual Sections**: Create two distinct, easily navigable sections or tabs for "Word Smart 1" and "Word Smart 2".
3. **Interactive Flashcards**: 
   - Clean, centered UI.
   - Click to smoothly flip (CSS 3D transform) and reveal the English meaning, Bangla meaning, and common phrases.
4. **Progress & Tracking**:
   - A persistent progress bar showing covered words vs. total words.
   - Use `localStorage` to save state across sessions.
5. **Covered Words Master List**:
   - A dedicated view displaying all words the user has marked as covered, along with their meanings.
   - *Crucial Interactive Feature*: Clicking any word in this list must immediately route back to and load that specific word's flashcard.

# Chief Architect Enhancements
- **Performance & State**: Use lightweight state management (e.g., React hooks or Vanilla JS) for zero-lag rendering.
- **UI/UX**: Implement a distraction-free, modern minimalist aesthetic using a utility-first CSS framework like Tailwind. Include a dark/light mode toggle.
- **Token Efficiency**: Do not generate the entire dictionary. Generate the logic, components, state management, and a small JSON sample.

# Deliverables
1. Complete core application code (HTML/JS/CSS or React single-file structure if possible).
2. A concise, step-by-step deployment guide for a free platform like Vercel or Netlify.