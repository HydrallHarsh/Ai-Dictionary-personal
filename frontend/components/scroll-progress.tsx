"use client";

import { motion, useScroll, useSpring } from "framer-motion";

export function ScrollProgress() {
	const { scrollYProgress } = useScroll();
	const scaleX = useSpring(scrollYProgress, {
		stiffness: 110,
		damping: 20,
		restDelta: 0.001,
	});
	return (
		<motion.div
			className="fixed top-0 left-0 right-0 h-1 bg-primary origin-left z-60"
			style={{ scaleX }}
		/>
	);
}
