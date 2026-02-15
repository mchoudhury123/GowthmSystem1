// OpenAI Whisper Transcription Module

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY not set. Transcription will fail.");
}

export async function transcribeAudio(audioFilePath: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  console.log(`[Whisper] Transcribing audio: ${audioFilePath}`);

  // Read the audio file
  const fs = await import("fs/promises");
  const path = await import("path");
  const audioBuffer = await fs.readFile(audioFilePath);

  // Detect file type from extension
  const ext = path.extname(audioFilePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".m4a": "audio/mp4",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".webm": "audio/webm",
    ".flac": "audio/flac",
  };
  const mimeType = mimeTypes[ext] || "audio/mpeg";
  const filename = `audio${ext || ".mp3"}`;

  // Create form data
  const formData = new FormData();
  const audioBlob = new Blob([audioBuffer], { type: mimeType });
  formData.append("file", audioBlob, filename);
  formData.append("model", "whisper-1");
  formData.append("language", "en"); // Can make this dynamic based on creator
  formData.append("response_format", "text");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Whisper API error: ${response.status} ${errorText}`);
  }

  const transcript = await response.text();

  console.log(`[Whisper] Transcription complete: ${transcript.length} characters`);

  return transcript.trim();
}

// Alternative: Transcribe from URL (if audio is hosted)
export async function transcribeAudioFromUrl(audioUrl: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  console.log(`[Whisper] Downloading and transcribing: ${audioUrl}`);

  // Download audio first
  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) {
    throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
  }

  const audioBuffer = await audioResponse.arrayBuffer();

  // Create form data
  const formData = new FormData();
  const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
  formData.append("file", audioBlob, "audio.mp3");
  formData.append("model", "whisper-1");
  formData.append("language", "en");
  formData.append("response_format", "text");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Whisper API error: ${response.status} ${errorText}`);
  }

  const transcript = await response.text();

  console.log(`[Whisper] Transcription complete: ${transcript.length} characters`);

  return transcript.trim();
}
