"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

import { ContactButton } from "./Contact-Button";
import { useState } from "react";

export default function Navbar() {
  const { scrollY } = useScroll();

  // Navbar shrinking
  const navHeight = useTransform(scrollY, [0, 120], ["4.5rem", "3.2rem"]);
  const navRadius = useTransform(scrollY, [0, 120], ["0px", "16px"]);
  const navWidth = useTransform(scrollY, [0, 120], ["100%", "80%"]);
  const navY = useTransform(scrollY, [0, 120], ["0px", "12px"]);
  const navShadow = useTransform(
    scrollY,
    [0, 120],
    ["0px 0px 0px rgba(0,0,0,0)", "0px 6px 20px rgba(0,0,0,0.25)"]
  );

  // TOP = gradient solid
  // SCROLLED = dark translucent
  const background = useTransform(
    scrollY,
    [0, 120],
    [
      "linear-gradient(to right, #9333EA, #2563EB, #6D28D9)", // FULL SOLID GRADIENT
      "rgba(20,20,20,0.75)"                                 // DARK glass after scroll
    ]
  );

  // Blur only after scroll
  const blur = useTransform(scrollY, [0, 120], ["blur(0px)", "blur(12px)"]);

  return (
    <motion.nav
      style={{
        height: navHeight,
        width: navWidth,
        borderRadius: navRadius,
        y: navY,
        boxShadow: navShadow,
        background,
        backdropFilter: blur,
      }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="fixed top-0 left-1/2 -translate-x-1/2 z-50 
                 flex items-center justify-between px-6"
    >
      {/* LOGO */}
      <div className="text-xl font-bold text-white">AI Dictionary</div>

      <NavigationMenu>
        <NavigationMenuList className="flex items-center gap-4">
          {["Blog", "About", "Search"].map((item) => (
            <AnimatedNavItem key={item} label={item} href="/" />
          ))}

          {/* ALWAYS READABLE BUTTON */}
          <ContactButton className="!text-white !bg-black/70 hover:!bg-black" />
        </NavigationMenuList>
      </NavigationMenu>
    </motion.nav>
  );
}

function AnimatedNavItem({ label, href }: { label: string; href: string }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ scale: 1.07 }}
      transition={{ duration: 0.2 }}
      className="relative"
    >
      <NavigationMenuItem>
        <NavigationMenuLink
          href={href}
          className={`${navigationMenuTriggerStyle()} text-black hover:text-gray-200 hover:bg-white/10 transition-colors`}
        >
          {label}
        </NavigationMenuLink>

        {/* Underline */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: hovered ? "100%" : "0%" }}
          transition={{ duration: 0.25 }}
          className="absolute left-0 -bottom-1 h-[2px] bg-white rounded-full"
        />
      </NavigationMenuItem>
    </motion.div>
  );
}
