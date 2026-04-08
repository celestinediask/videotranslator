import yt_dlp
import os
import asyncio
from openai import AsyncOpenAI
from dotenv import load_dotenv
import json
import ffmpeg
import subprocess
import logging
import glob

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()
client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

async def process_video_job(job_id: str, youtube_url: str, source_language: str, target_language: str, status_callback, is_cancelled):
    work_dir = f"output/{job_id}"
    os.makedirs(work_dir, exist_ok=True)
    
    def check_cancelled():
        if is_cancelled(job_id):
            raise Exception("Job cancelled by user.")

    # 1. Download
    status_callback(job_id, "Downloading", "Downloading video...", progress={"download": 0})
    check_cancelled()
    
    def progress_hook(d):
        if d['status'] == 'downloading':
            try:
                downloaded = d.get('downloaded_bytes', 0)
                total = d.get('total_bytes') or d.get('total_bytes_estimate')
                if total:
                    val = (downloaded / total) * 100
                    status_callback(job_id, "Downloading", f"Downloading: {val:.1f}%", progress={"download": val})
            except: pass
        elif d['status'] == 'finished':
            status_callback(job_id, "Downloading", "Download complete.", progress={"download": 100})

    # Use a generic output template and let yt-dlp decide the extension, but we'll try to find it
    outtmpl = os.path.join(work_dir, 'input_video.%(ext)s')
    
    ydl_opts = {
        'format': 'best',
        'outtmpl': outtmpl,
        'progress_hooks': [progress_hook],
        'noplaylist': True,
        'quiet': True,
        'no_warnings': True,
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'referer': 'https://www.youtube.com/',
        'nocheckcertificate': True,
        'geo_bypass': True,
        'extractor_args': {'youtube': {'player_client': ['android', 'web', 'tv']}},
    }
    
    def download_sync():
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=True)
            return ydl.prepare_filename(info)
            
    try:
        downloaded_file = await asyncio.to_thread(download_sync)
        # Sometimes prepare_filename doesn't match actual extension if merged
        if not os.path.exists(downloaded_file):
            # Try to find any file starting with input_video
            files = glob.glob(os.path.join(work_dir, "input_video.*"))
            if files:
                downloaded_file = files[0]
            else:
                raise Exception("Downloaded file not found.")
    except Exception as e:
        logger.error(f"Download failed: {e}")
        raise Exception(f"Video download failed: {str(e)}")
    
    video_path = downloaded_file
    audio_path = os.path.join(work_dir, "audio.mp3")
    
    check_cancelled()
    # Extract audio
    status_callback(job_id, "Downloading", "Extracting audio...", progress={"extraction": 50})
    def extract_audio():
        subprocess.run(['ffmpeg', '-y', '-i', video_path, '-q:a', '0', '-map', 'a', audio_path], capture_output=True, check=True)
    try:
        await asyncio.to_thread(extract_audio)
    except Exception as e:
        logger.error(f"Audio extraction failed: {e}")
        # Try a more desperate extraction if first fails
        try:
            subprocess.run(['ffmpeg', '-y', '-i', video_path, audio_path], capture_output=True, check=True)
        except:
            raise Exception(f"Audio extraction failed: {str(e)}")
            
    status_callback(job_id, "Downloading", "Audio extracted.", progress={"extraction": 100})
    check_cancelled()
    
    # 2. Transcribe
    status_callback(job_id, "Transcribing", f"Transcribing {source_language}...", progress={"transcription": 0})
    
    lang_codes = {"hindi": "hi", "english": "en"}
    iso_lang = lang_codes.get(source_language.lower().strip())
    
    try:
        with open(audio_path, "rb") as f:
            transcription = await client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                response_format="verbose_json",
                timestamp_granularities=["segment"],
                language=iso_lang
            )
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise Exception(f"OpenAI Transcription failed: {str(e)}")
    
    status_callback(job_id, "Transcribing", "Transcription complete.", progress={"transcription": 100})
    
    # Robustly convert transcription to pure dictionaries
    segments_data = []
    try:
        raw_json = transcription.model_dump_json()
        data = json.loads(raw_json)
        segments_data = data.get('segments', [])
    except:
        try:
            for s in transcription.segments:
                segments_data.append({
                    "text": str(getattr(s, 'text', '')),
                    "start": float(getattr(s, 'start', 0.0)),
                    "end": float(getattr(s, 'end', 0.0))
                })
        except:
            segments_data = getattr(transcription, 'segments', [])

    if not segments_data:
        raise Exception("No speech detected in the video.")

    total_segments = len(segments_data)
    dubbed_audio_segments = []
    
    # 3. Translation and TTS
    for idx, seg in enumerate(segments_data):
        check_cancelled()
        current_prog = ((idx + 1) / total_segments) * 100
        
        # Translation
        status_callback(job_id, "Processing", f"Translating segment {idx+1}/{total_segments}", 
                        progress={"translation": current_prog})
        
        original_text = seg.get("text", "") if isinstance(seg, dict) else getattr(seg, "text", "")
        if not original_text.strip():
            continue

        try:
            resp = await client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": f"Translate to {target_language}. NATURAL AND CONCISE FOR DUBBING."},
                    {"role": "user", "content": original_text}
                ]
            )
            trans_text = resp.choices[0].message.content.strip()
            
            # TTS
            status_callback(job_id, "Processing", f"Synthesizing voice {idx+1}/{total_segments}", 
                            progress={"tts": current_prog})
            
            tts_path = os.path.join(work_dir, f"tts_{idx}.mp3")
            tts_resp = await client.audio.speech.create(
                model="tts-1",
                voice="alloy",
                input=trans_text
            )
            tts_resp.stream_to_file(tts_path)
            
            start_time = float(seg.get("start", 0.0)) if isinstance(seg, dict) else float(getattr(seg, "start", 0.0))
            
            dubbed_audio_segments.append({
                "path": tts_path,
                "start": start_time
            })
        except Exception as e:
            logger.warning(f"Failed to process segment {idx}: {e}")
            continue
        
    status_callback(job_id, "Processing", "Dubbing complete.", progress={"translation": 100, "tts": 100})
    check_cancelled()
    
    if not dubbed_audio_segments:
        raise Exception("Failed to generate any dubbed audio segments.")

    # 4. Assembly
    status_callback(job_id, "Assembling", "Muxing final video...")
    try:
        probe_cmd = ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', video_path]
        duration_out = subprocess.check_output(probe_cmd).decode('utf-8').strip()
        duration = float(duration_out)
    except Exception as e:
        logger.error(f"Probe failed: {e}")
        duration = segments_data[-1].get('end', 0) + 2.0

    mixed_audio_path = os.path.join(work_dir, "mixed_audio.mp3")
    
    # Construct complex filter for mixing many segments
    ffmpeg_cmd = ['ffmpeg', '-y', '-f', 'lavfi', '-i', f'anullsrc=r=44100:cl=stereo:d={duration}']
    for s in dubbed_audio_segments:
        ffmpeg_cmd.extend(['-i', s['path']])
    
    filter_complex = ""
    for i, s in enumerate(dubbed_audio_segments):
        delay_ms = int(s["start"] * 1000)
        filter_complex += f"[{i+1}:a]adelay={delay_ms}|{delay_ms}[a{i+1}];"
    
    mix_inputs = "".join([f"[a{i+1}]" for i in range(len(dubbed_audio_segments))])
    filter_complex += f"[0:a]{mix_inputs}amix=inputs={len(dubbed_audio_segments)+1}:duration=first[aout]"
    
    ffmpeg_cmd.extend(['-filter_complex', filter_complex, '-map', '[aout]', mixed_audio_path])
    
    try:
        result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(f"FFmpeg mixing failed: {result.stderr}")
            raise Exception(f"FFmpeg mixing failed: {result.stderr[:200]}")
    except Exception as e:
        logger.error(f"Subprocess run failed: {e}")
        raise e
    
    final_output = os.path.join(work_dir, "final.mp4")
    # Mux original video with new audio
    mux_cmd = ['ffmpeg', '-y', '-i', video_path, '-i', mixed_audio_path, '-c:v', 'copy', '-c:a', 'aac', '-map', '0:v:0', '-map', '1:a:0', '-shortest', final_output]
    
    try:
        result = subprocess.run(mux_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(f"FFmpeg muxing failed: {result.stderr}")
            raise Exception(f"FFmpeg muxing failed: {result.stderr[:200]}")
    except Exception as e:
        logger.error(f"Subprocess run failed: {e}")
        raise e

    if not os.path.exists(final_output):
        raise Exception("Final video file was not created.")

    return f"/output/{job_id}/final.mp4"
