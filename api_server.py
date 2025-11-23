from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
import os
import tempfile
from dotenv import load_dotenv
from urllib.parse import quote
import whisper
from transformers import MarianMTModel, MarianTokenizer, AutoTokenizer, AutoModelForSeq2SeqLM
from elevenlabs import ElevenLabs
import certifi
import re

# SSL fixes
os.environ["SSL_CERT_FILE"] = certifi.where()
os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()

app = FastAPI()

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load environment
load_dotenv("API.env")
api_key = os.getenv("ELEVENLABS_API_KEY")
if not api_key:
    raise RuntimeError("ELEVENLABS_API_KEY missing")

tts_client = ElevenLabs(api_key=api_key)
whisper_model = whisper.load_model("base")

# Default voice ID - same as in your main.py
DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"
M2M_MODEL_ID = "facebook/m2m100_418M"

# Translation helpers
def split_sentences(text: str) -> list:
    parts = re.split(r'(?<=[.!?])\s+', text.strip())
    return [p for p in parts if p]

def marian_model_id(src: str, tgt: str) -> str:
    return f"Helsinki-NLP/opus-mt-{src}-{tgt}"

def marian_translate_chunk(chunk: str, src: str, tgt: str) -> str:
    model_id = marian_model_id(src, tgt)
    tokenizer = MarianTokenizer.from_pretrained(model_id)
    model = MarianMTModel.from_pretrained(model_id)
    inputs = tokenizer([chunk], return_tensors="pt", padding=True, truncation=True)
    out_tokens = model.generate(**inputs, max_length=512)
    return tokenizer.decode(out_tokens[0], skip_special_tokens=True)

def marian_can_direct(src: str, tgt: str) -> bool:
    supported = {("en","fr"),("fr","en"),
                 ("en","es"),("es","en"),
                 ("en","vi"),("vi","en"),
                 ("en","zh"),("zh","en")}
    return (src, tgt) in supported

def m2m_translate_chunk(chunk: str, src: str, tgt: str) -> str:
    tokenizer = AutoTokenizer.from_pretrained(M2M_MODEL_ID)
    model = AutoModelForSeq2SeqLM.from_pretrained(M2M_MODEL_ID)
    tokenizer.src_lang = src
    inputs = tokenizer(chunk, return_tensors="pt")
    forced_bos_token_id = tokenizer.get_lang_id(tgt)
    generated_tokens = model.generate(**inputs, forced_bos_token_id=forced_bos_token_id, max_length=512)
    return tokenizer.batch_decode(generated_tokens, skip_special_tokens=True)[0]

def translate_text(text: str, src: str, tgt: str) -> str:
    if src == tgt:
        return text

    sentences = split_sentences(text)
    outputs = []
    use_m2m = (src == "pa" or tgt == "pa")

    if not use_m2m and marian_can_direct(src, tgt):
        for s in sentences:
            outputs.append(marian_translate_chunk(s, src, tgt))
        return " ".join(outputs)

    if use_m2m:
        for s in sentences:
            outputs.append(m2m_translate_chunk(s, src, tgt))
        return " ".join(outputs)

    pivot = "en"
    mid_parts = []
    if src != pivot:
        for s in sentences:
            mid_parts.append(marian_translate_chunk(s, src, pivot))
        mid_text = " ".join(mid_parts)
    else:
        mid_text = text

    final_parts = []
    for s in split_sentences(mid_text):
        if tgt == pivot:
            final_parts.append(s)
        else:
            final_parts.append(marian_translate_chunk(s, pivot, tgt))
    return " ".join(final_parts)

@app.post("/api/translate-tts")
async def translate_and_speak(
        file: UploadFile = File(...),
        src_lang: str = Form(...),
        tgt_lang: str = Form(...)
):
    """Transcribe, translate, and generate TTS using default voice"""
    # Save uploaded audio to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # Transcribe
        result = whisper_model.transcribe(tmp_path)
        transcript = result.get("text", "").strip()

        if not transcript:
            return {"error": "No speech detected"}

        print(f"Transcribed: {transcript}")

        # Translate
        translation = translate_text(transcript, src_lang, tgt_lang)
        print(f"Translation: {translation}")

        # Generate TTS using default voice
        audio = tts_client.text_to_speech.convert(
            text=translation,
            voice_id=DEFAULT_VOICE_ID,
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128",
        )
        audio_bytes = b"".join(audio)

        # Return audio with transcript and translation in headers
        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={
                "X-Original-Text": quote(transcript),
                "X-Translated-Text": quote(translation)
            }
        )

    except Exception as e:
        print(f"Error: {str(e)}")
        raise
    finally:
        os.unlink(tmp_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)