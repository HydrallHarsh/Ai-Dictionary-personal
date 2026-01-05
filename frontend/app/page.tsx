import { HeroSection } from "@/components/home/HeroSection";
import { LatestInsights } from "@/components/home/LatestInsights";
import { Newsletter } from "@/components/home/Newsletter";
import { Footer } from "@/components/Footer";

/**
 * Render the homepage layout composed of HeroSection, LatestInsights, Newsletter, and Footer.
 *
 * @returns The root JSX element containing the homepage sections.
 */
export default function Home() {
	return (
		<div className="min-h-screen bg-background text-foreground selection:bg-foreground selection:text-background">
			<HeroSection />
			<LatestInsights />
			<Newsletter />
			<Footer />
		</div>
	);
}
