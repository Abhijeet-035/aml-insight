"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

const navigationItems = [
  {
    label: "Overview",
    href: "/",
  },
  {
    label: "Transactions",
    href: "/transactions",
  },
  {
    label: "Predict",
    href: "/predict",
  },
  {
    label: "Network",
    href: "/network",
  },
  {
    label: "Alerts",
    href: "/alerts",
  },
  {
    label: "Investigations",
    href: "/investigations",
  },
  {
    label: "Models",
    href: "/models",
  },
];

export default function MobileMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const closeMenu = () => {
    setOpen(false);
  };

  return (
    <>
      <button
        className="mobileMenuButton"
        type="button"
        aria-label="Open navigation menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span />
        <span />
        <span />
      </button>

      {open && (
        <div
          className="mobileMenuOverlay"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      <aside
        className={`mobileMenuDrawer ${open ? "mobileMenuDrawerOpen" : ""}`}
        aria-hidden={!open}
      >
        <div className="mobileMenuHeader">
          <div className="brand">
            <div className="brandMark">A</div>

            <div>
              <strong>AML Insight</strong>
              <small>Transaction Intelligence</small>
            </div>
          </div>

          <button
            className="mobileMenuClose"
            type="button"
            aria-label="Close navigation menu"
            onClick={closeMenu}
          >
            ×
          </button>
        </div>

        <nav className="mobileMenuNav">
          {navigationItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <a
                key={item.href}
                className={isActive ? "active" : ""}
                href={item.href}
                onClick={closeMenu}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="mobileMenuBottom">
          <span>IBM AML Benchmark</span>
          <span>Model loaded</span>
        </div>
      </aside>
    </>
  );
}

