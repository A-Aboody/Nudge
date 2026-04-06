import {
  Box,
  Flex,
  Text,
  HStack,
  VStack,
  Image,
  IconButton,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
} from "@chakra-ui/react";
import {
  FiPlay,
  FiPause,
  FiSkipForward,
  FiSkipBack,
  FiMusic,
  FiSearch,
  FiShuffle,
  FiRepeat,
  FiHeart,
  FiList,
} from "react-icons/fi";
import { useState, useRef, useCallback } from "react";
import { useSpotify } from "../../context/SpotifyContext";
import { initiateSpotifyLogin } from "../../utils/spotifyAuth";

const formatTime = (ms) => {
  if (!ms) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const SpotifyWidget = () => {
  const {
    isAuthenticated,
    isPremium,
    isReady,
    isPlaying,
    currentTrack,
    positionMs,
    durationMs,
    togglePlay,
    skipNext,
    skipPrevious,
    seekTo,
    shuffle,
    toggleShuffle,
    repeatMode,
    cycleRepeat,
    playlists,
    likedSongs,
    playContext,
    playUris,
    search,
    playPlaylist,
  } = useSpotify();

  const [tab, setTab] = useState("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchError, setSearchError] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef(null);

  const handleSearch = useCallback(
    (value) => {
      setQuery(value);
      setSearchError(null);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!value.trim()) {
        setResults([]);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        setIsSearching(true);
        const { tracks, error } = await search(value.trim());
        setResults(tracks);
        setSearchError(error);
        setIsSearching(false);
      }, 400);
    },
    [search]
  );

  const handlePlayTrack = useCallback(
    (trackUri) => {
      playUris([trackUri]);
    },
    [playUris]
  );

  // Not connected
  if (!isAuthenticated) {
    return (
      <Flex direction="column" align="center" py={4} gap={3}>
        <Icon as={FiMusic} boxSize={6} color="text.tertiary" />
        <Text fontSize="sm" color="text.secondary" textAlign="center">
          Connect Spotify to play music
        </Text>
        <Box
          as="button"
          px={4}
          py={1.5}
          borderRadius="full"
          bg="#1DB954"
          color="white"
          fontSize="sm"
          fontWeight="500"
          _hover={{ bg: "#1ed760" }}
          transition="background 0.15s ease"
          onClick={initiateSpotifyLogin}
        >
          Connect Spotify
        </Box>
      </Flex>
    );
  }

  if (!isPremium) {
    return (
      <Flex direction="column" align="center" py={4} gap={2}>
        <Icon as={FiMusic} boxSize={6} color="text.tertiary" />
        <Text fontSize="sm" color="text.secondary" textAlign="center">
          Spotify Premium is required for playback
        </Text>
      </Flex>
    );
  }

  const progress = durationMs > 0 ? (positionMs / durationMs) * 100 : 0;

  return (
    <Box>
      {/* Now Playing */}
      <Box mb={3}>
        {currentTrack ? (
          <>
            <Flex gap={3} align="center" mb={2}>
              {currentTrack.albumArt ? (
                <Image
                  src={currentTrack.albumArt}
                  w="56px" h="56px" borderRadius="6px"
                  objectFit="cover" flexShrink={0}
                />
              ) : (
                <Flex
                  w="56px" h="56px" borderRadius="6px" bg="bg.surface"
                  align="center" justify="center" flexShrink={0}
                >
                  <Icon as={FiMusic} boxSize={5} color="text.tertiary" />
                </Flex>
              )}
              <Box minW={0} flex={1}>
                <Text fontSize="sm" fontWeight="500" color="text" noOfLines={1}>
                  {currentTrack.name}
                </Text>
                <Text fontSize="xs" color="text.tertiary" noOfLines={1}>
                  {currentTrack.artists}
                </Text>
                <Text fontSize="10px" color="text.tertiary" noOfLines={1} mt={0.5}>
                  {currentTrack.albumName}
                </Text>
              </Box>
            </Flex>

            {/* Progress bar */}
            <Box mb={1}>
              <Box
                w="full" h="4px" bg="bg.hover" borderRadius="full"
                overflow="hidden" cursor="pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  seekTo(pct * durationMs);
                }}
              >
                <Box
                  h="full" bg="#1DB954" borderRadius="full"
                  w={`${progress}%`} transition="width 1s linear"
                />
              </Box>
              <Flex justify="space-between" mt={0.5}>
                <Text fontSize="10px" color="text.tertiary">{formatTime(positionMs)}</Text>
                <Text fontSize="10px" color="text.tertiary">{formatTime(durationMs)}</Text>
              </Flex>
            </Box>

            {/* Controls */}
            <HStack spacing={1} justify="center">
              <IconButton
                icon={<FiShuffle size={12} />}
                variant="ghost" size="xs"
                color={shuffle ? "#1DB954" : "text.tertiary"}
                _hover={{ color: shuffle ? "#1DB954" : "text.secondary" }}
                aria-label="Shuffle" onClick={toggleShuffle} minW="28px"
              />
              <IconButton
                icon={<FiSkipBack size={14} />}
                variant="ghost" size="sm"
                color="text.secondary" _hover={{ color: "text" }}
                aria-label="Previous" onClick={skipPrevious} minW="32px"
              />
              <Flex
                as="button" w="32px" h="32px" borderRadius="full" bg="text"
                align="center" justify="center"
                _hover={{ opacity: 0.8 }} transition="opacity 0.15s"
                onClick={togglePlay}
              >
                <Icon
                  as={isPlaying ? FiPause : FiPlay}
                  boxSize={3.5} color="background"
                  ml={isPlaying ? 0 : "1px"}
                />
              </Flex>
              <IconButton
                icon={<FiSkipForward size={14} />}
                variant="ghost" size="sm"
                color="text.secondary" _hover={{ color: "text" }}
                aria-label="Next" onClick={skipNext} minW="32px"
              />
              <IconButton
                icon={<FiRepeat size={12} />}
                variant="ghost" size="xs"
                color={repeatMode !== "off" ? "#1DB954" : "text.tertiary"}
                _hover={{ color: repeatMode !== "off" ? "#1DB954" : "text.secondary" }}
                aria-label="Repeat" onClick={cycleRepeat} minW="28px"
              />
            </HStack>
          </>
        ) : (
          <Flex
            direction="column" align="center" py={3} gap={1}
            bg="bg.surface" borderRadius="6px"
          >
            <Icon as={FiMusic} boxSize={5} color="text.tertiary" />
            <Text fontSize="xs" color="text.tertiary">
              {isReady ? "Search or pick a song to start playing" : "Connecting to Spotify..."}
            </Text>
          </Flex>
        )}
      </Box>

      {/* Tabs */}
      {(
        <>
          <HStack spacing={0} mb={3} borderBottom="1px solid" borderColor="border">
            {[
              { id: "search", icon: FiSearch, label: "Search" },
              { id: "liked", icon: FiHeart, label: "Liked" },
              { id: "playlists", icon: FiList, label: "Playlists" },
            ].map((t) => (
              <Box
                key={t.id}
                as="button"
                flex={1}
                py={1.5}
                display="flex"
                alignItems="center"
                justifyContent="center"
                gap={1.5}
                borderBottom="2px solid"
                borderColor={tab === t.id ? "#1DB954" : "transparent"}
                color={tab === t.id ? "text" : "text.tertiary"}
                _hover={{ color: "text" }}
                transition="all 0.15s ease"
                onClick={() => setTab(t.id)}
              >
                <Icon as={t.icon} boxSize={3} />
                <Text fontSize="11px" fontWeight={tab === t.id ? "500" : "400"}>
                  {t.label}
                </Text>
              </Box>
            ))}
          </HStack>

          {/* Tab Content */}
          <Box maxH="240px" overflowY="auto">
            {tab === "search" && (
              <Box>
                <InputGroup size="sm" mb={2}>
                  <InputLeftElement pointerEvents="none">
                    <Icon as={FiSearch} color="text.tertiary" boxSize={3.5} />
                  </InputLeftElement>
                  <Input
                    placeholder="Search songs, artists..."
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                    borderRadius="6px"
                    fontSize="xs"
                    bg="bg.surface"
                    border="1px solid"
                    borderColor="border"
                    _hover={{ borderColor: "bg.active" }}
                    _focus={{ borderColor: "primary", boxShadow: "none" }}
                    _placeholder={{ color: "text.tertiary" }}
                  />
                </InputGroup>

                {isSearching ? (
                  <Text fontSize="xs" color="text.tertiary" textAlign="center" py={3}>
                    Searching...
                  </Text>
                ) : searchError ? (
                  <Text fontSize="xs" color="red.400" textAlign="center" py={3}>
                    Search failed: {searchError}
                  </Text>
                ) : results.length > 0 ? (
                  <TrackList
                    tracks={results.slice(0, 10).map((t) => ({
                      id: t.id,
                      name: t.name,
                      artists: t.artists?.map((a) => a.name).join(", "),
                      albumArt: t.album?.images?.[2]?.url || t.album?.images?.[0]?.url,
                      uri: t.uri,
                      durationMs: t.duration_ms,
                    }))}
                    onPlay={handlePlayTrack}
                    currentTrackId={currentTrack?.id}
                  />
                ) : query.trim() ? (
                  <Text fontSize="xs" color="text.tertiary" textAlign="center" py={3}>
                    No results found
                  </Text>
                ) : (
                  <Text fontSize="xs" color="text.tertiary" textAlign="center" py={3}>
                    Type to search for music
                  </Text>
                )}
              </Box>
            )}

            {tab === "liked" && (
              <Box>
                {likedSongs.length > 0 ? (
                  <TrackList
                    tracks={likedSongs}
                    onPlay={handlePlayTrack}
                    currentTrackId={currentTrack?.id}
                  />
                ) : (
                  <Flex direction="column" align="center" py={3} gap={2}>
                    <Text fontSize="xs" color="text.tertiary" textAlign="center">
                      No liked songs loaded
                    </Text>
                    <Text fontSize="10px" color="text.tertiary" textAlign="center">
                      Try disconnecting and reconnecting in Settings
                    </Text>
                  </Flex>
                )}
              </Box>
            )}

            {tab === "playlists" && (
              <Box>
                {playlists.length > 0 ? (
                  <VStack spacing={0} w="full">
                    {playlists.map((pl) => (
                      <Flex
                        key={pl.id}
                        w="full" py={1.5} px={2} mx={-2}
                        align="center" gap={2.5}
                        cursor="pointer" borderRadius="4px"
                        _hover={{ bg: "bg.hover" }}
                        transition="background 0.1s ease"
                        role="group"
                        onClick={() => playPlaylist(pl.uri)}
                      >
                        {pl.images?.[0]?.url ? (
                          <Image
                            src={pl.images[0].url}
                            w="36px" h="36px" borderRadius="4px"
                            objectFit="cover" flexShrink={0}
                          />
                        ) : (
                          <Flex
                            w="36px" h="36px" borderRadius="4px"
                            bg="bg.surface" align="center" justify="center" flexShrink={0}
                          >
                            <Icon as={FiMusic} boxSize={3.5} color="text.tertiary" />
                          </Flex>
                        )}
                        <Box minW={0} flex={1}>
                          <Text fontSize="xs" color="text" noOfLines={1} fontWeight="500">
                            {pl.name}
                          </Text>
                          <Text fontSize="10px" color="text.tertiary" noOfLines={1}>
                            {pl.tracks?.total ? `${pl.tracks.total} tracks` : "Playlist"}
                          </Text>
                        </Box>
                        <Flex
                          flexShrink={0} w="28px" h="28px" borderRadius="full"
                          bg="#1DB954" align="center" justify="center"
                          opacity={0.85} _groupHover={{ opacity: 1 }}
                          transition="opacity 0.15s"
                          onClick={(e) => {
                            e.stopPropagation();
                            playPlaylist(pl.uri);
                          }}
                        >
                          <Icon as={FiPlay} boxSize={3} color="white" ml="1px" />
                        </Flex>
                      </Flex>
                    ))}
                  </VStack>
                ) : (
                  <Text fontSize="xs" color="text.tertiary" textAlign="center" py={3}>
                    No playlists found
                  </Text>
                )}
              </Box>
            )}
          </Box>
        </>
      )}
    </Box>
  );
};

const TrackList = ({ tracks, onPlay, currentTrackId }) => (
  <VStack spacing={0} w="full">
    {tracks.map((track) => {
      const isActive = track.id === currentTrackId;
      return (
        <Flex
          key={track.id}
          w="full" py={1.5} px={2} mx={-2}
          align="center" gap={2.5}
          cursor="pointer" borderRadius="4px"
          bg={isActive ? "bg.hover" : "transparent"}
          _hover={{ bg: "bg.hover" }}
          transition="background 0.1s ease"
          onClick={() => onPlay(track.uri)}
        >
          {track.albumArt ? (
            <Image
              src={track.albumArt}
              w="36px" h="36px" borderRadius="4px"
              objectFit="cover" flexShrink={0}
            />
          ) : (
            <Flex
              w="36px" h="36px" borderRadius="4px"
              bg="bg.surface" align="center" justify="center" flexShrink={0}
            >
              <Icon as={FiMusic} boxSize={3.5} color="text.tertiary" />
            </Flex>
          )}
          <Box minW={0} flex={1}>
            <Text
              fontSize="xs" noOfLines={1} fontWeight="500"
              color={isActive ? "#1DB954" : "text"}
            >
              {track.name}
            </Text>
            <Text fontSize="10px" color="text.tertiary" noOfLines={1}>
              {track.artists}
            </Text>
          </Box>
          <Text fontSize="10px" color="text.tertiary" flexShrink={0}>
            {formatTime(track.durationMs)}
          </Text>
        </Flex>
      );
    })}
  </VStack>
);

export default SpotifyWidget;
