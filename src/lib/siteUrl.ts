const DEFAULT_SITE_URL = "http://localhost:3000";

export const getSiteUrl = (): URL => {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL);
  }

  if (process.env.VERCEL_URL) {
    return new URL(`https://${process.env.VERCEL_URL}`);
  }

  return new URL(DEFAULT_SITE_URL);
};
