"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "./auth/AuthContext";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, loading, logoutAction } = useAuth();
  const pathname = usePathname();
  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/signup");
  if (isAuthPage) {
    return null;
  }

  return (
    <nav className="sticky top-0 w-full z-50 border-b border-border/40 bg-background/80 backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 max-w-[1200px]">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center space-x-2">
            <span className="font-bold text-xl tracking-tight">
              AI Dictionary
            </span>
          </Link>
        </div>

        {/* Nav Bar for Desktop and larger screens - Regular Navigation Menu using ShadCn Component */}
        <div className="hidden md:flex items-center gap-6">
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuLink
                  asChild
                  className={navigationMenuTriggerStyle()}
                >
                  <Link href="/blog">Blog</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink
                  asChild
                  className={navigationMenuTriggerStyle()}
                >
                  <Link href="/about">About</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink
                  asChild
                  className={navigationMenuTriggerStyle()}
                >
                  <Link href="/search">Search</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
          <ThemeToggle />
          {!loading && !user && (
            <>
              <Link href="/login">
                <Button variant="ghost">Login</Button>
              </Link>
            </>
          )}
          {!loading && user && (
            <>
              <span className="text-sm">Hello, {user.email}</span>
              <Button variant="ghost" onClick={logoutAction}>
                Logout
              </Button>
            </>
          )}
        </div>

        {/* Mobile Nav bar - Logic here is - It stays hidden until md breakpoint and then collapses into a menu button which can be clicked to open the nav bar */}
        <div className="md:hidden flex items-center gap-4">
          <ThemeToggle />
          <button
            className="text-foreground"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden border-t border-border/40 bg-background">
          <div className="container py-4 flex flex-col gap-4 px-4">
            <Link
              href="/blog"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              Blog
            </Link>
            <Link
              href="/about"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              About
            </Link>
            <Link
              href="/search"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              Search
            </Link>
            {!loading && !user && (
              <>
                <Link href="/login">
                  <Button variant="ghost">Login</Button>
                </Link>
              </>
            )}
            {!loading && user && (
              <>
                <span className="text-sm">Hello, {user.email}</span>
                <Button variant="ghost" onClick={logoutAction}>
                  Logout
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
