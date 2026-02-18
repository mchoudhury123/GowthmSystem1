import { promises as fs } from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { supabaseServer } from "./supabaseServer";

import { MAX_FRAMES_PER_VIDEO } from "@/lib/config";

const execAsync = promisify(exec);
const BUCKET_NAME = "growthm";
const FRAME_COUNT = MAX_FRAMES_PER_VIDEO;

export interface ExtractedFrame {
  storagePath: string;
  publicUrl: string;
  index: number;
  timestamp: number;
}

/**
 * Extract up to 12 evenly-spaced keyframes from a local video file using ffmpeg.
 * Uploads each frame to Supabase Storage.
 * Returns array of frame metadata for video_assets insertion.
 */
export async function extractAndUploadFrames(
  videoPath: string,
  videoId: string,
  creatorId: string,
  durationSeconds: number
): Promise<ExtractedFrame[]> {
  const framesDir = path.join(path.dirname(videoPath), "frames");
  await fs.mkdir(framesDir, { recursive: true });

  // Verify video file exists
  try {
    const stats = await fs.stat(videoPath);
    if (stats.size < 1000) {
      console.warn(`[FrameExtraction] Video file too small (${stats.size} bytes), skipping`);
      return [];
    }
  } catch {
    console.warn(`[FrameExtraction] Video file not found at ${videoPath}, skipping`);
    return [];
  }

  // Calculate timestamps for each frame
  const effectiveDuration = Math.max(durationSeconds, 1);
  const interval = effectiveDuration / (FRAME_COUNT + 1);

  console.log(`[FrameExtraction] Extracting ${FRAME_COUNT} frames from ${videoPath} (${effectiveDuration}s)`);

  const frames: ExtractedFrame[] = [];

  for (let i = 1; i <= FRAME_COUNT; i++) {
    const timestamp = Math.min(i * interval, effectiveDuration - 0.1);
    const paddedIndex = String(i).padStart(2, "0");
    const framePath = path.join(framesDir, `frame_${paddedIndex}.jpg`);

    try {
      // Use -ss before -i for fast seek
      const command = `ffmpeg -ss ${timestamp.toFixed(2)} -i "${videoPath}" -frames:v 1 -q:v 2 "${framePath}" -y`;
      await execAsync(command, { timeout: 15000 });

      // Verify frame was created
      const frameStats = await fs.stat(framePath);
      if (frameStats.size < 500) continue; // Skip tiny/corrupt frames
    } catch {
      // Frame extraction at this timestamp failed, continue
      continue;
    }

    // Upload to Supabase Storage
    const storagePath = `${creatorId}/${videoId}/frames/frame_${paddedIndex}.jpg`;
    try {
      const fileBuffer = await fs.readFile(framePath);

      const { error: uploadError } = await supabaseServer.storage
        .from(BUCKET_NAME)
        .upload(storagePath, fileBuffer, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        console.warn(`[FrameExtraction] Upload error for frame ${i}:`, uploadError.message);
        continue;
      }

      const { data: urlData } = supabaseServer.storage
        .from(BUCKET_NAME)
        .getPublicUrl(storagePath);

      frames.push({
        storagePath,
        publicUrl: urlData.publicUrl,
        index: i,
        timestamp: Math.round(timestamp * 10) / 10,
      });
    } catch (err) {
      console.warn(`[FrameExtraction] Failed to upload frame ${i}:`, err);
    }
  }

  console.log(`[FrameExtraction] Uploaded ${frames.length} frames for video ${videoId}`);
  return frames;
}
