import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import {
  getStoredTokens,
  isTokenExpired,
  refreshAccessToken,
  clearTokens,
} from "../utils/spotifyAuth";
import {
  getCurrentUser,
  getUserPlaylists,
  getLikedSongs as apiGetLikedSongs,
  play as apiPlay,
  skipNext as apiSkipNext,
  skipPrevious as apiSkipPrevious,
  seek as apiSeek,
  setVolume as apiSetVolume,
  setShuffle as apiSetShuffle,
  setRepeat as apiSetRepeat,
  searchTracks as apiSearchTracks,
  TokenExpiredError,
} from "../utils/spotifyApi";

const SpotifyContext = createContext();

const SDK_SRC = "https://sdk.scdn.co/spotify-player.js";

export function SpotifyProvider({ children }) {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [token, setToken] = useState(null);

  // Player state
  const [player, setPlayer] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [volume, setVolumeState] = useState(50);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState("off");
  const [playlists, setPlaylists] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);

  const playerRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const positionIntervalRef = useRef(null);
  const tokenRef = useRef(token);
  const deviceIdRef = useRef(deviceId);

  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => { deviceIdRef.current = deviceId; }, [deviceId]);

  // Helper: get a valid token, refreshing if needed
  const getValidToken = useCallback(async () => {
    if (!isTokenExpired()) {
      const stored = getStoredTokens();
      return stored?.accessToken;
    }
    try {
      const tokens = await refreshAccessToken();
      setToken(tokens.accessToken);
      return tokens.accessToken;
    } catch {
      disconnect();
      return null;
    }
  }, []);

  // Helper: run an API call with auto-retry on 401
  const withToken = useCallback(
    async (apiFn) => {
      let t = tokenRef.current;
      if (!t) t = await getValidToken();
      if (!t) return;
      try {
        return await apiFn(t);
      } catch (err) {
        if (err instanceof TokenExpiredError) {
          t = await getValidToken();
          if (t) return await apiFn(t);
        }
        throw err;
      }
    },
    [getValidToken]
  );

  // --- Init: check stored tokens on mount ---
  useEffect(() => {
    (async () => {
      const stored = getStoredTokens();
      if (!stored) return;

      let accessToken = stored.accessToken;
      if (isTokenExpired()) {
        try {
          const refreshed = await refreshAccessToken();
          accessToken = refreshed.accessToken;
        } catch {
          clearTokens();
          return;
        }
      }

      setToken(accessToken);
      setIsAuthenticated(true);

      try {
        const profile = await getCurrentUser(accessToken);
        setUser(profile);
        setIsPremium(profile.product === "premium");
      } catch (e) { console.error("[Spotify] Profile fetch failed:", e.message); }

      try {
        const pl = await getUserPlaylists(accessToken);
        setPlaylists(pl.items || []);
      } catch (e) { console.error("[Spotify] Playlists fetch failed:", e.message); }

      try {
        const allLiked = [];
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
          const liked = await apiGetLikedSongs(accessToken, 50, offset);
          const items = liked.items || [];
          allLiked.push(...items);
          offset += items.length;
          hasMore = items.length === 50 && liked.next;
        }
        setLikedSongs(
          allLiked.filter((item) => item.track).map((item) => ({
            id: item.track.id,
            name: item.track.name,
            artists: item.track.artists.map((a) => a.name).join(", "),
            albumArt: item.track.album.images?.[2]?.url || item.track.album.images?.[0]?.url || null,
            uri: item.track.uri,
            durationMs: item.track.duration_ms,
          }))
        );
      } catch (e) { console.error("[Spotify] Liked songs fetch failed:", e.message); }
    })();
  }, []);

  // --- Load SDK & create player when authenticated + premium ---
  useEffect(() => {
    if (!isAuthenticated || !isPremium || !token) return;

    if (document.querySelector(`script[src="${SDK_SRC}"]`)) {
      if (window.Spotify && !playerRef.current) {
        createPlayer(token);
      }
      return;
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
      createPlayer(token);
    };

    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    document.body.appendChild(script);

    return () => {
      window.onSpotifyWebPlaybackSDKReady = null;
    };
  }, [isAuthenticated, isPremium, token]);

  function createPlayer(accessToken) {
    if (playerRef.current) return;

    const p = new window.Spotify.Player({
      name: "Nudge Player",
      getOAuthToken: async (cb) => {
        const t = await getValidToken();
        if (t) cb(t);
      },
      volume: 0.5,
    });

    p.addListener("ready", ({ device_id }) => {
      setDeviceId(device_id);
      deviceIdRef.current = device_id;
      setIsReady(true);
    });

    p.addListener("not_ready", () => {
      setIsReady(false);
    });

    p.addListener("player_state_changed", (state) => {
      if (!state) {
        setIsPlaying(false);
        setCurrentTrack(null);
        return;
      }

      setIsPlaying(!state.paused);
      setPositionMs(state.position);
      setDurationMs(state.duration);
      setShuffle(state.shuffle);

      const repeatMap = { 0: "off", 1: "context", 2: "track" };
      setRepeatMode(repeatMap[state.repeat_mode] || "off");

      const track = state.track_window?.current_track;
      if (track) {
        setCurrentTrack({
          id: track.id,
          name: track.name,
          artists: track.artists.map((a) => a.name).join(", "),
          albumName: track.album.name,
          albumArt:
            track.album.images?.[0]?.url ||
            track.album.images?.[1]?.url ||
            null,
          albumArtSmall: track.album.images?.[2]?.url || track.album.images?.[0]?.url || null,
          uri: track.uri,
        });
      }
    });

    p.addListener("initialization_error", ({ message }) => {
      console.error("Spotify init error:", message);
    });
    p.addListener("authentication_error", ({ message }) => {
      console.error("Spotify auth error:", message);
    });
    p.addListener("account_error", ({ message }) => {
      console.error("Spotify account error:", message);
    });

    p.connect();
    playerRef.current = p;
    setPlayer(p);
  }

  // --- Token refresh timer ---
  useEffect(() => {
    if (!isAuthenticated) return;

    const scheduleRefresh = () => {
      const stored = getStoredTokens();
      if (!stored) return;
      const msUntilExpiry = stored.expiresAt - Date.now();
      const refreshIn = Math.max(msUntilExpiry - 5 * 60 * 1000, 10000);
      refreshTimerRef.current = setTimeout(async () => {
        try {
          const tokens = await refreshAccessToken();
          setToken(tokens.accessToken);
          scheduleRefresh();
        } catch {
          disconnect();
        }
      }, refreshIn);
    };

    scheduleRefresh();
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [isAuthenticated]);

  // --- Position polling (1s while playing) ---
  useEffect(() => {
    if (isPlaying && playerRef.current) {
      positionIntervalRef.current = setInterval(async () => {
        const state = await playerRef.current.getCurrentState();
        if (state) setPositionMs(state.position);
      }, 1000);
    } else {
      if (positionIntervalRef.current) clearInterval(positionIntervalRef.current);
    }
    return () => {
      if (positionIntervalRef.current) clearInterval(positionIntervalRef.current);
    };
  }, [isPlaying]);

  // --- Controls ---

  const togglePlay = useCallback(async () => {
    if (playerRef.current) {
      playerRef.current.togglePlay();
    }
  }, []);

  const skipNext = useCallback(async () => {
    try { await withToken((t) => apiSkipNext(t)); } catch { /* ignore */ }
  }, [withToken]);

  const skipPrevious = useCallback(async () => {
    try { await withToken((t) => apiSkipPrevious(t)); } catch { /* ignore */ }
  }, [withToken]);

  const seekTo = useCallback(async (ms) => {
    try {
      await withToken((t) => apiSeek(t, Math.round(ms)));
      setPositionMs(ms);
    } catch { /* ignore */ }
  }, [withToken]);

  const setVolume = useCallback(async (percent) => {
    setVolumeState(percent);
    if (playerRef.current) {
      playerRef.current.setVolume(percent / 100);
    }
  }, []);

  const toggleShuffle = useCallback(async () => {
    try {
      await withToken((t) => apiSetShuffle(t, !shuffle));
      setShuffle((s) => !s);
    } catch { /* ignore */ }
  }, [withToken, shuffle]);

  const cycleRepeat = useCallback(async () => {
    const next = repeatMode === "off" ? "context" : repeatMode === "context" ? "track" : "off";
    try {
      await withToken((t) => apiSetRepeat(t, next));
      setRepeatMode(next);
    } catch { /* ignore */ }
  }, [withToken, repeatMode]);

  const playContext = useCallback(
    async (contextUri, offset = 0) => {
      try {
        const did = deviceIdRef.current;
        await withToken((t) => apiPlay(t, { contextUri, offset, deviceId: did }));
      } catch { /* ignore */ }
    },
    [withToken]
  );

  const playUris = useCallback(
    async (uris) => {
      try {
        const did = deviceIdRef.current;
        await withToken((t) => apiPlay(t, { uris, deviceId: did }));
      } catch { /* ignore */ }
    },
    [withToken]
  );

  const search = useCallback(
    async (query) => {
      try {
        const result = await withToken((t) => apiSearchTracks(t, query));
        return { tracks: result?.tracks?.items || [], error: null };
      } catch (e) {
        console.error("[Spotify] Search failed:", e.message);
        return { tracks: [], error: e.message };
      }
    },
    [withToken]
  );

  const playPlaylist = useCallback(
    async (playlistUri, offset = 0) => {
      try {
        const did = deviceIdRef.current;
        await withToken((t) => apiPlay(t, { contextUri: playlistUri, offset, deviceId: did }));
      } catch (e) {
        console.error("[Spotify] Play playlist failed:", e.message);
      }
    },
    [withToken]
  );

  // --- Re-init after callback ---
  const reinitialize = useCallback(async () => {
    const stored = getStoredTokens();
    if (!stored) return;

    setToken(stored.accessToken);
    setIsAuthenticated(true);

    try {
      const profile = await getCurrentUser(stored.accessToken);
      setUser(profile);
      setIsPremium(profile.product === "premium");
      if (profile.country) setUserCountry(profile.country);
    } catch (e) { console.error("[Spotify] reinit profile:", e.message); }

    try {
      const pl = await getUserPlaylists(stored.accessToken);
      setPlaylists(pl.items || []);
    } catch (e) { console.error("[Spotify] reinit playlists:", e.message); }

    try {
      const allLiked = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const liked = await apiGetLikedSongs(stored.accessToken, 50, offset);
        const items = liked.items || [];
        allLiked.push(...items);
        offset += items.length;
        hasMore = items.length === 50 && liked.next;
      }
      setLikedSongs(
        allLiked.filter((item) => item.track).map((item) => ({
          id: item.track.id,
          name: item.track.name,
          artists: item.track.artists.map((a) => a.name).join(", "),
          albumArt: item.track.album.images?.[2]?.url || item.track.album.images?.[0]?.url || null,
          uri: item.track.uri,
          durationMs: item.track.duration_ms,
        }))
      );
    } catch (e) { console.error("[Spotify] reinit liked:", e.message); }
  }, []);

  // --- Disconnect ---
  const disconnect = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.disconnect();
      playerRef.current = null;
    }
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    if (positionIntervalRef.current) clearInterval(positionIntervalRef.current);

    clearTokens();
    setIsAuthenticated(false);
    setUser(null);
    setIsPremium(false);
    setToken(null);
    setPlayer(null);
    setDeviceId(null);
    setIsReady(false);
    setIsPlaying(false);
    setCurrentTrack(null);
    setPositionMs(0);
    setDurationMs(0);
    setPlaylists([]);
    setLikedSongs([]);
  }, []);

  return (
    <SpotifyContext.Provider
      value={{
        isAuthenticated,
        user,
        isPremium,
        isReady,
        isPlaying,
        currentTrack,
        positionMs,
        durationMs,
        volume,
        shuffle,
        repeatMode,
        deviceId,
        playlists,
        likedSongs,
        togglePlay,
        skipNext,
        skipPrevious,
        seekTo,
        setVolume,
        toggleShuffle,
        cycleRepeat,
        playContext,
        playUris,
        search,
        playPlaylist,
        reinitialize,
        disconnect,
      }}
    >
      {children}
    </SpotifyContext.Provider>
  );
}

export const useSpotify = () => useContext(SpotifyContext);
