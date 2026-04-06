import {
  Box,
  Flex,
  Icon,
  Link,
  VStack,
  Text,
  Button
} from "@chakra-ui/react";
import {
  FiHome,
  FiSettings,
  FiCalendar,
  FiEdit3,
  FiPlus,
  FiCheckSquare
} from "react-icons/fi";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { loadTodos as dbLoadTodos } from "../../services/db";

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    dbLoadTodos(user.uid).then((todos) => {
      setPendingCount(todos.filter((t) => !t.completed).length);
    });
  }, [user, location]);

  const navItems = [
    { icon: FiHome, label: "Home", path: "/" },
    { icon: FiCalendar, label: "Calendar", path: "/calendar" },
    { icon: FiEdit3, label: "Notes", path: "/notes" },
    { icon: FiCheckSquare, label: "To-Do", path: "/todo" },
    { icon: FiSettings, label: "Settings", path: "/settings" },
  ];

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isLinkActive = (path) => {
    if (path === "/") {
      return location.pathname === path;
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  if (isMobile) {
    return (
      <>
        <Box
          position="fixed"
          bottom={0}
          left={0}
          right={0}
          bg="background"
          zIndex={10}
          borderTop="1px solid"
          borderColor="border"
          pb="env(safe-area-inset-bottom)"
        >
          <Flex
            justifyContent="space-around"
            alignItems="center"
            h="52px"
            px={4}
          >
            {navItems.map((item) => {
              const active = isLinkActive(item.path);
              return (
                <Box
                  key={item.label}
                  as={RouterLink}
                  to={item.path}
                  display="flex"
                  flexDirection="column"
                  alignItems="center"
                  justifyContent="center"
                  flex={1}
                  py={1.5}
                  textDecoration="none"
                >
                  <Icon
                    as={item.icon}
                    boxSize={4}
                    color={active ? "text" : "text.tertiary"}
                    mb={0.5}
                  />
                  <Text
                    fontSize="10px"
                    color={active ? "text" : "text.tertiary"}
                    fontWeight={active ? "500" : "400"}
                    letterSpacing="0.02em"
                  >
                    {item.label}
                  </Text>
                </Box>
              );
            })}
          </Flex>
        </Box>
        {/* Spacer so page content isn't hidden behind the navbar */}
        <Box h="52px" w="full" flexShrink={0} />
      </>
    );
  }

  return (
    <>
      <Box
        height="100vh"
        borderRight="1px solid"
        borderColor="border"
        py={4}
        position="sticky"
        top={0}
        left={0}
        px={3}
        width="220px"
        bg="bg.surface"
      >
        <Flex direction="column" gap={6} w="full" height="full">
          {/* Brand */}
          <Flex alignItems="center" gap={2} px={2.5}>
            <Text fontSize="sm" fontWeight="600" color="text" letterSpacing="-0.01em">
              Nudge
            </Text>
            {pendingCount > 0 && (
              <Flex
                align="center"
                justify="center"
                bg="primary"
                color="white"
                fontSize="10px"
                fontWeight="600"
                borderRadius="full"
                minW="18px"
                h="18px"
                px={1}
              >
                {pendingCount}
              </Flex>
            )}
          </Flex>

          {/* Navigation Items */}
          <VStack spacing={1} align="stretch">
            {navItems.map((item) => (
              <Link
                key={item.path}
                as={RouterLink}
                to={item.path}
                display="flex"
                alignItems="center"
                px={2.5}
                py={1.5}
                borderRadius="6px"
                bg={isLinkActive(item.path) ? 'primary.subtle' : 'transparent'}
                color={isLinkActive(item.path) ? 'primary' : 'text.secondary'}
                _hover={{
                  bg: isLinkActive(item.path) ? 'primary.subtle' : 'bg.hover',
                }}
                transition="all 0.12s ease"
                textDecoration="none"
              >
                <Icon
                  as={item.icon}
                  boxSize={4}
                  color={isLinkActive(item.path) ? 'primary' : 'text.secondary'}
                />
                <Box
                  ml={2.5}
                  fontSize="sm"
                  fontWeight={isLinkActive(item.path) ? "500" : "400"}
                >
                  {item.label}
                </Box>
              </Link>
            ))}
          </VStack>

          {/* New Event Button */}
          <Button
            onClick={() => navigate("/calendar?new=1")}
            display="flex"
            alignItems="center"
            px={2.5}
            py={1.5}
            borderRadius="6px"
            variant="ghost"
            color="text.secondary"
            justifyContent="start"
            fontWeight="400"
            fontSize="sm"
            _hover={{ bg: "bg.hover" }}
            transition="all 0.12s ease"
            leftIcon={<Icon as={FiPlus} boxSize={4} color="text.tertiary" />}
          >
            New Event
          </Button>

          <Box flex="1" />
        </Flex>
      </Box>
    </>
  );
};

export default Navbar;
