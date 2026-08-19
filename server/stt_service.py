"""
stt_service.py
Local Speech-to-Text inference service for Physiosis using faster-whisper.

Zero Cloud Communication:
- Runs 100% on-device / locally.
- Uses CTranslate2 + ONNX runtime on CPU/CUDA.
- Supports multilingual transcription: English, Hindi, Telugu, Tamil, Kannada, Malayalam, Bengali, Marathi.
"""

import sys
import os
import json
import argparse

def get_whisper_model(model_size="tiny", device="auto", compute_type="auto"):
    from faster_whisper import WhisperModel
    
    # Auto-detect compute type and device
    if device == "auto":
        device = "cpu"
    if compute_type == "auto":
        compute_type = "int8" if device == "cpu" else "float16"
        
    model = WhisperModel(model_size, device=device, compute_type=compute_type)
    return model

# Map ISO / locale codes to Whisper language codes
LANG_MAP = {
    "en": "en",
    "en-in": "en",
    "en-us": "en",
    "english": "en",
    "hi": "hi",
    "hi-in": "hi",
    "hindi": "hi",
    "te": "te",
    "te-in": "te",
    "telugu": "te",
    "ta": "ta",
    "ta-in": "ta",
    "tamil": "ta",
    "kn": "kn",
    "kn-in": "kn",
    "kannada": "kn",
    "ml": "ml",
    "ml-in": "ml",
    "malayalam": "ml",
    "bn": "bn",
    "bn-in": "bn",
    "bengali": "bn",
    "mr": "mr",
    "mr-in": "mr",
    "marathi": "mr",
    "gu": "gu",
    "gu-in": "gu",
    "gujarati": "gu"
}

def transcribe_audio(audio_path, language=None, model_size="tiny"):
    if not os.path.exists(audio_path):
        return {
            "success": False,
            "error": "AUDIO_FILE_NOT_FOUND",
            "message": f"Audio file not found: {audio_path}"
        }
    
    try:
        model = get_whisper_model(model_size=model_size)
        
        whisper_lang = None
        if language:
            clean_lang = language.lower().strip()
            whisper_lang = LANG_MAP.get(clean_lang, clean_lang.split("-")[0])
        
        segments, info = model.transcribe(
            audio_path,
            language=whisper_lang,
            beam_size=5,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500),
            initial_prompt="Physiotherapy, exercise, pain, movement, range of motion, rehabilitation."
        )
        
        transcript = " ".join([segment.text.strip() for segment in segments]).strip()
        
        return {
            "success": True,
            "transcript": transcript,
            "detected_language": info.language,
            "language_probability": round(info.language_probability, 3),
            "duration": round(info.duration, 2)
        }
    except Exception as e:
        return {
            "success": False,
            "error": "TRANSCRIPTION_FAILED",
            "message": str(e)
        }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Physiosis Local Whisper STT CLI")
    parser.add_argument("--audio", required=True, help="Path to input audio file (wav, webm, mp3)")
    parser.add_argument("--language", default=None, help="Language code (en, hi, te, etc.)")
    parser.add_argument("--model", default="tiny", help="Model size (tiny, base, small)")
    
    args = parser.parse_args()
    result = transcribe_audio(args.audio, language=args.language, model_size=args.model)
    
    print(json.dumps(result, ensure_ascii=False))
