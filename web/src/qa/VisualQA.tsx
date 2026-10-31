import { useState } from "react";
// Compiled only by build:qa; each iframe uses the actual application and API.
export default function VisualQA() {
  const [width, setWidth] = useState(1440);
  const [path, setPath] = useState("/");
  const [fixture, setFixture] = useState(false);
  const scale = width === 1440 ? 0.85 : 1;
  return (
    <div
      style={{
        padding: 16,
        fontFamily: "system-ui",
        background: "#e8ece9",
        minHeight: "100vh",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <strong>Wallet Face — responsive QA</strong>
        <label>
          CSS viewport{" "}
          <select
            aria-label="QA width"
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          >
            {[1440, 1024, 768, 375].map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
        <label>
          Page{" "}
          <select
            aria-label="QA page"
            value={path}
            onChange={(e) => setPath(e.target.value)}
          >
            <option value="/">Home</option>
            <option value="/spaces">Explore</option>
            <option value="/spaces/yam.eth">Space</option>
            <option value="/spaces/yam.eth/participants">Participants</option>
            <option value="/u/0x5ea6c7f21a2d7a29168d7c3f0bab6465f5023e97">
              Profile
            </option>
            <option value="/avatar">Avatar</option>
            <option value="/developers">Developers</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            aria-label="QA connected wallet fixture"
            checked={fixture}
            onChange={(e) => setFixture(e.target.checked)}
          />
          Wallet fixture (signing disabled)
        </label>
        <small>Real API · CSS viewport sizes</small>
      </header>
      <div style={{width:width*scale,height:900*scale}}><iframe
        title="Application viewport"
        src={path + (fixture ? "?qaWallet=fixture" : "")}
        style={{
          width,
          height: 900,
          border: 0,
          display: "block",
          background: "#fff",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      /></div>
    </div>
  );
}
