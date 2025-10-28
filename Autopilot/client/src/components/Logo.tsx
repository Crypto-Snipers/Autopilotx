import React from "react";
import loginLogoImage from '../../src/assets/CryptoLogo.png';

export function Logo({
  className,
  width = 150,
  height = 150,
  alt = "Trading illustration",
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      src={loginLogoImage}
      alt={alt}
      width={width}
      height={height}
      className={className}
      {...props}
    />
  );
}
