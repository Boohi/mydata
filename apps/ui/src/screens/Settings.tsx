import React, { useState } from "react";
import { ScreenHeader } from "../components/ScreenHeader";
import { Card, IconBtn, Pill, Toggle } from "../components/primitives";
import { Icon, type IconName } from "../components/Icon";
import { useTheme } from "../lib/useTheme";

interface SettingsRowProps {
  icon?: IconName;
  label: React.ReactNode;
  sub?: React.ReactNode;
  control?: React.ReactNode;
  danger?: boolean;
}

function SettingsRow({ icon, label, sub, control, danger }: SettingsRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderBottom: "0.5px solid var(--hairline)",
      }}
    >
      {icon && (
        <span
          className={`md-tint-${danger ? "danger" : "neutral"}`}
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon name={icon} size={13} stroke={1.7} />
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 500,
            color: danger ? "var(--danger)" : "var(--ink)",
          }}
        >
          {label}
        </div>
        {sub && (
          <div
            style={{
              fontSize: 11,
              color: "var(--ink-4)",
              marginTop: 2,
              lineHeight: 1.4,
            }}
          >
            {sub}
          </div>
        )}
      </div>
      {control}
    </div>
  );
}

export function Settings() {
  const { theme, density, setTheme, setDensity } = useTheme();
  const [networkExt, setNetworkExt] = useState<boolean>(true);
  const [helperLaunch, setHelperLaunch] = useState<boolean>(true);
  const [notifyNew, setNotifyNew] = useState<boolean>(true);
  const [notifyHighRisk, setNotifyHighRisk] = useState<boolean>(true);
  const [shareCommunity, setShareCommunity] = useState<boolean>(false);

  const isDark = theme === "dark";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ScreenHeader
        kicker="myData 0.8.2 · build 142"
        title="Settings"
        subtitle="Permissions, account, and what runs in the background."
      />
      <div
        className="md-scroll"
        style={{
          flex: 1,
          overflow: "auto",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Account */}
        <Card
          eyebrow="Account"
          title="Free plan · sami@example.com"
          padded={false}
          right={
            <button
              className="md-btn"
              onClick={() => {
                /* no-op: upgrade flow not in scope */
              }}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: 600,
                background: "var(--accent)",
                color: "#fff",
              }}
            >
              Upgrade
            </button>
          }
        >
          <SettingsRow
            icon="user"
            label="Signed in as sami@example.com"
            sub="Manage subscriptions and devices in your account."
            control={<IconBtn name="chev" />}
          />
          <SettingsRow
            icon="shield"
            label="Devices using this license"
            sub="2 of 3 used · this Mac + iPhone"
            control={
              <button
                className="md-btn"
                style={{
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: "var(--accent)",
                }}
              >
                Manage
              </button>
            }
          />
          <SettingsRow
            icon="download"
            label="Export all my data"
            sub="Your traffic history, rules, and reports as JSON."
            control={
              <button
                className="md-btn"
                style={{
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: "var(--accent)",
                }}
              >
                Export
              </button>
            }
          />
        </Card>

        {/* Permissions */}
        <Card eyebrow="System permissions" title="What myData is allowed to see" padded={false}>
          <SettingsRow
            icon="flow"
            label="Network Extension"
            sub="Required. Lets myData see outbound connections from every app. Granted."
            control={<Toggle on={networkExt} onClick={() => setNetworkExt((v) => !v)} />}
          />
          <SettingsRow
            icon="bolt"
            label="Launch helper at login"
            sub="Keeps monitoring running while you're logged in."
            control={<Toggle on={helperLaunch} onClick={() => setHelperLaunch((v) => !v)} />}
          />
          <SettingsRow
            icon="user"
            label="Anonymous usage statistics"
            sub="We never see your traffic. Just crash reports + feature usage."
            control={<Toggle on={shareCommunity} onClick={() => setShareCommunity((v) => !v)} />}
          />
        </Card>

        {/* Notifications */}
        <Card eyebrow="Notifications" title="When myData taps you on the shoulder" padded={false}>
          <SettingsRow
            icon="dot"
            label="New destination seen"
            sub="The first time an app talks to a host it's never contacted before."
            control={<Toggle on={notifyNew} onClick={() => setNotifyNew((v) => !v)} />}
          />
          <SettingsRow
            icon="warn"
            label="High-risk jurisdiction"
            sub="Data leaves for CN, RU, or sanctioned countries."
            control={<Toggle on={notifyHighRisk} onClick={() => setNotifyHighRisk((v) => !v)} />}
          />
          <SettingsRow
            icon="reports"
            label="Weekly digest"
            sub="Sunday morning. Recap + big movers + suggested rules."
            control={<Toggle on={true} onClick={() => {}} />}
          />
        </Card>

        {/* Appearance — wired to useTheme */}
        <Card eyebrow="Appearance" title="Display preferences" padded={false}>
          <SettingsRow
            icon="settings"
            label="Appearance"
            sub="Light, dark, or follow system."
            control={
              <div style={{ display: "flex", gap: 4 }}>
                <Pill active={!isDark} onClick={() => setTheme("light")}>
                  Light
                </Pill>
                <Pill active={isDark} onClick={() => setTheme("dark")}>
                  Dark
                </Pill>
              </div>
            }
          />
          <SettingsRow
            icon="apps"
            label="Density"
            sub="How tight rows of data should be."
            control={
              <div style={{ display: "flex", gap: 4 }}>
                <Pill active={density === "comfy"} onClick={() => setDensity("comfy")}>
                  Comfy
                </Pill>
                <Pill active={density === "regular"} onClick={() => setDensity("regular")}>
                  Regular
                </Pill>
                <Pill active={density === "compact"} onClick={() => setDensity("compact")}>
                  Compact
                </Pill>
              </div>
            }
          />
        </Card>

        <Card eyebrow="Open source" title="myData is built in the open" padded={false}>
          <SettingsRow
            icon="logo"
            label="GitHub repository"
            sub="github.com/mydata-app/mydata · MIT licensed · ★ 14.2k"
            control={<IconBtn name="arrowRt" />}
          />
          <SettingsRow
            icon="user"
            label="Contribute community rules"
            sub="Add a rule, propose a category, help label destinations."
            control={<IconBtn name="arrowRt" />}
          />
          <SettingsRow
            icon="close"
            label="Uninstall and remove all data"
            sub="Goodbye for now. Your local DB will be erased."
            control={
              <button
                className="md-btn"
                style={{
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: "var(--danger)",
                }}
              >
                Uninstall
              </button>
            }
            danger
          />
        </Card>
      </div>
    </div>
  );
}
