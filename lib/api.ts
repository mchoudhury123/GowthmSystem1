// API utility functions for fetching data

export async function fetchDashboardData(creatorId: string) {
  const response = await fetch(`/api/creators/${creatorId}/dashboard`);
  if (!response.ok) {
    throw new Error("Failed to fetch dashboard data");
  }
  return response.json();
}

export async function createCreator(handle: string, niche?: string) {
  const response = await fetch("/api/creators", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle, niche }),
  });

  if (!response.ok) {
    throw new Error("Failed to create creator");
  }

  return response.json();
}

export async function runVideoAnalysis(videoId: string, transcriptText: string) {
  const response = await fetch(`/api/videos/${videoId}/run-analysis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcriptText }),
  });

  if (!response.ok) {
    throw new Error("Failed to run analysis");
  }

  return response.json();
}

export async function generateWeeklySummary(creatorId: string) {
  const response = await fetch(`/api/creators/${creatorId}/generate-weekly`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to generate weekly summary");
  }

  return response.json();
}

export async function recomputeDashboardCache(creatorId: string) {
  const response = await fetch(`/api/creators/${creatorId}/recompute-cache`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to recompute dashboard cache");
  }

  return response.json();
}

export async function retryFailedVideo(videoId: string) {
  const response = await fetch(`/api/videos/${videoId}/retry`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to retry video");
  }

  return response.json();
}

export async function fetchQueueData(creatorId: string) {
  const response = await fetch(`/api/creators/${creatorId}/queue`);
  if (!response.ok) {
    throw new Error("Failed to fetch queue data");
  }
  return response.json();
}

export async function recoverStuckJobs() {
  const response = await fetch("/api/jobs/recover", { method: "POST" });
  if (!response.ok) {
    throw new Error("Failed to recover stuck jobs");
  }
  return response.json();
}

export async function fetchVideoAssets(videoId: string) {
  const response = await fetch(`/api/videos/${videoId}/assets`);

  if (!response.ok) {
    throw new Error("Failed to fetch video assets");
  }

  return response.json();
}

export async function acknowledgeInsights(creatorId: string) {
  const response = await fetch(`/api/creators/${creatorId}/acknowledge`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to acknowledge insights");
  }

  return response.json();
}
