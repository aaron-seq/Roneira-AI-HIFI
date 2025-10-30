/**
 * Loading Spinner Component
 *
 * Reusable loading spinner with different sizes
 *
 * Author: Aaron Sequeira
 * Company: Roneira AI
 */

import React from "react";

interface LoadingSpinnerProps {
  size?: "small" | "medium" | "large";
  color?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "medium",
  color = "border-cyan-500",
  className = "",
}) => {
  const sizeClasses = {
    small: "h-4 w-4",
    medium: "h-8 w-8",
    large: "h-12 w-12",
  };

  return (
    <div
      className={`inline-block animate-spin rounded-full border-2 border-gray-300 border-t-transparent ${sizeClasses[size]} ${color} ${className}`}
    />
  );
};
