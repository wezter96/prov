import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/query";
import { Toaster } from "sonner";
import "./index.css";

type Page = "inspector" | "runner";

function App() {
  const [page, setPage] = useState<Page>("inspector");

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
        <header className="border-b border-zinc-800 px-6 py-3 flex items-center gap-6">
          <h1 className="text-lg font-bold">Spana Studio</h1>
          <nav className="flex gap-1">
            <button
              onClick={() => setPage("inspector")}
              className={`px-3 py-1.5 rounded text-sm ${
                page === "inspector"
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Inspector
            </button>
            <button
              onClick={() => setPage("runner")}
              className={`px-3 py-1.5 rounded text-sm ${
                page === "runner"
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Test Runner
            </button>
          </nav>
        </header>
        <main className="flex-1 p-6">
          {page === "inspector" && <div>Inspector (coming next)</div>}
          {page === "runner" && <div>Test Runner (coming next)</div>}
        </main>
      </div>
      <Toaster theme="dark" />
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
