from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uuid
import os
import asyncio
from services import process_video_job
from fastapi.staticfiles import StaticFiles

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

jobs = {}

class ConvertRequest(BaseModel):
    youtube_url: str
    source_language: str
    target_language: str

@app.get("/")
async def root():
    return {"message": "Multilingual Video Converter API"}

@app.post("/api/convert")
async def convert_video(req: ConvertRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "Processing", 
        "message": "Job added to queue", 
        "output_url": None, 
        "error": None,
        "progress": {
            "download": 0, 
            "extraction": 0, 
            "transcription": 0, 
            "translation": 0, 
            "tts": 0
        }
    }
    background_tasks.add_task(process_video_job_wrapper, job_id, req.youtube_url, req.source_language, req.target_language)
    return {"job_id": job_id, "status": jobs[job_id]["status"]}

@app.get("/api/status/{job_id}")
async def get_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]

@app.post("/api/cancel/{job_id}")
async def cancel_job(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    jobs[job_id]["status"] = "Cancelled"
    jobs[job_id]["message"] = "Job cancelled by user"
    return {"status": "Cancelled"}

async def process_video_job_wrapper(job_id: str, youtube_url: str, source_language: str, target_language: str):
    try:
        jobs[job_id]["status"] = "Downloading"
        
        def is_cancelled(jid):
            return jobs.get(jid, {}).get("status") == "Cancelled"

        output_path = await process_video_job(job_id, youtube_url, source_language, target_language, update_status, is_cancelled)
        
        # Final check if it was cancelled during the last step
        if is_cancelled(job_id):
            return

        jobs[job_id]["status"] = "Complete"
        jobs[job_id]["output_url"] = output_path
        jobs[job_id]["progress"] = {"download": 100, "extraction": 100, "transcription": 100, "translation": 100, "tts": 100}
    except Exception as e:
        jobs[job_id]["status"] = "Failed"
        jobs[job_id]["error"] = str(e)
        print(f"Job {job_id} failed: {e}")

def update_status(job_id: str, status: str, message: str, progress: dict = None):
    if job_id in jobs:
        jobs[job_id]["status"] = status
        jobs[job_id]["message"] = message
        if progress:
            if not isinstance(jobs[job_id]["progress"], dict):
                jobs[job_id]["progress"] = {}
            jobs[job_id]["progress"].update(progress)

os.makedirs("output", exist_ok=True)
app.mount("/output", StaticFiles(directory="output"), name="output")
