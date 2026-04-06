import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { ChakraProvider, extendTheme } from "@chakra-ui/react";
import { ColorModeScript } from "@chakra-ui/color-mode";
import { mode } from "@chakra-ui/theme-tools";
import { BrowserRouter } from "react-router-dom";

const config = {
  initialColorMode: localStorage.getItem("chakra-ui-color-mode") || "dark",
  useSystemColorMode: false,
};

const styles = {
  global: (props) => ({
    body: {
      bg: mode("#FFFFFF", "#191919")(props),
      color: mode("#37352F", "#E8E5E0")(props),
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      WebkitFontSmoothing: "antialiased",
      MozOsxFontSmoothing: "grayscale",
    },
  }),
};

const theme = extendTheme({
  config,
  styles,
  fonts: {
    heading: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  colors: {
    brand: {
      50: "#ECDFCC",
      100: "#697565",
      200: "#3C3D37",
      300: "#1E201E",
    },
    neutral: {
      50: "#F7F6F3",
      100: "#EFEDEA",
      200: "#E8E5E0",
      300: "#D3D1CB",
      400: "#B4B4B0",
      500: "#787774",
      600: "#5A5A58",
      700: "#37352F",
      800: "#202020",
      900: "#191919",
    },
  },
  semanticTokens: {
    colors: {
      background: {
        default: "#FFFFFF",
        _dark: "#191919",
      },
      "bg.surface": {
        default: "#F7F6F3",
        _dark: "#202020",
      },
      "bg.hover": {
        default: "#EFEDEA",
        _dark: "#2C2C2C",
      },
      "bg.active": {
        default: "#E8E5E0",
        _dark: "#333333",
      },
      text: {
        default: "#37352F",
        _dark: "#E8E5E0",
      },
      "text.secondary": {
        default: "#787774",
        _dark: "#9B9A97",
      },
      "text.tertiary": {
        default: "#B4B4B0",
        _dark: "#5A5A58",
      },
      border: {
        default: "#E8E5E0",
        _dark: "#333333",
      },
      primary: {
        default: "#697565",
        _dark: "#697565",
      },
      "primary.subtle": {
        default: "rgba(105, 117, 101, 0.1)",
        _dark: "rgba(105, 117, 101, 0.2)",
      },
      secondary: {
        default: "#3C3D37",
        _dark: "#3C3D37",
      },
      accent: {
        default: "#3C3D37",
        _dark: "#ECDFCC",
      },
      "bg.elevated": {
        default: "#FFFFFF",
        _dark: "#262626",
      },
    },
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: "500",
        borderRadius: "6px",
        transition: "all 0.15s ease",
      },
      variants: {
        ghost: (props) => ({
          color: mode("#37352F", "#E8E5E0")(props),
          _hover: {
            bg: mode("#EFEDEA", "#2C2C2C")(props),
          },
        }),
        outline: (props) => ({
          borderColor: mode("#E8E5E0", "#333333")(props),
          color: mode("#37352F", "#E8E5E0")(props),
          _hover: {
            bg: mode("#F7F6F3", "#202020")(props),
          },
        }),
        solid: (props) => ({
          bg: "#697565",
          color: "white",
          _hover: {
            bg: "#5a6656",
          },
        }),
      },
    },
    Input: {
      variants: {
        outline: (props) => ({
          field: {
            borderColor: mode("#E8E5E0", "#333333")(props),
            _hover: {
              borderColor: mode("#D3D1CB", "#444444")(props),
            },
            _focus: {
              borderColor: "#697565",
              boxShadow: "0 0 0 1px #697565",
            },
          },
        }),
      },
    },
    Select: {
      variants: {
        outline: (props) => ({
          field: {
            borderColor: mode("#E8E5E0", "#333333")(props),
            _hover: {
              borderColor: mode("#D3D1CB", "#444444")(props),
            },
            _focus: {
              borderColor: "#697565",
              boxShadow: "0 0 0 1px #697565",
            },
          },
        }),
      },
    },
    Textarea: {
      variants: {
        outline: (props) => ({
          borderColor: mode("#E8E5E0", "#333333")(props),
          _hover: {
            borderColor: mode("#D3D1CB", "#444444")(props),
          },
          _focus: {
            borderColor: "#697565",
            boxShadow: "0 0 0 1px #697565",
          },
        }),
      },
    },
    Card: {
      baseStyle: (props) => ({
        container: {
          bg: mode("#FFFFFF", "#202020")(props),
          borderRadius: "8px",
          border: "1px solid",
          borderColor: mode("#E8E5E0", "#333333")(props),
          boxShadow: "none",
        },
      }),
    },
    Modal: {
      baseStyle: (props) => ({
        dialog: {
          bg: mode("#FFFFFF", "#202020")(props),
          borderRadius: "12px",
          border: "1px solid",
          borderColor: mode("#E8E5E0", "#333333")(props),
          boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
        },
        overlay: {
          bg: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(4px)",
        },
      }),
    },
    Badge: {
      baseStyle: {
        borderRadius: "4px",
        fontWeight: "500",
        fontSize: "xs",
        textTransform: "none",
      },
    },
    Switch: {
      baseStyle: {
        track: {
          _checked: {
            bg: "#697565",
          },
        },
      },
    },
    Checkbox: {
      baseStyle: {
        control: {
          borderRadius: "4px",
          _checked: {
            bg: "#697565",
            borderColor: "#697565",
          },
        },
      },
    },
    Heading: {
      baseStyle: {
        fontWeight: "600",
        letterSpacing: "-0.01em",
      },
    },
    Divider: {
      baseStyle: (props) => ({
        borderColor: mode("#E8E5E0", "#333333")(props),
      }),
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <ChakraProvider theme={theme}>
        <App />
      </ChakraProvider>
    </BrowserRouter>
  </React.StrictMode>
);
