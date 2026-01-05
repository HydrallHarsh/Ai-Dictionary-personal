/**
 * Renders the About page with a full-viewport dark gradient background.
 *
 * @returns A React fragment containing a top-level div with classes `main` and `background` and an absolutely positioned, full-bleed gradient background element.
 */
export default function AboutPage() {
	return (
		<>
			<div className="main background">
				{/* <main className="bg-gray-950 relative min-h-screen overflow-hidden"> */}
				<div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-gray-950 to-gray-900 "></div>
			</div>
		</>
	);
}
