// src/igService.ts
import { URL } from "node:url";

const USER_AGENT = process.env.USER_AGENT;
const X_IG_APP_ID = process.env.X_IG_APP_ID;
// Optional, but often required depending on IG changes
const X_FB_LSD = process.env.X_FB_LSD ?? "AVqbxe3J_YA";
const X_ASBD_ID = process.env.X_ASBD_ID ?? "129477";
const DOC_ID = process.env.IG_DOC_ID ?? "10015901848480474";

if (!USER_AGENT || !X_IG_APP_ID) {
  throw new Error("Missing env: USER_AGENT and/or X_IG_APP_ID");
}

export function getId(instagramUrl: string): string | null {
  const regex =
    /instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(p|reels?|stories)\/([A-Za-z0-9-_]+)/;
  const match = instagramUrl.match(regex);
  return match && match[2] ? match[2] : null;
}

export async function getInstagramGraphqlData(inputUrl: string) {
  const igId = getId(inputUrl);
  if (!igId) {
    return { ok: false, status: 400, error: "Invalid Instagram URL." };
  }

  const graphql = new URL("https://www.instagram.com/api/graphql");
  graphql.searchParams.set("variables", JSON.stringify({ shortcode: igId }));
  graphql.searchParams.set("doc_id", DOC_ID);
  graphql.searchParams.set("lsd", X_FB_LSD);

  const response = await fetch(graphql, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded",
      "X-IG-App-ID": X_IG_APP_ID,
      "X-FB-LSD": X_FB_LSD,
      "X-ASBD-ID": X_ASBD_ID,
      "Sec-Fetch-Site": "same-origin",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return {
      ok: false,
      status: response.status,
      error: `Instagram request failed (${response.status})`,
      details: text?.slice(0, 500),
    };
  }

  const json = await response.json().catch(() => null);
  const items = json?.data?.xdt_shortcode_media;

  if (!items) {
    return {
      ok: false,
      status: 404,
      error: "Media not found or response shape changed.",
    };
  }

  // Minimal stable projection
  const result = {
    __typename: items?.__typename,
    shortcode: items?.shortcode,
    dimensions: items?.dimensions,
    display_url: items?.display_url,
    display_resources: items?.display_resources,
    has_audio: items?.has_audio,
    video_url: items?.video_url,
    video_view_count: items?.video_view_count,
    video_play_count: items?.video_play_count,
    is_video: items?.is_video,
    caption: items?.edge_media_to_caption?.edges?.[0]?.node?.text,
    is_paid_partnership: items?.is_paid_partnership,
    location: items?.location,
    owner: items?.owner,
    product_type: items?.product_type,
    video_duration: items?.video_duration,
    thumbnail_src: items?.thumbnail_src,
    clips_music_attribution_info: items?.clips_music_attribution_info,
    sidecar: items?.edge_sidecar_to_children?.edges,
  };

  return { ok: true, status: 200, data: result };
}
