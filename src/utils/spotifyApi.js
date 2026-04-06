const BASE = "https://api.spotify.com/v1";

class TokenExpiredError extends Error {
  constructor() {
    super("TOKEN_EXPIRED");
    this.name = "TokenExpiredError";
  }
}

async function spotifyFetch(endpoint, token, options = {}) {
  const res = await fetch(`${BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 401) throw new TokenExpiredError();
  if (res.status === 204) return null;
  if (!res.ok) {
    const text = await res.text();
    let msg = `Spotify API error ${res.status}`;
    try {
      const err = JSON.parse(text);
      msg = err.error?.message || msg;
    } catch { /* not JSON */ }
    console.error(`[Spotify] ${res.status} ${endpoint}:`, msg);
    throw new Error(msg);
  }
  return res.json();
}


// --- User ---

export function getCurrentUser(token) {
  return spotifyFetch("/me", token);
}

// --- Playback ---

export function getPlaybackState(token) {
  return spotifyFetch("/me/player", token);
}

export function play(token, { contextUri, uris, offset, deviceId } = {}) {
  const body = {};
  if (contextUri) body.context_uri = contextUri;
  if (uris) body.uris = uris;
  if (offset !== undefined) body.offset = { position: offset };
  const qs = deviceId ? `?device_id=${deviceId}` : "";
  return spotifyFetch(`/me/player/play${qs}`, token, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function pause(token) {
  return spotifyFetch("/me/player/pause", token, { method: "PUT" });
}

export function skipNext(token) {
  return spotifyFetch("/me/player/next", token, { method: "POST" });
}

export function skipPrevious(token) {
  return spotifyFetch("/me/player/previous", token, { method: "POST" });
}

export function seek(token, positionMs) {
  return spotifyFetch(`/me/player/seek?position_ms=${positionMs}`, token, {
    method: "PUT",
  });
}

export function setVolume(token, volumePercent) {
  return spotifyFetch(
    `/me/player/volume?volume_percent=${Math.round(volumePercent)}`,
    token,
    { method: "PUT" }
  );
}

export function setShuffle(token, state) {
  return spotifyFetch(`/me/player/shuffle?state=${state}`, token, {
    method: "PUT",
  });
}

export function setRepeat(token, state) {
  return spotifyFetch(`/me/player/repeat?state=${state}`, token, {
    method: "PUT",
  });
}

// --- Playlists ---

export function getUserPlaylists(token, limit = 20) {
  return spotifyFetch(`/me/playlists?limit=${limit}`, token);
}

// --- Liked Songs ---

export function getLikedSongs(token, limit = 50, offset = 0) {
  return spotifyFetch(`/me/tracks?limit=${limit}&offset=${offset}`, token);
}


// --- Search ---

export function searchTracks(token, query) {
  const q = encodeURIComponent(query);
  return spotifyFetch(`/search?q=${q}&type=track`, token);
}

export { TokenExpiredError };
