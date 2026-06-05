import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "react-hot-toast";
import App from "./App";
import "./styles/globals.css";
window.addEventListener("vite:preloadError", () => {
  const key = "shopx_preload_reload";
  if (sessionStorage.getItem(key) === "1") return;
  sessionStorage.setItem(key, "1");
  window.location.reload();
});


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 20,
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnMount: "always",
      refetchOnReconnect: true,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: { background: "#333", color: "#fff" },
              success: { style: { background: "#16a34a" } },
              error: { style: { background: "#dc2626" } },
            }}
          />
        </BrowserRouter>
      </QueryClientProvider>
    </HelmetProvider>
  </React.StrictMode>
);



