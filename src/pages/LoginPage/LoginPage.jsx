import {
  Box,
  Flex,
  VStack,
  Heading,
  Text,
  Input,
  Button,
  Divider,
  HStack,
  useToast,
  FormControl,
  FormLabel,
  useColorModeValue,
} from "@chakra-ui/react";
import { FcGoogle } from "react-icons/fc";
import { FiMail, FiLock, FiUser } from "react-icons/fi";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { migrateLocalStorageToFirestore } from "../../services/db";

const LoginPage = () => {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const cardBg = useColorModeValue("#FFFFFF", "#202020");
  const borderColor = useColorModeValue("#E8E5E0", "#333333");
  const subtleText = useColorModeValue("#787774", "#9B9A97");

  const handlePostLogin = async (user) => {
    await migrateLocalStorageToFirestore(user.uid);
    navigate("/");
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const result = await signInWithGoogle();
      await handlePostLogin(result.user);
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        toast({ title: "Sign-in failed", description: err.message, status: "error", duration: 4000 });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let result;
      if (isSignUp) {
        result = await signUpWithEmail(email, password, name);
      } else {
        result = await signInWithEmail(email, password);
      }
      await handlePostLogin(result.user);
    } catch (err) {
      const msg =
        err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential"
          ? "Invalid email or password"
          : err.code === "auth/email-already-in-use"
          ? "An account with this email already exists"
          : err.code === "auth/weak-password"
          ? "Password should be at least 6 characters"
          : err.message;
      toast({ title: isSignUp ? "Sign-up failed" : "Sign-in failed", description: msg, status: "error", duration: 4000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Flex minH="100vh" align="center" justify="center" px={4}>
      <Box
        bg={cardBg}
        border="1px solid"
        borderColor={borderColor}
        borderRadius="12px"
        p={8}
        w="100%"
        maxW="400px"
      >
        <VStack spacing={6} align="stretch">
          <VStack spacing={1}>
            <Heading size="lg" letterSpacing="-0.02em">
              Nudge
            </Heading>
            <Text color={subtleText} fontSize="sm">
              {isSignUp ? "Create your account" : "Welcome back"}
            </Text>
          </VStack>

          <Button
            onClick={handleGoogle}
            isLoading={loading}
            variant="outline"
            size="lg"
            leftIcon={<FcGoogle size={20} />}
            fontWeight="500"
          >
            Continue with Google
          </Button>

          <HStack>
            <Divider />
            <Text fontSize="xs" color={subtleText} whiteSpace="nowrap">
              or
            </Text>
            <Divider />
          </HStack>

          <form onSubmit={handleEmailSubmit}>
            <VStack spacing={4}>
              {isSignUp && (
                <FormControl>
                  <FormLabel fontSize="sm">Name</FormLabel>
                  <Input
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    size="lg"
                  />
                </FormControl>
              )}
              <FormControl isRequired>
                <FormLabel fontSize="sm">Email</FormLabel>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  size="lg"
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontSize="sm">Password</FormLabel>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  size="lg"
                />
              </FormControl>
              <Button
                type="submit"
                isLoading={loading}
                w="100%"
                size="lg"
                bg="#697565"
                color="white"
                _hover={{ bg: "#5a6656" }}
              >
                {isSignUp ? "Create Account" : "Sign In"}
              </Button>
            </VStack>
          </form>

          <Text fontSize="sm" textAlign="center" color={subtleText}>
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <Button
              variant="link"
              color="#697565"
              fontSize="sm"
              fontWeight="600"
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? "Sign in" : "Sign up"}
            </Button>
          </Text>
        </VStack>
      </Box>
    </Flex>
  );
};

export default LoginPage;
