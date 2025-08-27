// src/igCookieService.ts
import { URL } from "node:url";

const USER_AGENT = process.env.USER_AGENT;
const COOKIE = process.env.COOKIE; // Your logged-in IG cookie string
const X_IG_APP_ID = process.env.X_IG_APP_ID;

if (!USER_AGENT || !X_IG_APP_ID) {
  throw new Error("Missing env: USER_AGENT and/or X_IG_APP_ID");
}

// Allow running without global COOKIE if caller sends one per request
export function getId(instagramUrl: string): string | null {
  const regex =
    /instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(p|reels?|stories)\/([A-Za-z0-9-_]+)/;
  const match = instagramUrl.match(regex);
  return match && match[2] ? match[2] : null;
}

export type IgCookieFetchOptions = {
  cookieOverride?: string; // optional per-request cookie
};

export async function getInstagramDataByCookie(
  inputUrl: string,
  opts: IgCookieFetchOptions = {}
) {
  const igId = getId(inputUrl);
  if (!igId) {
    return { ok: false, status: 400, error: "Invalid Instagram URL." };
  }

  const cookie = (opts.cookieOverride || COOKIE || "").trim();
  if (!cookie) {
    return {
      ok: false,
      status: 400,
      error:
        "Missing cookie. Set env COOKIE or pass `cookieOverride`/`x-ig-cookie` header.",
    };
  }

  const endpoint = new URL(`https://www.instagram.com/p/${igId}`);
  endpoint.searchParams.set("__a", "1");
  endpoint.searchParams.set("__d", "dis");

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Cookie: cookie,
      "User-Agent": USER_AGENT!,
      "X-IG-App-ID": X_IG_APP_ID!,
      "Sec-Fetch-Site": "same-origin",
      Accept: "application/json, text/plain, */*",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      ok: false,
      status: response.status,
      error: `Instagram request failed (${response.status})`,
      details: body?.slice(0, 500),
    };
    // Common: 403 (bad/expired cookie), 302 (redirect), 429 (rate limited)
  }

  const json = await response.json().catch(() => null);

  // Adjust to the response shape you get. Your script expects `json.items[0]`
  // Some IG builds return different trees; guard carefully:
  const items = json?.items?.[0] ?? json?.graphql?.shortcode_media ?? null;
  if (!items) {
    return {
      ok: false,
      status: 404,
      error: "Media not found or response shape changed.",
      details:
        typeof json === "object"
          ? JSON.stringify(Object.keys(json))
          : undefined,
    };
  }

  // Handle carousel shape you used
  let carousel_media:
    | Array<{
        image_versions?: any;
        video_versions?: any;
      }>
    | undefined;

  if (
    items?.product_type === "carousel_container" &&
    Array.isArray(items?.carousel_media)
  ) {
    carousel_media = items.carousel_media.map((el: any) => ({
      image_versions: el?.image_versions2?.candidates,
      video_versions: el?.video_versions,
    }));
  }

  // Project stable fields (keep minimal to reduce breakage)
  const result = {
    code: items?.code,
    created_at: items?.taken_at,
    username: items?.user?.username ?? items?.owner?.username,
    full_name: items?.user?.full_name,
    profile_picture: items?.user?.profile_pic_url,
    is_verified: items?.user?.is_verified,
    is_paid_partnership: items?.is_paid_partnership,
    product_type: items?.product_type,
    caption:
      items?.caption?.text ??
      items?.edge_media_to_caption?.edges?.[0]?.node?.text,
    like_count: items?.like_count ?? items?.edge_media_preview_like?.count,
    comment_count:
      items?.comment_count ?? items?.edge_media_to_parent_comment?.count,
    view_count: items?.view_count ?? items?.play_count,
    video_duration: items?.video_duration,
    location: items?.location,
    height: items?.original_height ?? items?.dimensions?.height,
    width: items?.original_width ?? items?.dimensions?.width,
    image_versions:
      items?.image_versions2?.candidates ?? items?.display_resources,
    video_versions:
      items?.video_versions ??
      (items?.is_video ? [{ url: items?.video_url }] : undefined),
    carousel_media,
  };

  return { ok: true, status: 200, data: result };
}
