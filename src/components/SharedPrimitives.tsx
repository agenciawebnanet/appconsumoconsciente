import type { ReactNode } from "react";
import { AppIcon } from "@/src/components/AppIcon";
import { Button } from "@/src/components/ui/button";
import {
  calcKwh,
  displayTitle,
  effectiveTariff,
  formatBrl,
  formatDuration,
  formatNumber,
  inferIconName,
  modelDetail,
} from "@/src/lib/energy";
import type { Equipment, Project } from "@/src/types/energy";

export function PrimaryButton({
  children,
  onClick,
  ghost = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  ghost?: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      className={`btn block ${ghost ? "ghost" : "primary"}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
  onAction,
  hero = false,
  note,
}: {
  icon: string;
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
  hero?: boolean;
  note?: string;
}) {
  return (
    <div className={`card center ${hero ? "hero" : ""}`}>
      <div className="empty">
        <div className="circle">
          <AppIcon name={icon} />
        </div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      {action && <PrimaryButton onClick={onAction}>{action}</PrimaryButton>}
      {note && <p className="tiny muted mt-3">{note}</p>}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="small muted">{label}</span>
      {children}
    </label>
  );
}

export function SectionTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="section-title">
      <span>{title}</span>
      {action && (
        <Button variant="ghost" className="link-btn" onClick={onAction}>
          {action}
        </Button>
      )}
    </div>
  );
}

export function EquipmentRow({
  eq,
  project,
  onClick,
}: {
  eq: Equipment;
  project: Project;
  onClick: () => void;
}) {
  const detail = modelDetail(eq.name);
  return (
    <Button variant="ghost" className="item grow-button equipment-row" onClick={onClick}>
      <div className="avatar g">
        <AppIcon name={inferIconName(eq.name)} />
      </div>
      <div className="grow">
        <div className="item-title">{displayTitle(eq.name)}</div>
        {detail && <div className="model-detail">{detail}</div>}
        <div className="item-sub">
          {project.environments.find((env) => env.id === eq.envId)?.name} • {eq.qty}x •{" "}
          {formatDuration(eq.hours * 60)}/dia
        </div>
      </div>
      <div className="item-end">
        {formatNumber(calcKwh(eq))} kWh
        <br />
        <span className="green">{formatBrl(calcKwh(eq) * effectiveTariff(project))}</span>
      </div>
    </Button>
  );
}

export function SettingsActionRow({
  icon,
  title,
  text,
  onClick,
}: {
  icon: string;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <Button variant="ghost" className="item grow-button" onClick={onClick}>
      <div className="avatar">
        <AppIcon name={icon} />
      </div>
      <div className="grow">
        <div className="item-title">{title}</div>
        <div className="item-sub">{text}</div>
      </div>
      <span className="chev">›</span>
    </Button>
  );
}
