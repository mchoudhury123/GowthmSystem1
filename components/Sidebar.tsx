"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { name: "Overview", href: "/overview", icon: "📊" },
  { name: "Videos", href: "/videos", icon: "🎬" },
  { name: "Queue", href: "/queue", icon: "⚡" },
  { name: "Patterns", href: "/patterns", icon: "🎯" },
  { name: "Recommendations", href: "/recommendations", icon: "💡" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-64 flex-col bg-charcoal border-r border-charcoal-lighter">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-charcoal-lighter">
        <h1 className="text-2xl font-bold text-gold tracking-tight">Growthm</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors
                ${
                  isActive
                    ? "bg-charcoal-lighter text-gold border border-gold/20"
                    : "text-foreground/70 hover:bg-charcoal-light hover:text-foreground"
                }
              `}
            >
              <span className="text-lg">{item.icon}</span>
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-charcoal-lighter px-6 py-4">
        <Link
          href="/connect"
          className="text-xs text-foreground/40 hover:text-gold transition-colors"
        >
          Switch Creator
        </Link>
      </div>
    </div>
  );
}
