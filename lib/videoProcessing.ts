// Video Download and Audio Extraction Utility
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { exec, execSync } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Resolve absolute paths for binaries. When Next.js is launched from an IDE,
// child shells (/bin/sh) often lack /opt/homebrew/bin on PATH.
export function resolveBinary(name: string, envOverride?: string): string {
  if (envOverride) return envOverride;
  const searchPaths = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"];
  for (const dir of searchPaths) {
    const full = path.join(dir, name);
    try {
      execSync(`test -x "${full}"`, { stdio: "ignore" });
      return full;
    } catch {
      // not found here, try next
    }
  }
  return name; // fallback to bare name
}

const FFMPEG_PATH = resolveBinary("ffmpeg", process.env.FFMPEG_PATH);
const YT_DLP_PATH = resolveBinary("yt-dlp", process.env.YT_DLP_PATH);

export interface DownloadedVideo {
  videoPath: string;
  audioPath: string;
}

export function getTempDir(videoId: string): string {
  return path.join(os.tmpdir(), "growthm", videoId);
}

/**
 * Downloads a video from URL and extracts audio using yt-dlp + ffmpeg.
 * Ensures both video.mp4 and audio.mp3 exist in the temp directory.
 */
export async function downloadAndExtractAudio(videoUrl: string, videoId: string): Promise<DownloadedVideo> {
  const tmpDir = getTempDir(videoId);
  await fs.mkdir(tmpDir, { recursive: true });

  const audioPath = path.join(tmpDir, "audio.mp3");
  const videoPath = path.join(tmpDir, "video.mp4");

  console.log(`[VideoProcessing] Processing video: ${videoUrl}`);

  // Primary method: use yt-dlp to download video, then extract audio with ffmpeg
  try {
    await downloadVideoWithYtDlp(videoUrl, videoPath);
    console.log(`[VideoProcessing] Video downloaded with yt-dlp`);

    // Extract audio from the downloaded video
    await extractAudioFromVideo(videoPath, audioPath);
    console.log(`[VideoProcessing] Audio extracted from video`);

    return { videoPath, audioPath };
  } catch (error) {
    console.warn(`[VideoProcessing] yt-dlp method failed:`, error);
  }

  // Fallback: direct download + ffmpeg (works for direct video URLs)
  console.log(`[VideoProcessing] Trying direct download fallback...`);

  const videoResponse = await fetch(videoUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!videoResponse.ok) {
    throw new Error(`Failed to download video: ${videoResponse.status} ${videoResponse.statusText}`);
  }

  const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

  if (videoBuffer.length < 10000) {
    throw new Error(`Downloaded file too small (${videoBuffer.length} bytes) - likely not a valid video`);
  }

  await fs.writeFile(videoPath, videoBuffer);
  console.log(`[VideoProcessing] Video downloaded: ${videoBuffer.length} bytes`);

  // Extract audio with ffmpeg
  await extractAudioFromVideo(videoPath, audioPath);
  console.log(`[VideoProcessing] Audio extracted with ffmpeg`);

  return { videoPath, audioPath };
}

/**
 * Use yt-dlp to download the video file (not just audio)
 */
async function downloadVideoWithYtDlp(videoUrl: string, videoPath: string): Promise<void> {
  // Check yt-dlp is available
  try {
    await execAsync(`"${YT_DLP_PATH}" --version`);
  } catch {
    throw new Error("yt-dlp not available");
  }

  // Download video file
  const command = `"${YT_DLP_PATH}" --no-playlist -f "mp4" -o "${videoPath}" "${videoUrl}"`;

  console.log(`[VideoProcessing] Running yt-dlp download...`);

  try {
    const { stdout, stderr } = await execAsync(command, { timeout: 120000 });
    console.log(`[VideoProcessing] yt-dlp stdout: ${stdout.substring(0, 200)}`);
    if (stderr) console.log(`[VideoProcessing] yt-dlp stderr: ${stderr.substring(0, 200)}`);
  } catch (error) {
    throw new Error(`yt-dlp download failed: ${error instanceof Error ? error.message : error}`);
  }

  // Verify video file was created
  try {
    const stats = await fs.stat(videoPath);
    if (stats.size < 10000) {
      throw new Error(`Video file too small: ${stats.size} bytes`);
    }
    console.log(`[VideoProcessing] Video file created: ${stats.size} bytes`);
  } catch (error) {
    throw new Error(`Video file not created at ${videoPath}: ${error}`);
  }
}

/**
 * Extract audio from a local video file using ffmpeg
 */
async function extractAudioFromVideo(videoPath: string, audioPath: string): Promise<void> {
  const command = `"${FFMPEG_PATH}" -i "${videoPath}" -vn -acodec libmp3lame -q:a 2 "${audioPath}" -y`;
  await execAsync(command, { timeout: 60000 });

  const stats = await fs.stat(audioPath);
  if (stats.size === 0) {
    throw new Error("Extracted audio file is empty");
  }
}

/**
 * Cleanup temporary files
 */
export async function cleanupTempFiles(videoId: string): Promise<void> {
  const tmpDir = getTempDir(videoId);

  try {
    await fs.rm(tmpDir, { recursive: true, force: true });
    console.log(`[VideoProcessing] Cleaned up temp files for ${videoId}`);
  } catch (error) {
    console.warn(`[VideoProcessing] Failed to cleanup ${tmpDir}:`, error);
  }
}
