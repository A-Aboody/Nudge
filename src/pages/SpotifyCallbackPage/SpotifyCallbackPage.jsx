import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Box, Text, Flex } from "@chakra-ui/react";
import { exchangeCodeForTokens } from "../../utils/spotifyAuth";
import { useSpotify } from "../../context/SpotifyContext";

const SpotifyCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { reinitialize } = useSpotify();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      navigate("/settings", { replace: true });
      return;
    }

    if (!code) {
      navigate("/", { replace: true });
      return;
    }

    (async () => {
      try {
        await exchangeCodeForTokens(code);
        await reinitialize();
      } catch (err) {
        console.error("Spotify callback error:", err);
      }
      navigate("/", { replace: true });
    })();
  }, []);

  return (
    <Flex minH="60vh" align="center" justify="center">
      <Box textAlign="center">
        <Text color="text.secondary" fontSize="sm">
          Connecting to Spotify...
        </Text>
      </Box>
    </Flex>
  );
};

export default SpotifyCallbackPage;
