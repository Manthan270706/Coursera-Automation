# Auto Coursera (with Groq & Gemini AI)

A Chrome extension (Manifest V3) that marks supported Coursera lectures and readings complete and solves quizzes using **Groq** (Llama 3.1, GPT-OSS, Mixtral) or **Google Gemini** API.

---

## Features

- **Lecture & Reading Completion**: Automatically marks Coursera lectures and readings as completed.
- **AI Quiz Solver**:
  - Supports **Groq API** (ultra-fast inference with Llama 3.1 8B, GPT-OSS 20B, etc.).
  - Supports **Google Gemini API** (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-1.5-flash`).
  - Solves both single-choice and multi-select (checkbox) questions accurately.
  - Automatic provider and model detection based on API key prefix (`gsk_...` for Groq, `AIza...` for Gemini).
  - Dynamic model fetching from Groq Console.
  - Option to specify custom model IDs.
- **Optional Auto-Solve**: Toggle auto-solving when navigating to quiz attempt pages.

---

## Installation

1. Clone or download this repository.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the folder containing `manifest.json`.

---

## Setup & Usage

1. Click the **Auto Coursera** extension icon in your browser toolbar.
2. Select your AI Provider (**Groq** or **Google Gemini**).
3. Enter your API Key:
   - [Groq API Key](https://console.groq.com/keys)
   - [Google AI Studio Gemini Key](https://aistudio.google.com/app/apikey)
4. Choose your preferred model (e.g. `Llama 3.1 8B (Fast & Free Tier)`).
5. Click **Save Settings**.
6. On any Coursera course page:
   - Click **Complete Lectures & Readings 🎓** to complete readings/lectures.
   - Click **Solve quiz** on an assignment or attempt page to fill answers.
