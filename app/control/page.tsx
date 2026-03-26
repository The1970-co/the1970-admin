"use client";

import { useState } from "react";

import DashboardPage from "@/components/admin/DashboardPage";
import AutopilotPage from "@/components/admin/AutopilotPage";
import AIContentPage from "@/components/admin/AIContentPage";

type TabType = "dashboard" | "autopilot" | "ai";

export default function ControlPage() {
  const [tab, setTab] = useState<TabType>("dashboard");

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <div style={styles.logo}>THE 1970 — CONTROL</div>

        <div style={styles.nav}>
          <button
            style={tab === "dashboard" ? styles.activeBtn : styles.btn}
            onClick={() => setTab("dashboard")}
          >
            Dashboard
          </button>

          <button
            style={tab === "autopilot" ? styles.activeBtn : styles.btn}
            onClick={() => setTab("autopilot")}
          >
            Autopilot
          </button>

          <button
            style={tab === "ai" ? styles.activeBtn : styles.btn}
            onClick={() => setTab("ai")}
          >
            AI Content
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div style={styles.content}>
        {tab === "dashboard" && <DashboardPage />}
        {tab === "autopilot" && <AutopilotPage />}
        {tab === "ai" && <AIContentPage />}
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: "100vh",
    background: "#0b0b0b",
    color: "#fff",
    fontFamily: "Inter, sans-serif",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 30px",
    borderBottom: "1px solid #222",
  },

  logo: {
    fontSize: "18px",
    fontWeight: 600,
    letterSpacing: "1px",
  },

  nav: {
    display: "flex",
    gap: "10px",
  },

  btn: {
    padding: "8px 14px",
    background: "transparent",
    border: "1px solid #333",
    color: "#aaa",
    cursor: "pointer",
    borderRadius: "6px",
  },

  activeBtn: {
    padding: "8px 14px",
    background: "#fff",
    border: "1px solid #fff",
    color: "#000",
    cursor: "pointer",
    borderRadius: "6px",
  },

  content: {
    padding: "30px",
  },
};