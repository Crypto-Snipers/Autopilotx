import React from "react";
import loginImageFromFile from '../../assets/loginImg.png';

export default function TradingIllustration() {
  return (
    <img 
      src={loginImageFromFile}
      alt="Trading illustration"
      width="300"
      height="300" 
    />
  );
}
