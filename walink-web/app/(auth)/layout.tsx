import React from 'react';
import Link from 'next/link';
import { LinkIcon } from 'lucide-react'; // WaLink generic brand placeholder icon

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8 overflow-hidden">
      {/* Subtle Dot Grid Background Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none z-0" 
        style={{
          backgroundImage: `radial-gradient(var(--color-border) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
          opacity: 0.2
        }}
      />
      
      {/* Brand Header */}
      <div className="relative z-10 w-full max-w-md text-center mb-8 flex justify-center items-center gap-2">
        <div className="w-10 h-10 bg-primary/20 flex items-center justify-center rounded-xl backdrop-blur-sm border border-primary/30">
          <LinkIcon className="text-primary w-5 h-5" />
        </div>
        <Link href="/" className="text-2xl font-bold tracking-tight text-white hover:opacity-80 transition-opacity">
          Wa<span className="text-primary">Link</span>
        </Link>
      </div>

      <div className="relative w-full max-w-md z-10">
        <div className="absolute -inset-[1px] bg-gradient-to-r from-primary/30 to-accent/30 rounded-2xl blur-lg pointer-events-none opacity-40"></div>
        {children}
      </div>
    </div>
  );
}
