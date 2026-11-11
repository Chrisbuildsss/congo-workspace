import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, CloseIcon, SparkIcon } from "../Icons";
import type { AppUser } from "../types";
import { Meter, Modal, PixelAvatar } from "./Ui";

export function SettingsModal({
  open,
  onClose,
  user,
  onChangeUser,
  onOpenBilling,
  showToast,
}: {
  open: boolean;
  onClose: () => void;
  user: AppUser;
  onChangeUser: (patch: Partial<AppUser>) => void;
  onOpenBilling: () => void;
  showToast: (message: string) => void;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [username, setUsername] = useState(user.username);
  const [savedField, setSavedField] = useState<"name" | "username" | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setDisplayName(user.displayName);
    setUsername(user.username);
  }, [open, user.displayName, user.username]);

  const saveName = () => {
    const value = displayName.trim();
    if (!value || value === user.displayName) return;
    onChangeUser({ displayName: value });
    setSavedField("name");
    showToast("Display name saved");
    window.setTimeout(() => setSavedField(null), 1400);
  };

  const saveUsername = () => {
    const value = username.trim();
    if (!value || value === user.username) return;
    onChangeUser({ username: value });
    setSavedField("username");
    showToast("Username saved");
    window.setTimeout(() => setSavedField(null), 1400);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Account settings"
      width={740}
      className="settings-modal"
    >
      <div className="settings-layout">
        <div className="settings-preview-panel">
          <div className="settings-avatar-stage">
            <PixelAvatar src={user.avatarUrl} size={276} />
            <div className="settings-avatar-actions">
              <button type="button" onClick={() => showToast("Portrait editor opened — demo")}>
                Edit picture
              </button>
              <button type="button" onClick={() => fileRef.current?.click()}>
                Use image
              </button>
              <button type="button" onClick={() => onChangeUser({ avatarUrl: undefined })}>
                Use default
              </button>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              onChangeUser({ avatarUrl: URL.createObjectURL(file) });
              event.currentTarget.value = "";
            }}
          />
        </div>

        <div className="settings-fields">
          <div className="settings-field">
            <label htmlFor="display-name">Display name</label>
            <div>
              <input
                id="display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                onBlur={saveName}
              />
              {displayName !== user.displayName ? (
                <button type="button" onClick={saveName}>Save</button>
              ) : savedField === "name" ? (
                <span className="inline-saved">Saved</span>
              ) : null}
            </div>
          </div>
          <div className="settings-field">
            <label htmlFor="username">Username</label>
            <div>
              <input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                onBlur={saveUsername}
              />
              {username !== user.username ? (
                <button type="button" onClick={saveUsername}>Save</button>
              ) : savedField === "username" ? (
                <span className="inline-saved">Saved</span>
              ) : null}
            </div>
          </div>
          <div className="settings-field">
            <label htmlFor="email">Email</label>
            <div>
              <input id="email" value={user.email} disabled />
            </div>
          </div>
          <div className="privacy-setting">
            <div className="privacy-title">
              <strong>Keep designs private</strong>
              <button type="button" onClick={onOpenBilling}>Pro</button>
            </div>
            <p>Your designs will not be visible in search or on the Community page.</p>
            <button
              type="button"
              className="toggle"
              aria-label="Keep designs private"
              aria-pressed={user.isPrivate}
              disabled
            >
              <i />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function PlanCard({
  name,
  price,
  period,
  features,
  featured,
  current,
  badge,
  usage,
  onClick,
}: {
  name: string;
  price: string;
  period: string;
  features: string[];
  featured?: boolean;
  current?: boolean;
  badge?: string;
  usage?: string;
  onClick?: () => void;
}) {
  return (
    <article className={`plan-card ${featured ? "is-featured" : ""}`}>
      <header>
        <h2>{name}</h2>
        {current ? <span className="current-plan">Current plan</span> : null}
      </header>
      <div className="plan-price">
        <strong>{price}</strong>
        <span>{period}</span>
        {badge ? <em>{badge}</em> : null}
      </div>
      <ul>
        {features.map((feature) => (
          <li key={feature}>
            <span><CheckIcon size={11} /></span>
            {feature}
          </li>
        ))}
      </ul>
      {usage ? (
        <button type="button" className="plan-usage">
          {usage}
          <ChevronDownIcon size={12} />
        </button>
      ) : null}
      {onClick ? (
        <button type="button" className="plan-cta" onClick={onClick}>
          {name === "Business" ? "Contact us" : "Upgrade"}
        </button>
      ) : null}
    </article>
  );
}

export function BillingModal({
  open,
  onClose,
  showToast,
}: {
  open: boolean;
  onClose: () => void;
  showToast: (message: string) => void;
}) {
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [confirm, setConfirm] = useState(false);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upgrade to Pro"
      width={940}
      className="billing-modal"
    >
      <div className="billing-toggle">
        <button
          type="button"
          data-active={period === "month" || undefined}
          onClick={() => setPeriod("month")}
        >
          Monthly
        </button>
        <span>/</span>
        <button
          type="button"
          data-active={period === "year" || undefined}
          onClick={() => setPeriod("year")}
        >
          Yearly
        </button>
      </div>
      <div className="plans-row">
        <PlanCard
          name="Free"
          price=""
          period=""
          current
          features={[
            "300 fast designs per month (60/day)",
            "6 concurrent generations",
            "1 board",
            "Designs are public",
          ]}
        />
        <PlanCard
          name="Pro"
          price={period === "month" ? "$20" : "$16"}
          period={period === "month" ? "/mo" : "/mo, paid yearly"}
          badge={period === "year" ? "-20% Yearly" : undefined}
          featured
          features={[
            "500 quality designs per month",
            "1500 fast designs per month",
            "18 concurrent generations",
            "Unlimited boards",
            "Access control",
          ]}
          usage="500 quality, 1500 fast / mo"
          onClick={() => setConfirm(true)}
        />
        <PlanCard
          name="Business"
          price="Custom"
          period=""
          features={[
            "Dedicated support",
            "Onboarding services",
            "Org-wide access control",
            "Centralized team billing",
            "Pooled usage",
            "SAML/OIDC SSO",
          ]}
          onClick={() => showToast("Business inquiry opened — demo")}
        />
      </div>
      {confirm ? (
        <div className="billing-confirm">
          <div>
            <h2>Confirm upgrade</h2>
            <p>Your plan will update immediately. Billing is disabled in this local demo.</p>
            <div>
              <button type="button" onClick={() => setConfirm(false)}>Cancel</button>
              <button
                type="button"
                className="dialog-primary"
                onClick={() => {
                  setConfirm(false);
                  onClose();
                  showToast("Pro preview enabled for this session");
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

export function FeedbackModal({
  open,
  onClose,
  showToast,
}: {
  open: boolean;
  onClose: () => void;
  showToast: (message: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <Modal open={open} onClose={onClose} title="Give feedback" width={420}>
      <div className="simple-form">
        <p>What should we improve?</p>
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Tell us what you’re thinking…"
          autoFocus
        />
        <button
          type="button"
          className="dialog-primary"
          disabled={!value.trim()}
          onClick={() => {
            setValue("");
            onClose();
            showToast("Feedback saved locally");
          }}
        >
          Send feedback
        </button>
      </div>
    </Modal>
  );
}

export function TermsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Terms and Privacy" width={620}>
      <div className="terms-copy">
        <h2>Built for exploring ideas.</h2>
        <p>
          Variant is a design-generation workspace. This local reconstruction
          uses fictional account data and session-only demo content.
        </p>
        <h3>Your designs</h3>
        <p>
          Public designs appear in Community. Private designs are a paid-plan
          feature. Exported source remains editable in the customer’s own
          environment.
        </p>
        <h3>Usage</h3>
        <p>
          Generation limits, plan names, account actions, and billing controls
          are interface demonstrations in this build.
        </p>
      </div>
    </Modal>
  );
}
