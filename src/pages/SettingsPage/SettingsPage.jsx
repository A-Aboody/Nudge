import {
  Box,
  Flex,
  Text,
  VStack,
  HStack,
  Switch,
  Button,
  Input,
  Icon,
  useColorMode,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure,
  Image,
} from "@chakra-ui/react";
import {
  FiMoon,
  FiSun,
  FiBell,
  FiMusic,
  FiUser,
  FiLogOut,
  FiTrash2,
  FiClock,
} from "react-icons/fi";
import { useState, useRef, useEffect } from "react";
import { useSpotify } from "../../context/SpotifyContext";
import { initiateSpotifyLogin } from "../../utils/spotifyAuth";
import { useAuth } from "../../context/AuthContext";
import {
  loadSettings as dbLoadSettings,
  saveSettings as dbSaveSettings,
} from "../../services/db";
import {
  requestNotificationPermission,
  getNotificationPermission,
} from "../../services/notifications";

// --- Section wrapper ---
const Section = ({ title, children }) => (
  <Box w="full">
    <Text
      fontSize="xs"
      fontWeight="600"
      color="text.tertiary"
      letterSpacing="0.08em"
      textTransform="uppercase"
      mb={2}
      px={1}
    >
      {title}
    </Text>
    <Box
      border="1px solid"
      borderColor="border"
      borderRadius="8px"
      bg="background"
      overflow="hidden"
    >
      {children}
    </Box>
  </Box>
);

// --- Row inside a section ---
const Row = ({ icon, label, sublabel, children, isLast }) => (
  <Flex
    align="center"
    justify="space-between"
    px={4}
    py={3.5}
    borderBottom={isLast ? "none" : "1px solid"}
    borderColor="border"
    gap={4}
  >
    <HStack spacing={3} minW={0} flex={1}>
      {icon && <Icon as={icon} boxSize="14px" color="text.tertiary" flexShrink={0} />}
      <Box minW={0}>
        <Text fontSize="sm" color="text" fontWeight="400">
          {label}
        </Text>
        {sublabel && (
          <Text fontSize="xs" color="text.tertiary" mt={0.5}>
            {sublabel}
          </Text>
        )}
      </Box>
    </HStack>
    {children}
  </Flex>
);

const SettingsPage = () => {
  const { colorMode, toggleColorMode } = useColorMode();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = useRef();
  const { user: authUser, signOut } = useAuth();
  const {
    isAuthenticated: spotifyConnected,
    user: spotifyUser,
    disconnect: spotifyDisconnect,
  } = useSpotify();

  const [notifPermission, setNotifPermission] = useState(
    getNotificationPermission()
  );
  const [displayName, setDisplayName] = useState(
    authUser?.displayName || ""
  );
  const [nameEditing, setNameEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [pushNotifications, setPushNotifications] = useState(true);
  const [reminderDays, setReminderDays] = useState(3);
  const [reminderTime, setReminderTime] = useState("09:00");

  useEffect(() => {
    if (!authUser) return;
    dbLoadSettings(authUser.uid).then((s) => {
      if (s.userName) setDisplayName(s.userName);
      if (s.pushNotifications !== undefined)
        setPushNotifications(s.pushNotifications);
      if (s.reminderDays !== undefined) setReminderDays(s.reminderDays);
      if (s.reminderTime) setReminderTime(s.reminderTime);
    });
  }, [authUser]);

  const saveName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    setDisplayName(trimmed);
    setNameEditing(false);
    if (authUser) dbSaveSettings(authUser.uid, { userName: trimmed });
  };

  const handlePushToggle = async (wants) => {
    if (wants) {
      const perm = await requestNotificationPermission();
      setNotifPermission(perm);
      if (perm === "denied" || perm === "unsupported") return;
    }
    setPushNotifications(wants);
    if (authUser) dbSaveSettings(authUser.uid, { pushNotifications: wants });
  };

  const handleReminderDays = (val) => {
    const n = Math.max(1, Math.min(30, parseInt(val) || 1));
    setReminderDays(n);
    if (authUser) dbSaveSettings(authUser.uid, { reminderDays: n });
  };

  const handleReminderTime = (val) => {
    setReminderTime(val);
    if (authUser) dbSaveSettings(authUser.uid, { reminderTime: val });
  };

  const notifSubLabel =
    notifPermission === "denied"
      ? "Blocked — enable in device settings"
      : notifPermission === "unsupported"
      ? "Not supported in this browser"
      : "Get notified for upcoming events and tasks";

  return (
    <Box px={{ base: 5, md: 10 }} py={{ base: 6, md: 8 }} minH="100vh">
      {/* Header */}
      <Box mb={10}>
        <Text
          fontSize={{ base: "lg", md: "xl" }}
          fontWeight="500"
          color="text"
          letterSpacing="-0.02em"
          mb={1}
        >
          Settings
        </Text>
        <Text fontSize="xs" color="text.tertiary" letterSpacing="0.02em">
          {authUser?.email}
        </Text>
      </Box>

      <VStack spacing={6} align="stretch" maxW="560px">
        {/* Account */}
        <Section title="Account">
          <Row
            icon={FiUser}
            label="Display name"
            sublabel={nameEditing ? undefined : displayName || "Not set"}
          >
            {nameEditing ? (
              <HStack spacing={2} flexShrink={0}>
                <Input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  size="xs"
                  w="140px"
                  borderRadius="4px"
                  fontSize="xs"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                    if (e.key === "Escape") setNameEditing(false);
                  }}
                />
                <Button
                  size="xs"
                  bg="primary"
                  color="white"
                  _hover={{ bg: "#5a6656" }}
                  borderRadius="4px"
                  onClick={saveName}
                  isDisabled={!nameDraft.trim()}
                >
                  Save
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  color="text.tertiary"
                  onClick={() => setNameEditing(false)}
                >
                  Cancel
                </Button>
              </HStack>
            ) : (
              <Button
                size="xs"
                variant="ghost"
                color="text.tertiary"
                fontSize="xs"
                fontWeight="400"
                _hover={{ color: "text" }}
                flexShrink={0}
                onClick={() => {
                  setNameDraft(displayName);
                  setNameEditing(true);
                }}
              >
                Edit
              </Button>
            )}
          </Row>
          <Row icon={FiUser} label="Email" sublabel={authUser?.email} isLast>
            <Text fontSize="xs" color="text.tertiary" flexShrink={0}>
              via Google
            </Text>
          </Row>
        </Section>

        {/* Appearance */}
        <Section title="Appearance">
          <Row
            icon={colorMode === "dark" ? FiMoon : FiSun}
            label="Dark mode"
            sublabel={colorMode === "dark" ? "On" : "Off"}
            isLast
          >
            <Switch
              size="sm"
              isChecked={colorMode === "dark"}
              onChange={toggleColorMode}
              colorScheme="green"
              flexShrink={0}
            />
          </Row>
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <Row
            icon={FiBell}
            label="Push notifications"
            sublabel={notifSubLabel}
          >
            <Switch
              size="sm"
              isChecked={pushNotifications}
              onChange={(e) => handlePushToggle(e.target.checked)}
              colorScheme="green"
              flexShrink={0}
              isDisabled={
                notifPermission === "denied" ||
                notifPermission === "unsupported"
              }
            />
          </Row>
          <Row icon={FiClock} label="Remind me" sublabel="Days before due">
            <Input
              type="number"
              value={reminderDays}
              onChange={(e) => handleReminderDays(e.target.value)}
              size="xs"
              w="56px"
              textAlign="center"
              borderRadius="4px"
              fontSize="xs"
              min={1}
              max={30}
              flexShrink={0}
            />
          </Row>
          <Row icon={FiClock} label="Reminder time" sublabel="Daily notification time" isLast>
            <Input
              type="time"
              value={reminderTime}
              onChange={(e) => handleReminderTime(e.target.value)}
              size="xs"
              w="100px"
              borderRadius="4px"
              fontSize="xs"
              flexShrink={0}
            />
          </Row>
        </Section>

        {/* Integrations */}
        <Section title="Integrations">
          <Row
            label="Spotify"
            sublabel={
              spotifyConnected
                ? `Connected as ${spotifyUser?.display_name || "User"}`
                : "Connect to play music in Nudge"
            }
            isLast
          >
            <HStack spacing={2} flexShrink={0}>
              {spotifyConnected && spotifyUser?.images?.[0]?.url && (
                <Image
                  src={spotifyUser.images[0].url}
                  w="20px"
                  h="20px"
                  borderRadius="full"
                  objectFit="cover"
                />
              )}
              {!spotifyConnected && (
                <Flex
                  w="20px"
                  h="20px"
                  borderRadius="full"
                  bg="#1DB954"
                  align="center"
                  justify="center"
                  flexShrink={0}
                >
                  <Icon as={FiMusic} boxSize="10px" color="white" />
                </Flex>
              )}
              {spotifyConnected ? (
                <Button
                  size="xs"
                  variant="ghost"
                  color="text.tertiary"
                  fontSize="xs"
                  fontWeight="400"
                  _hover={{ color: "red.400" }}
                  onClick={spotifyDisconnect}
                >
                  Disconnect
                </Button>
              ) : (
                <Button
                  size="xs"
                  bg="#1DB954"
                  color="white"
                  _hover={{ bg: "#1ed760" }}
                  borderRadius="4px"
                  fontSize="xs"
                  fontWeight="500"
                  onClick={initiateSpotifyLogin}
                >
                  Connect
                </Button>
              )}
            </HStack>
          </Row>
        </Section>

        {/* Session */}
        <Section title="Session">
          <Row icon={FiLogOut} label="Sign out" sublabel="Sign out of your account" isLast>
            <Button
              size="xs"
              variant="ghost"
              color="text.tertiary"
              fontSize="xs"
              fontWeight="400"
              _hover={{ color: "text" }}
              flexShrink={0}
              onClick={signOut}
            >
              Sign out
            </Button>
          </Row>
        </Section>

        {/* Danger */}
        <Section title="Danger zone">
          <Row
            icon={FiTrash2}
            label="Delete account"
            sublabel="Permanently delete your account and all data"
            isLast
          >
            <Button
              size="xs"
              variant="ghost"
              color="red.400"
              fontSize="xs"
              fontWeight="400"
              _hover={{ color: "red.500" }}
              flexShrink={0}
              onClick={onOpen}
            >
              Delete
            </Button>
          </Row>
        </Section>
      </VStack>

      {/* Delete confirmation */}
      <AlertDialog
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={onClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent
            borderRadius="12px"
            bg="background"
            borderColor="border"
            border="1px solid"
            mx={4}
          >
            <AlertDialogHeader fontSize="sm" fontWeight="600" color="text">
              Delete account
            </AlertDialogHeader>
            <AlertDialogBody fontSize="sm" color="text.secondary">
              This will permanently delete your account and all data. This
              cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter gap={2}>
              <Button
                ref={cancelRef}
                onClick={onClose}
                size="sm"
                variant="ghost"
                color="text.secondary"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                bg="red.500"
                color="white"
                _hover={{ bg: "red.600" }}
                borderRadius="6px"
                onClick={onClose}
              >
                Delete account
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default SettingsPage;
