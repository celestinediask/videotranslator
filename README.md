# Multilingual Video Converter

A web-based service that automatically dubs YouTube videos into different languages using AI.

## Features
- **YouTube Integration**: Paste any YouTube link to fetch the video.
- **Video Preview**: Live embedded preview of the source video before processing.
- **AI-Powered Dubbing**: 
  - **Whisper**: High-accuracy transcription.
  - **GPT-3.5**: Natural and concise translation.
  - **OpenAI TTS**: High-quality voice synthesis.
- **Detailed Progress Tracking**: Independent progress bars for Download, Extraction, Transcription, Translation, and Voice Synthesis.
- **Dark Mode UI**: Modern, responsive dashboard built with React and Tailwind CSS.

## Tech Stack
- **Frontend**: React (TypeScript), Vite, Tailwind CSS, Axios.
- **Backend**: Python, FastAPI, Uvicorn.
- **Processing**: yt-dlp, FFmpeg.
- **AI Services**: OpenAI API.

## Prerequisites
- Python 3.10+
- Node.js & npm
- FFmpeg installed on your system.
- OpenAI API Key.

## Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/celestinediask/videotranslator.git
cd videotranslator
```

### 2. Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt # Note: Create this if missing, or use manual install steps below
```
*Dependencies: `fastapi uvicorn yt-dlp openai ffmpeg-python python-dotenv pydantic requests`*

Create a `.env` file in the `backend/` folder:
```env
OPENAI_API_KEY=your_actual_key_here
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
```

### 4. Run the Application
You can use the provided startup script from the root directory:
```bash
chmod +x start_services.sh
./start_services.sh
```
The application will be available at `http://localhost:5173`.

## Usage
1. Paste a YouTube URL.
2. Click **Load Video** to preview.
3. Select the **Original Language** (e.g., Hindi).
4. Click **Start Dubbing Process**.
5. Wait for the pipeline to complete and download your dubbed video!

## License
MIT
