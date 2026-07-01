import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const YT_ID = /^[a-zA-Z0-9_-]{11}$/;

function extractVideoId(input: string): string | null {
  if (YT_ID.test(input)) return input;
  try {
    const url = new URL(input);
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.slice(1);
      if (YT_ID.test(id)) return id;
    }
    if (url.hostname.includes("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v && YT_ID.test(v)) return v;
      const parts = url.pathname.split("/");
      const last = parts[parts.length - 1];
      if (YT_ID.test(last)) return last;
    }
  } catch {}
  return null;
}

export type YtSearchResult = {
  video_id: string;
  title: string;
  channel: string | null;
  thumbnail: string;
  duration_text?: string | null;
};

/**
 * Search YouTube by scraping the public results page.
 * Works from the Cloudflare Worker runtime — no API key needed.
 */
export const searchYouTube = createServerFn({ method: "POST" })
  .inputValidator((input: { q: string }) => ({ q: z.string().min(1).max(200).parse(input.q) }))
  .handler(async ({ data }): Promise<{ results: YtSearchResult[] }> => {
    // If the input is a direct URL/ID, resolve it via oEmbed
    const directId = extractVideoId(data.q);
    if (directId) {
      try {
        const resp = await fetch(
          `https://www.youtube.com/oembed?url=https%3A//www.youtube.com/watch%3Fv%3D${directId}&format=json`,
        );
        if (resp.ok) {
          const meta = (await resp.json()) as { title?: string; author_name?: string };
          return {
            results: [
              {
                video_id: directId,
                title: meta.title ?? "Untitled",
                channel: meta.author_name ?? null,
                thumbnail: `https://i.ytimg.com/vi/${directId}/hqdefault.jpg`,
              },
            ],
          };
        }
      } catch {}
      return {
        results: [
          {
            video_id: directId,
            title: "YouTube video",
            channel: null,
            thumbnail: `https://i.ytimg.com/vi/${directId}/hqdefault.jpg`,
          },
        ],
      };
    }

    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(data.q)}&sp=EgIQAQ%253D%253D`; // filter to videos
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!resp.ok) return { results: [] };
    const html = await resp.text();
    const match = html.match(/var ytInitialData = ({[\s\S]+?});<\/script>/);
    if (!match) return { results: [] };

    let json: unknown;
    try {
      json = JSON.parse(match[1]);
    } catch {
      return { results: [] };
    }

    const results: YtSearchResult[] = [];
    const walk = (node: unknown) => {
      if (!node || results.length >= 20) return;
      if (Array.isArray(node)) {
        for (const item of node) walk(item);
        return;
      }
      if (typeof node !== "object") return;
      const obj = node as Record<string, unknown>;
      if ("videoRenderer" in obj) {
        const v = obj.videoRenderer as Record<string, unknown>;
        const videoId = v.videoId as string | undefined;
        const titleRuns = (v.title as Record<string, unknown>)?.runs as
          | Array<{ text?: string }>
          | undefined;
        const title = titleRuns?.[0]?.text;
        const channelRuns =
          ((v.ownerText as Record<string, unknown>)?.runs as Array<{ text?: string }>) ||
          ((v.longBylineText as Record<string, unknown>)?.runs as Array<{ text?: string }>);
        const channel = channelRuns?.[0]?.text ?? null;
        const durText = ((v.lengthText as Record<string, unknown>)?.simpleText as string) ?? null;
        if (videoId && title && YT_ID.test(videoId)) {
          results.push({
            video_id: videoId,
            title,
            channel,
            thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            duration_text: durText,
          });
        }
        return;
      }
      for (const key of Object.keys(obj)) walk(obj[key]);
    };
    walk(json);
    return { results: results.slice(0, 15) };
  });
