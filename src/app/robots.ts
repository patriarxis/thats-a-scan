import type { MetadataRoute } from "next";

const DEFAULT_SITE_URL = "https://map.uphellas.gr";

const ALLOW_ALL_BOTS = [
  "Googlebot",
  "Bingbot",
  "Yandex",
  "Applebot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-Web",
  "PerplexityBot",
  "Perplexity-User",
  "Amazonbot",
  "FacebookBot",
  "LinkedInBot",
] as const;

const BLOCKED_TRAINING_BOTS = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Meta-ExternalAgent",
  "Meta-ExternalFetcher",
  "Bytespider",
  "cohere-ai",
  "Diffbot",
  "ImagesiftBot",
  "YouBot",
  "DuckAssistBot",
  "Timpibot",
  "Omgilibot",
  "DeepSeekBot",
  "GrokBot",
  "Grok",
] as const;

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL;
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  const allowRules: MetadataRoute.Robots["rules"] = ALLOW_ALL_BOTS.map((userAgent) => ({
    userAgent,
    allow: "/",
  }));

  const blockedRules: MetadataRoute.Robots["rules"] = BLOCKED_TRAINING_BOTS.map((userAgent) => ({
    userAgent,
    disallow: "/",
  }));

  return {
    rules: [
      ...allowRules,
      ...blockedRules,
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/*?utm_*",
          "/*?fbclid=*",
          "/*?gclid=*",
          "/*?ref=*",
          "/*?mc_cid=*",
          "/*?mc_eid=*",
          "/*?hsa_*",
          "/api/",
          "/_next/",
          "/404",
          "/401",
        ],
      },
    ],
    sitemap: `${normalizedBaseUrl}/sitemap.xml`,
  };
}
