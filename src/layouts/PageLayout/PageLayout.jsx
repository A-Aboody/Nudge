import { Box, Flex } from "@chakra-ui/react";
import Navbar from "../../custom_components/Navbar/Navbar";
import SpotifyMiniPlayer from "../../custom_components/SpotifyMiniPlayer/SpotifyMiniPlayer";
import { useLocation } from "react-router-dom";
import { useNavbar } from "../../context/NavbarContext";
import { useSpotify } from "../../context/SpotifyContext";

function PageLayout({ children }) {
    const { pathname } = useLocation();
    const isFullWidth = pathname === "/notes" || pathname === "/calendar";
    const { isAuthenticated, isPremium, currentTrack } = useSpotify();
    const showMiniPlayer = isAuthenticated && isPremium && currentTrack;

    return (
        <Flex minH="100vh">
            {pathname !== "/auth" ? (
                <Box flexShrink={0}>
                    <Navbar />
                </Box>
            ) : null}

            <Box
                flex={1}
                overflow={isFullWidth ? "hidden" : "auto"}
                minH="100vh"
                bg="background"
                pt="env(safe-area-inset-top)"
                pb={{
                    base: showMiniPlayer ? "116px" : "60px",
                    md: showMiniPlayer ? "64px" : 0,
                }}
            >
                <Box maxW={isFullWidth ? "100%" : "1100px"} mx="auto" h={isFullWidth ? "100%" : "auto"}>
                    {children}
                </Box>
            </Box>

            <SpotifyMiniPlayer />
        </Flex>
    );
}

export default PageLayout;
