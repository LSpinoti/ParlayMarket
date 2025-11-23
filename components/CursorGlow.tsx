'use client';

import { useState, useEffect } from 'react';

export default function CursorGlow() {
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      className="cursor-glow-dot"
      style={{ left: cursorPos.x, top: cursorPos.y }}
    />
  );
}
