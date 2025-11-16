import { jsx as _jsx } from "react/jsx-runtime";
// client/src/main.tsx
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./lib/auth";
// Zorg dat de env-variabelen beschikbaar zijn in de browser
;
window.__ENV = import.meta.env;
createRoot(document.getElementById("root")).render(_jsx(BrowserRouter, { children: _jsx(AuthProvider, { children: _jsx(App, {}) }) }));
