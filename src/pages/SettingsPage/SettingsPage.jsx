import {
  Box,
  Flex,
  Text,
  VStack,
  HStack,
  Card,
  CardHeader,
  CardBody,
  useColorMode,
  Switch,
  Button,
  Select,
  Input,
  FormControl,
  FormLabel,
  Divider,
  Icon,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure,
  Avatar,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Heading,
  SimpleGrid
} from "@chakra-ui/react";
import {
  FiSettings,
  FiBell,
  FiMoon,
  FiSun,
  FiUser,
  FiMail,
  FiSmartphone,
  FiTrash2,
  FiDownload,
  FiUpload,
  FiShield,
  FiLock,
  FiMusic,
} from "react-icons/fi";
import { useState, useRef, useEffect } from "react";
import { useSpotify } from "../../context/SpotifyContext";
import { initiateSpotifyLogin } from "../../utils/spotifyAuth";
import { useAuth } from "../../context/AuthContext";
import { loadSettings as dbLoadSettings, saveSettings as dbSaveSettings } from "../../services/db";
import { requestNotificationPermission, getNotificationPermission } from "../../services/notifications";

const SettingsPage = () => {
  const { colorMode, toggleColorMode } = useColorMode();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = useRef();
  const toast = useToast();
  const { user: authUser, signOut } = useAuth();
  const { isAuthenticated: spotifyConnected, user: spotifyUser, disconnect: spotifyDisconnect } = useSpotify();
  const [notifPermission, setNotifPermission] = useState(getNotificationPermission());

  const [settings, setSettings] = useState({
    fullName: authUser?.displayName || "",
    email: authUser?.email || "",
    phone: "",
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
    reminderDays: 3,
    reminderTime: "09:00",
    currency: "USD",
    dateFormat: "MM/DD/YYYY",
    firstDayOfWeek: "Sunday",
    twoFactorAuth: false,
    biometricAuth: true,
    autoBackup: true,
    dataRetention: 365
  });

  // Load settings from Firestore
  useEffect(() => {
    if (!authUser) return;
    dbLoadSettings(authUser.uid).then((s) => {
      if (s.userName) setSettings((prev) => ({ ...prev, fullName: s.userName }));
      if (s.pushNotifications !== undefined) setSettings((prev) => ({ ...prev, pushNotifications: s.pushNotifications }));
      if (s.reminderDays !== undefined) setSettings((prev) => ({ ...prev, reminderDays: s.reminderDays }));
      if (s.reminderTime) setSettings((prev) => ({ ...prev, reminderTime: s.reminderTime }));
    });
  }, [authUser]);

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));

    if (key === "fullName" && authUser) {
      dbSaveSettings(authUser.uid, { userName: value });
    }
    if ((key === "pushNotifications" || key === "reminderDays" || key === "reminderTime") && authUser) {
      dbSaveSettings(authUser.uid, { [key]: value });
    }

    toast({
      title: "Settings Updated",
      description: "Your preferences have been saved",
      status: "success",
      duration: 2000,
      isClosable: true,
      position: "top-right"
    });
  };

  const handleExportData = () => {
    toast({
      title: "Export Started",
      description: "Your data export will be ready shortly",
      status: "info",
      duration: 3000,
      isClosable: true,
      position: "top-right"
    });
  };

  const handleDeleteAccount = () => {
    onClose();
    toast({
      title: "Account Deleted",
      description: "Your account has been permanently deleted",
      status: "error",
      duration: 3000,
      isClosable: true,
      position: "top-right"
    });
  };

  return (
    <Box
      p={{ base: 6, md: 10 }}
      minHeight="100vh"
    >
      <VStack align="start" spacing={2} mb={8}>
        <Heading size="xl" fontWeight="700" color="text" letterSpacing="-0.02em">
          Settings
        </Heading>
        <Text fontSize="md" color="text.secondary">
          Customize your Nudge experience
        </Text>
      </VStack>

      <VStack spacing={6} align="stretch">
        {/* Profile Section */}
        <Card borderRadius="8px" borderColor="border">
          <CardHeader borderBottom="1px solid" borderColor="border">
            <HStack>
              <Icon as={FiUser} color="primary" boxSize={5} />
              <Text fontSize="lg" fontWeight="600" color="text">
                Profile Information
              </Text>
            </HStack>
          </CardHeader>
          <CardBody>
            <VStack spacing={6}>
              <HStack w="full" spacing={6}>
                <Avatar size="xl" name={settings.fullName} bg="primary" color="white" />
                <VStack align="start" spacing={3}>
                  <Button
                    variant="ghost"
                    size="sm"
                    color="primary"
                    _hover={{ bg: "primary.subtle" }}
                  >
                    Change Photo
                  </Button>
                  <Text fontSize="sm" color="text.tertiary">
                    JPG, PNG or GIF. Max size 2MB.
                  </Text>
                </VStack>
              </HStack>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} w="full">
                <FormControl>
                  <FormLabel color="text.secondary" fontSize="sm" fontWeight="500">Full Name</FormLabel>
                  <Input
                    value={settings.fullName}
                    onChange={(e) => handleSettingChange('fullName', e.target.value)}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel color="text.secondary" fontSize="sm" fontWeight="500">Email</FormLabel>
                  <Input
                    type="email"
                    value={settings.email}
                    onChange={(e) => handleSettingChange('email', e.target.value)}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel color="text.secondary" fontSize="sm" fontWeight="500">Phone Number</FormLabel>
                  <Input
                    value={settings.phone}
                    onChange={(e) => handleSettingChange('phone', e.target.value)}
                  />
                </FormControl>
              </SimpleGrid>
            </VStack>
          </CardBody>
        </Card>

        {/* Preferences Section */}
        <Card borderRadius="8px" borderColor="border">
          <CardHeader borderBottom="1px solid" borderColor="border">
            <HStack>
              <Icon as={FiSettings} color="primary" boxSize={5} />
              <Text fontSize="lg" fontWeight="600" color="text">
                Preferences
              </Text>
            </HStack>
          </CardHeader>
          <CardBody>
            <VStack spacing={6}>
              <HStack justify="space-between" w="full">
                <HStack>
                  <Icon as={colorMode === "light" ? FiSun : FiMoon} color="primary" />
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="500" color="text">Theme</Text>
                    <Text fontSize="sm" color="text.secondary">
                      {colorMode === "light" ? "Light Mode" : "Dark Mode"}
                    </Text>
                  </VStack>
                </HStack>
                <Switch
                  isChecked={colorMode === "dark"}
                  onChange={toggleColorMode}
                />
              </HStack>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} w="full">
                <FormControl>
                  <FormLabel color="text.secondary" fontSize="sm" fontWeight="500">Currency</FormLabel>
                  <Select
                    value={settings.currency}
                    onChange={(e) => handleSettingChange('currency', e.target.value)}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (&euro;)</option>
                    <option value="GBP">GBP (&pound;)</option>
                    <option value="CAD">CAD ($)</option>
                    <option value="AUD">AUD ($)</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel color="text.secondary" fontSize="sm" fontWeight="500">Date Format</FormLabel>
                  <Select
                    value={settings.dateFormat}
                    onChange={(e) => handleSettingChange('dateFormat', e.target.value)}
                  >
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel color="text.secondary" fontSize="sm" fontWeight="500">First Day of Week</FormLabel>
                  <Select
                    value={settings.firstDayOfWeek}
                    onChange={(e) => handleSettingChange('firstDayOfWeek', e.target.value)}
                  >
                    <option value="Sunday">Sunday</option>
                    <option value="Monday">Monday</option>
                  </Select>
                </FormControl>
              </SimpleGrid>
            </VStack>
          </CardBody>
        </Card>

        {/* Integrations Section */}
        <Card borderRadius="8px" borderColor="border">
          <CardHeader borderBottom="1px solid" borderColor="border">
            <HStack>
              <Icon as={FiMusic} color="primary" boxSize={5} />
              <Text fontSize="lg" fontWeight="600" color="text">
                Integrations
              </Text>
            </HStack>
          </CardHeader>
          <CardBody>
            <HStack justify="space-between" w="full">
              <HStack spacing={3}>
                {spotifyConnected && spotifyUser?.images?.[0]?.url ? (
                  <Avatar size="sm" src={spotifyUser.images[0].url} name={spotifyUser.display_name} />
                ) : (
                  <Flex
                    w="32px"
                    h="32px"
                    borderRadius="full"
                    bg="#1DB954"
                    align="center"
                    justify="center"
                  >
                    <Icon as={FiMusic} boxSize={4} color="white" />
                  </Flex>
                )}
                <VStack align="start" spacing={0}>
                  <Text fontWeight="500" color="text">Spotify</Text>
                  <Text fontSize="sm" color="text.secondary">
                    {spotifyConnected
                      ? `Connected as ${spotifyUser?.display_name || "User"}`
                      : "Connect to play music in Nudge"}
                  </Text>
                </VStack>
              </HStack>
              {spotifyConnected ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    spotifyDisconnect();
                    toast({
                      title: "Spotify Disconnected",
                      status: "info",
                      duration: 2000,
                      isClosable: true,
                      position: "top-right",
                    });
                  }}
                >
                  Disconnect
                </Button>
              ) : (
                <Button
                  size="sm"
                  bg="#1DB954"
                  color="white"
                  _hover={{ bg: "#1ed760" }}
                  onClick={initiateSpotifyLogin}
                >
                  Connect
                </Button>
              )}
            </HStack>
          </CardBody>
        </Card>

        {/* Notifications Section */}
        <Card borderRadius="8px" borderColor="border">
          <CardHeader borderBottom="1px solid" borderColor="border">
            <HStack>
              <Icon as={FiBell} color="primary" boxSize={5} />
              <Text fontSize="lg" fontWeight="600" color="text">
                Notifications
              </Text>
            </HStack>
          </CardHeader>
          <CardBody>
            <VStack spacing={6}>
              <HStack justify="space-between" w="full">
                <HStack>
                  <Icon as={FiMail} color="primary" />
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="500" color="text">Email Notifications</Text>
                    <Text fontSize="sm" color="text.secondary">
                      Receive bill reminders via email
                    </Text>
                  </VStack>
                </HStack>
                <Switch
                  isChecked={settings.emailNotifications}
                  onChange={(e) => handleSettingChange('emailNotifications', e.target.checked)}
                />
              </HStack>

              <HStack justify="space-between" w="full">
                <HStack>
                  <Icon as={FiBell} color="primary" />
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="500" color="text">Push Notifications</Text>
                    <Text fontSize="sm" color="text.secondary">
                      Get notified on your device
                    </Text>
                    {notifPermission === "denied" && (
                      <Text fontSize="xs" color="red.400">Blocked in browser settings</Text>
                    )}
                    {notifPermission === "unsupported" && (
                      <Text fontSize="xs" color="orange.400">Not supported in this browser</Text>
                    )}
                  </VStack>
                </HStack>
                <Switch
                  isChecked={settings.pushNotifications}
                  onChange={async (e) => {
                    const wants = e.target.checked;
                    if (wants) {
                      const perm = await requestNotificationPermission();
                      setNotifPermission(perm);
                      if (perm === "denied") {
                        toast({ title: "Notifications Blocked", description: "Enable notifications in your device settings", status: "warning", duration: 4000, isClosable: true, position: "top-right" });
                        return;
                      }
                      if (perm === "unsupported") {
                        toast({ title: "Not Supported", description: "Notifications are not supported in this browser", status: "warning", duration: 3000, isClosable: true, position: "top-right" });
                        return;
                      }
                    }
                    handleSettingChange('pushNotifications', wants);
                  }}
                />
              </HStack>

              <HStack justify="space-between" w="full">
                <HStack>
                  <Icon as={FiSmartphone} color="primary" />
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="500" color="text">SMS Notifications</Text>
                    <Text fontSize="sm" color="text.secondary">
                      Receive text message reminders
                    </Text>
                  </VStack>
                </HStack>
                <Switch
                  isChecked={settings.smsNotifications}
                  onChange={(e) => handleSettingChange('smsNotifications', e.target.checked)}
                />
              </HStack>

              <Divider />

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} w="full">
                <FormControl>
                  <FormLabel color="text.secondary" fontSize="sm" fontWeight="500">Reminder Days Before</FormLabel>
                  <NumberInput
                    value={settings.reminderDays}
                    onChange={(value) => handleSettingChange('reminderDays', parseInt(value))}
                    min={1}
                    max={30}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper color="primary" />
                      <NumberDecrementStepper color="primary" />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>
                <FormControl>
                  <FormLabel color="text.secondary" fontSize="sm" fontWeight="500">Reminder Time</FormLabel>
                  <Input
                    type="time"
                    value={settings.reminderTime}
                    onChange={(e) => handleSettingChange('reminderTime', e.target.value)}
                  />
                </FormControl>
              </SimpleGrid>
            </VStack>
          </CardBody>
        </Card>

        {/* Security Section */}
        <Card borderRadius="8px" borderColor="border">
          <CardHeader borderBottom="1px solid" borderColor="border">
            <HStack>
              <Icon as={FiLock} color="primary" boxSize={5} />
              <Text fontSize="lg" fontWeight="600" color="text">
                Security
              </Text>
            </HStack>
          </CardHeader>
          <CardBody>
            <VStack spacing={6}>
              <HStack justify="space-between" w="full">
                <HStack>
                  <Icon as={FiShield} color="primary" />
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="500" color="text">Two-Factor Authentication</Text>
                    <Text fontSize="sm" color="text.secondary">
                      Add an extra layer of security
                    </Text>
                  </VStack>
                </HStack>
                <Switch
                  isChecked={settings.twoFactorAuth}
                  onChange={(e) => handleSettingChange('twoFactorAuth', e.target.checked)}
                />
              </HStack>

              <HStack justify="space-between" w="full">
                <HStack>
                  <Icon as={FiUser} color="primary" />
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="500" color="text">Biometric Authentication</Text>
                    <Text fontSize="sm" color="text.secondary">
                      Use fingerprint or face ID
                    </Text>
                  </VStack>
                </HStack>
                <Switch
                  isChecked={settings.biometricAuth}
                  onChange={(e) => handleSettingChange('biometricAuth', e.target.checked)}
                />
              </HStack>

              <Button
                variant="ghost"
                w="full"
                color="primary"
                _hover={{ bg: "primary.subtle" }}
                leftIcon={<FiLock />}
              >
                Change Password
              </Button>
            </VStack>
          </CardBody>
        </Card>

        {/* Data Management Section */}
        <Card borderRadius="8px" borderColor="border">
          <CardHeader borderBottom="1px solid" borderColor="border">
            <HStack>
              <Icon as={FiDownload} color="primary" boxSize={5} />
              <Text fontSize="lg" fontWeight="600" color="text">
                Data Management
              </Text>
            </HStack>
          </CardHeader>
          <CardBody>
            <VStack spacing={6}>
              <HStack justify="space-between" w="full">
                <HStack>
                  <Icon as={FiUpload} color="primary" />
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="500" color="text">Automatic Backup</Text>
                    <Text fontSize="sm" color="text.secondary">
                      Backup your data to cloud
                    </Text>
                  </VStack>
                </HStack>
                <Switch
                  isChecked={settings.autoBackup}
                  onChange={(e) => handleSettingChange('autoBackup', e.target.checked)}
                />
              </HStack>

              <FormControl>
                <FormLabel color="text.secondary" fontSize="sm" fontWeight="500">Data Retention (Days)</FormLabel>
                <NumberInput
                  value={settings.dataRetention}
                  onChange={(value) => handleSettingChange('dataRetention', parseInt(value))}
                  min={30}
                  max={3650}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper color="primary" />
                    <NumberDecrementStepper color="primary" />
                  </NumberInputStepper>
                </NumberInput>
              </FormControl>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} w="full">
                <Button
                  leftIcon={<FiDownload />}
                  variant="ghost"
                  color="primary"
                  _hover={{ bg: "primary.subtle" }}
                  onClick={handleExportData}
                >
                  Export Data
                </Button>
                <Button
                  leftIcon={<FiUpload />}
                  variant="ghost"
                  color="primary"
                  _hover={{ bg: "primary.subtle" }}
                >
                  Import Data
                </Button>
              </SimpleGrid>
            </VStack>
          </CardBody>
        </Card>

        {/* Danger Zone */}
        <Card borderRadius="8px" borderColor="red.300">
          <CardHeader borderBottom="1px solid" borderColor="red.300">
            <HStack>
              <Icon as={FiTrash2} color="red.500" boxSize={5} />
              <Text fontSize="lg" fontWeight="600" color="red.500">
                Danger Zone
              </Text>
            </HStack>
          </CardHeader>
          <CardBody>
            <VStack spacing={4}>
              <HStack justify="space-between" w="full">
                <VStack align="start" spacing={0}>
                  <Text fontWeight="500" color="red.500">Delete Account</Text>
                  <Text fontSize="sm" color="text.secondary">
                    Permanently delete your account and all data
                  </Text>
                </VStack>
                <Button
                  colorScheme="red"
                  variant="outline"
                  onClick={onOpen}
                  _hover={{ bg: "red.500", color: "white" }}
                >
                  Delete Account
                </Button>
              </HStack>
            </VStack>
          </CardBody>
        </Card>
      </VStack>

      {/* Delete Account Confirmation */}
      <AlertDialog
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={onClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent borderRadius="12px">
            <AlertDialogHeader fontSize="lg" fontWeight="600" color="text">
              Delete Account
            </AlertDialogHeader>

            <AlertDialogBody color="text.secondary">
              Are you sure? This action cannot be undone. All your bills, notes, and data will be permanently deleted.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button
                ref={cancelRef}
                onClick={onClose}
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={handleDeleteAccount}
                ml={3}
              >
                Delete Account
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default SettingsPage;
