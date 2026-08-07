import React from "react";
import "./Button.css";

export function Button({
  children,
  icon: Icon,
  variant = "primary",
  size = "medium",
  type = "button",
  disabled = false,
  loading = false,
  className = "",
  onClick,
  ...props
}) {
  const buttonClasses = [
    "cx-button",
    `cx-button--${variant}`,
    `cx-button--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={buttonClasses}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading ? (
        <span
          className="cx-button__spinner"
          aria-hidden="true"
        />
      ) : (
        Icon && <Icon size={17} />
      )}

      <span>
        {loading ? "Please wait..." : children}
      </span>
    </button>
  );
}