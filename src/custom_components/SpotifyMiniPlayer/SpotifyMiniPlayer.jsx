import {
  Box,
  Flex,
  Text,
  Image,
  IconButton,
  Icon,
  HStack,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
} from "@chakra-ui/react";
import {
  FiPlay,
  FiPause,
  FiSkipForward,
  FiSkipBack,
  FiVolume2,
  FiVolumeX,
  FiMusic,
} from "react-icons/fi";
import { useSpotify } from "../../context/SpotifyContext";
import { useState, useEffect } from "react";

const formatTime = (ms) => {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const SpotifyMiniPlayer = () => {
  const {
    isAuthenticated,
    isPremium,
    isReady,
    isPlaying,
    currentTrack,
    positionMs,
    durationMs,
    volume,
    togglePlay,
    skipNext,
    skipPrevious,
    seekTo,
    setVolume,
  } = useSpotify();

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Don't render if not authenticated, not premium, or nothing playing
  if (!isAuthenticated || !isPremium || !currentTrack) return null;

  const progress = durationMs > 0 ? (positionMs / durationMs) * 100 : 0;
  const displayPosition = isSeeking ? seekValue : positionMs;

  return (
    <Box
      position="fixed"
      bottom={isMobile ? "calc(52px + env(safe-area-inset-bottom))" : "0"}
      left={isMobile ? "0" : "220px"}
      right="0"
      bg="bg.elevated"
      borderTop="1px solid"
      borderColor="border"
      zIndex={9}
      h={isMobile ? "56px" : "64px"}
    >
      {/* Progress bar — thin top line */}
      <Box
        position="absolute"
        top="0"
        left="0"
        right="0"
        h="2px"
        bg="bg.hover"
        cursor="pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          seekTo(pct * durationMs);
        }}
      >
        <Box
          h="full"
          bg="#1DB954"
          w={`${progress}%`}
          transition={isSeeking ? "none" : "width 1s linear"}
        />
      </Box>

      <Flex h="full" align="center" px={isMobile ? 3 : 4} gap={isMobile ? 2 : 4}>
        {/* Album art + track info */}
        <Flex align="center" gap={2.5} minW={0} flex={isMobile ? 1 : "none"} w={isMobile ? "auto" : "250px"}>
          {currentTrack.albumArtSmall ? (
            <Image
              src={currentTrack.albumArtSmall}
              w={isMobile ? "36px" : "40px"}
              h={isMobile ? "36px" : "40px"}
              borderRadius="4px"
              objectFit="cover"
              flexShrink={0}
            />
          ) : (
            <Flex
              w={isMobile ? "36px" : "40px"}
              h={isMobile ? "36px" : "40px"}
              borderRadius="4px"
              bg="bg.surface"
              align="center"
              justify="center"
              flexShrink={0}
            >
              <Icon as={FiMusic} boxSize={4} color="text.tertiary" />
            </Flex>
          )}
          <Box minW={0}>
            <Text fontSize="xs" fontWeight="500" color="text" noOfLines={1}>
              {currentTrack.name}
            </Text>
            <Text fontSize="10px" color="text.tertiary" noOfLines={1}>
              {currentTrack.artists}
            </Text>
          </Box>
        </Flex>

        {/* Controls */}
        <HStack
          spacing={isMobile ? 0 : 1}
          justify="center"
          flex={isMobile ? "none" : 1}
        >
          {!isMobile && (
            <IconButton
              icon={<FiSkipBack size={14} />}
              variant="ghost"
              size="sm"
              color="text.secondary"
              _hover={{ color: "text" }}
              aria-label="Previous"
              onClick={skipPrevious}
              minW="32px"
            />
          )}
          <IconButton
            icon={
              isPlaying ? <FiPause size={16} /> : <FiPlay size={16} />
            }
            variant="ghost"
            size="sm"
            color="text"
            _hover={{ bg: "bg.hover" }}
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={togglePlay}
            minW="32px"
          />
          <IconButton
            icon={<FiSkipForward size={14} />}
            variant="ghost"
            size="sm"
            color="text.secondary"
            _hover={{ color: "text" }}
            aria-label="Next"
            onClick={skipNext}
            minW="32px"
          />
        </HStack>

        {/* Desktop: Seek bar + time */}
        {!isMobile && (
          <HStack flex={1} spacing={2} maxW="400px">
            <Text fontSize="10px" color="text.tertiary" w="32px" textAlign="right">
              {formatTime(displayPosition)}
            </Text>
            <Slider
              value={isSeeking ? (seekValue / durationMs) * 100 : progress}
              onChange={(val) => {
                setIsSeeking(true);
                setSeekValue((val / 100) * durationMs);
              }}
              onChangeEnd={(val) => {
                seekTo((val / 100) * durationMs);
                setIsSeeking(false);
              }}
              size="sm"
              focusThumbOnChange={false}
            >
              <SliderTrack bg="bg.hover" h="3px">
                <SliderFilledTrack bg="#1DB954" />
              </SliderTrack>
              <SliderThumb boxSize={0} />
            </Slider>
            <Text fontSize="10px" color="text.tertiary" w="32px">
              {formatTime(durationMs)}
            </Text>
          </HStack>
        )}

        {/* Desktop: Volume */}
        {!isMobile && (
          <HStack spacing={1} w="120px" flexShrink={0}>
            <IconButton
              icon={
                volume === 0 ? (
                  <FiVolumeX size={14} />
                ) : (
                  <FiVolume2 size={14} />
                )
              }
              variant="ghost"
              size="xs"
              color="text.tertiary"
              _hover={{ color: "text.secondary" }}
              aria-label="Volume"
              onClick={() => setVolume(volume === 0 ? 50 : 0)}
              minW="24px"
            />
            <Slider
              value={volume}
              onChange={(val) => setVolume(val)}
              size="sm"
              focusThumbOnChange={false}
            >
              <SliderTrack bg="bg.hover" h="3px">
                <SliderFilledTrack bg="text.tertiary" />
              </SliderTrack>
              <SliderThumb boxSize={0} />
            </Slider>
          </HStack>
        )}
      </Flex>
    </Box>
  );
};

export default SpotifyMiniPlayer;
