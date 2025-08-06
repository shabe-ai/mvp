import React from "react";
import Image from "next/image";

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
    <div className={`${sizeClasses[size]} ${className} flex items-center justify-center`}>
      <Image 
        src="/logo.png" 
        alt="Shabe Logo" 
        width={size === "sm" ? 24 : size === "lg" ? 48 : 32} 
        height={size === "sm" ? 24 : size === "lg" ? 48 : 32}
        className="w-full h-full object-contain"
      />
    </div>
  );
} 