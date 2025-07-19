import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faComments } from "@fortawesome/free-regular-svg-icons";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function Logo({ size = "md", className = "" }: LogoProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8", 
    lg: "w-12 h-12"
  };

  return (
    <div className={`${sizeClasses[size]} ${className} bg-gradient-to-br from-amber-500 to-yellow-600 rounded-full flex items-center justify-center relative`}>
      {/* Diagonal gradient outline (45-degree angle) */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/40 via-white/25 via-white/15 via-white/8 to-transparent" />
      
      <FontAwesomeIcon 
        icon={faComments} 
        style={{color: "#ffffff", strokeWidth: "1.5"}}
        className="w-3/5 h-3/5 relative z-10"
      />
    </div>
  );
} 