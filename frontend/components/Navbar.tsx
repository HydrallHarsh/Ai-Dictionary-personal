"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "./auth/AuthContext";

/**
 * Top navigation bar.
 *
 * This was the last piece of chrome still wearing the old design. It read as the
 * odd one out for four specific reasons, all now fixed:
 *
 * - It was the only place on the site using shadcn's `NavigationMenu`, whose
 *   `navigationMenuTriggerStyle()` puts a filled `bg-accent` pill behind each
 *   link on hover. Every other link on the site is bare text that changes
 *   colour, so the nav had three chunky blobs where the rest of the page has
 *   hairlines and type. The menu primitive is gone — these are three links, not
 *   a menu system with triggers and viewports.
 * - Nothing marked the current page, even though `usePathname` was already
 *   imported for the auth-page check. Every other list on this site tells you
 *   where you are.
 * - It had no colour at all, on a site that now runs a four-hue system.
 * - The `Search` link pointed at `/search`, which does not exist in `app/` and
 *   returns 404. A nav link to a missing page is a defect, so it's dropped
 *   rather than shipped broken. Restoring it is one entry in `LINKS` once the
 *   route lands.
 *
 * Colour arrives the same way it does on the widest elements elsewhere: a
 * gradient hairline along the bottom edge instead of a flat border, plus the
 * brand dot that `/about` uses on its eyebrow. Both are quotes of existing
 * devices rather than new ones, which is the point — the nav should read as the
 * top of this page, not as a component from another kit.
 */

/** Single source for both the desktop row and the mobile sheet. */
const LINKS = [
	{ href: "/blog", label: "Blog" },
	{ href: "/about", label: "About" },
] as const;

export default function Navbar() {
	const [isOpen, setIsOpen] = useState(false);
	const { user, loading, logoutAction } = useAuth();
	const pathname = usePathname();

	if (pathname === "/login" || pathname === "/signup") {
		return null;
	}

	/** `/blog` stays marked while you're inside an entry — it's still the archive. */
	const isActive = (href: string) =>
		pathname === href || pathname.startsWith(`${href}/`);

	/** Saved posts only exist for a signed-in reader, so the link appears with them. */
	const links = user ? [...LINKS, { href: "/saved", label: "Saved" }] : LINKS;

	async function handleLogout() {
		// `logoutAction` already toasts the failure before rethrowing; this only
		// consumes the rejection so it isn't an unhandled promise.
		try {
			await logoutAction();
		} catch {
			// handled upstream
		}
	}

	return (
		<nav className="animate-in fade-in slide-in-from-top-4 sticky top-0 z-50 w-full bg-background/85 backdrop-blur-md duration-700">
			{/* The gradient hairline is the border. Same device as the rule above the
			    meter and the cap on the readout column, so the nav's bottom edge is
			    made of the same material as the page's other full-width rules. */}
			<span
				className="rule-accent absolute inset-x-0 bottom-0 h-px"
				aria-hidden="true"
			/>

			<div className="relative container mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6">
				{/* Brand dot then wordmark — the same pairing `/about` opens with. */}
				<Link href="/" className="group flex items-center gap-2.5">
					<span
						className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand transition-transform duration-200 group-hover:scale-150"
						aria-hidden="true"
					/>
					<span className="text-lg font-bold tracking-tight">
						AI Dictionary
					</span>
				</Link>

				<div className="hidden items-center gap-7 md:flex">
					{links.map((link) => (
						<Link
							key={link.href}
							href={link.href}
							aria-current={isActive(link.href) ? "page" : undefined}
							className={`relative py-1 text-sm transition-colors ${
								isActive(link.href)
									? "font-medium text-foreground"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							{link.label}
							{/* The current page gets a brand underline. Weight changes with
							    it, so the mark isn't colour-only. */}
							{isActive(link.href) ? (
								<span
									className="absolute -bottom-0.5 inset-x-0 h-0.5 rounded-full bg-brand"
									aria-hidden="true"
								/>
							) : null}
						</Link>
					))}

					<ThemeToggle />

					{!loading && !user ? (
						/* Rounded-full outline, matching the hero's secondary action. The
						   old ghost variant was invisible until hovered. */
						<Button
							asChild
							variant="outline"
							size="sm"
							className="rounded-full border-border px-4"
						>
							<Link href="/login">Login</Link>
						</Button>
					) : null}
					{!loading && user ? (
						<div className="flex items-center gap-3">
							<span className="max-w-[12rem] truncate text-sm text-muted-foreground">
								{user.email}
							</span>
							<Button
								variant="outline"
								size="sm"
								className="rounded-full border-border px-4"
								onClick={handleLogout}
							>
								Logout
							</Button>
						</div>
					) : null}
				</div>

				<div className="flex items-center gap-2 md:hidden">
					<ThemeToggle />
					<button
						type="button"
						aria-label={isOpen ? "Close menu" : "Open menu"}
						aria-expanded={isOpen}
						className="rounded-md p-1.5 text-foreground transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
						onClick={() => setIsOpen(!isOpen)}
					>
						{isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
					</button>
				</div>
			</div>

			{isOpen ? (
				<div className="border-t border-border/60 bg-background md:hidden">
					<div className="container mx-auto flex max-w-[1200px] flex-col px-4 py-2 sm:px-6">
						{links.map((link) => (
							<Link
								key={link.href}
								href={link.href}
								aria-current={isActive(link.href) ? "page" : undefined}
								onClick={() => setIsOpen(false)}
								/* The active row is marked by a brand left edge here — an
								   underline would collide with the row rules. */
								className={`border-b border-border/40 py-3 text-sm transition-colors last:border-b-0 ${
									isActive(link.href)
										? "border-l-2 border-l-brand pl-3 font-medium text-foreground"
										: "text-muted-foreground hover:text-foreground"
								}`}
							>
								{link.label}
							</Link>
						))}

						<div className="pt-3 pb-1">
							{!loading && !user ? (
								<Button
									asChild
									variant="outline"
									size="sm"
									className="w-full rounded-full border-border"
									onClick={() => setIsOpen(false)}
								>
									<Link href="/login">Login</Link>
								</Button>
							) : null}
							{!loading && user ? (
								<div className="flex flex-col gap-2">
									<span className="truncate text-sm text-muted-foreground">
										{user.email}
									</span>
									<Button
										variant="outline"
										size="sm"
										className="w-full rounded-full border-border"
										onClick={handleLogout}
									>
										Logout
									</Button>
								</div>
							) : null}
						</div>
					</div>
				</div>
			) : null}
		</nav>
	);
}
