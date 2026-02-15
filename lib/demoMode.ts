// Demo mode utility - determines if app should use mock data
export const isDemoMode = () => {
  return process.env.DEMO_MODE === "true" || process.env.NEXT_PUBLIC_DEMO_MODE === "true";
};

export const isDevMode = () => {
  return process.env.NODE_ENV === "development";
};
