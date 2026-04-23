import { ButtonHTMLAttributes } from "react";
import { ICONS } from "@/enums";
import { Icon } from "@/components/ui/Icons";
import styles from "./IconButton.module.scss";

type IconButtonVariant = "ghost" | "solid";
type IconButtonSize = "sm" | "md" | "lg";

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ICONS;
  iconClassName?: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
};

export const IconButton = ({
  icon,
  iconClassName,
  variant = "ghost",
  size = "md",
  type = "button",
  className = "",
  disabled = false,
  children,
  ...props
}: IconButtonProps) => {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    disabled ? styles.disabled : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} disabled={disabled} {...props}>
      <Icon name={icon} className={[styles.icon, iconClassName].filter(Boolean).join(" ")} />
      {children}
    </button>
  );
};
