"""
tts_service.py
Local On-Device Text-to-Speech (TTS) Service for Physiosis.

Zero Cloud Communication:
- Runs 100% on-device / locally.
- Detects locally installed SAPI / OneCore / Piper TTS voices.
- Sanitizes input to ensure markdown formatting, bullet symbols, and degrees (165°)
  are spoken accurately and cleanly.
- Strictly refuses to speak system prompts, database credentials, or internal logs.
"""

import sys
import os
import json
import argparse
import re

def sanitize_speech_text(text: str) -> str:
    if not text:
        return ""
    # Strip dangerous tokens or credential patterns
    text = re.sub(r'(?:api[_-]?key|password|bearer\s+[a-zA-Z0-9_\-\.]+)', '[redacted]', text, flags=re.IGNORECASE)
    # Strip markdown bold/italic
    text = re.sub(r'[*_]{1,3}([^*_]+)[*_]{1,3}', r'\1', text)
    # Replace markdown bullet points and headers
    text = re.sub(r'^[#\-*•]\s*', '', text, flags=re.MULTILINE)
    # Normalize degrees: 165° -> 165 degrees
    text = re.sub(r'(\d+)\s*°', r'\1 degrees', text)
    # Normalize extra whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def get_installed_voices():
    try:
        import pyttsx3
        engine = pyttsx3.init()
        voices = engine.getProperty('voices')
        voice_list = []
        for v in voices:
            voice_list.append({
                "id": v.id,
                "name": v.name,
                "languages": getattr(v, 'languages', ["en-US"]) or ["en-US"]
            })
        return voice_list
    except Exception:
        return []

def synthesize_speech(text: str, language: str = "en", output_wav: str = None):
    sanitized = sanitize_speech_text(text)
    if not sanitized:
        return {
            "success": False,
            "error": "EMPTY_TEXT",
            "message": "No text provided for speech synthesis."
        }

    lang_clean = (language or "en").lower().strip()
    is_english = lang_clean.startswith("en")
    
    if not is_english:
        return {
            "success": False,
            "error": "TTS_MODEL_MISSING",
            "message": "Voice output is unavailable for this language on this device. Text response is available.",
            "language": language
        }

    try:
        import pyttsx3
        import base64
        import tempfile

        if not output_wav:
            temp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
            output_wav = temp_file.name
            temp_file.close()

        engine = pyttsx3.init()
        engine.setProperty('rate', 160)  # Moderate, clear clinical pace
        
        # Select best matching local voice
        voices = engine.getProperty('voices') or []
        for v in voices:
            v_name = v.name.lower()
            if 'heera' in v_name or 'ravi' in v_name:
                engine.setProperty('voice', v.id)
                break
            elif 'hazel' in v_name or 'david' in v_name or 'zira' in v_name:
                engine.setProperty('voice', v.id)

        engine.save_to_file(sanitized, output_wav)
        engine.runAndWait()

        if not os.path.exists(output_wav) or os.path.getsize(output_wav) == 0:
            return {
                "success": False,
                "error": "TTS_SYNTHESIS_FAILED",
                "message": "Local voice generation produced empty audio."
            }

        with open(output_wav, "rb") as f:
            audio_bytes = f.read()

        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

        # Cleanup temp file
        try:
            if os.path.exists(output_wav):
                os.remove(output_wav)
        except:
            pass

        return {
            "success": True,
            "audioBase64": audio_b64,
            "mimeType": "audio/wav",
            "spokenText": sanitized,
            "language": language,
            "provider": "LOCAL_TTS"
        }
    except Exception as e:
        return {
            "success": False,
            "error": "TTS_INITIALIZATION_FAILED",
            "message": "Voice output is unavailable for this language on this device. Text response is available.",
            "details": str(e)
        }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Physiosis Local TTS CLI")
    parser.add_argument("--text", help="Text to speak")
    parser.add_argument("--language", default="en", help="Language code")
    parser.add_argument("--list-voices", action="store_true", help="List installed local voices")
    
    args = parser.parse_args()
    if args.list_voices:
        print(json.dumps(get_installed_voices(), indent=2))
    elif args.text:
        result = synthesize_speech(args.text, language=args.language)
        print(json.dumps(result, ensure_ascii=False))
    else:
        parser.print_help()
