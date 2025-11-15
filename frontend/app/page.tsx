"use client";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <>
      <Navbar />

      <div className="relative isolate">

        {/* ---------------- HERO SECTION ---------------- */}
        <main className="bg-gray-950 relative min-h-screen overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-gray-950 to-gray-900 ">

            {/* Floating wave animation */}
            <motion.img
              src="/home_design_waves_2.svg"
              alt="wave"
              className="absolute -top-35 left-0.5 w-[45%] z-0 pointer-events-none select-none"
              initial={{ opacity: 0, x: -100 }}
              animate={{ 
                opacity: 1, 
                x: 0,
                y: [0, -15, 0]
              }}
              transition={{ 
                opacity: { duration: 1.2, ease: "easeOut" },
                x: { duration: 1.3, ease: "easeOut" },
                y: { duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1.2 }
              }}
            />

            <div className="relative z-40 container mx-auto py-10 px-4 md:px-16 lg:py-20">
              <div className="flex flex-col md:grid md:grid-cols-2 gap-8 md:gap-12 lg:gap-16 items-center md:items-center pt-30">

                {/* ---- LEFT HERO ---- */}
                <motion.div
                  className="space-y-6 w-full"
                  initial={{ opacity: 0, x: -40 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                >
                  <motion.h1
                    className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
                  >
                    AI Dictionary
                  </motion.h1>

                  <motion.p
                    className="text-lg text-white opacity-90 leading-relaxed max-w-lg mb-8"
                    initial={{ opacity: 0, y: 35 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.25 }}
                  >
                    Your ultimate resource for everything AI. Explore definitions,
                    concepts, and the latest trends in artificial intelligence.
                  </motion.p>

                  <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                  >
                    <Button className="px-8 py-3 bg-white text-gray-900 hover:bg-gray-100 font-semibold">
                      Read more
                    </Button>
                  </motion.div>
                </motion.div>

                {/* ---- RIGHT HERO IMAGE ---- */}
                <motion.div
                  className="flex items-center justify-center"
                  initial={{ opacity: 0, scale: 0.9, rotate: 3 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                >
                  <motion.div
                    className="rounded-3xl overflow-hidden w-full max-w-md  flex items-center justify-center"
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <img
                      src="/undraw_ai-agent_pdkp.svg"
                      alt="AI Agent illustration"
                      className="w-full h-full object-cover"
                    />
                  </motion.div>
                </motion.div>
              </div>
            </div>
          </div>
        </main>

        {/* ---------------- POSTS SECTION ---------------- */}
        <section className="bg-gray-950 pb-12 md:pb-16 lg:pb-20">
          <div className="container mx-auto px-4 md:px-6 ">

            {/* Section Header */}
            <motion.div
              className="flex items-center justify-between mb-12 md:mb-16 gap-4"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl sm:text-4xl md:text-4xl font-bold text-white">
                Our Recent Posts
              </h2>

              <Button className="shrink-0 px-6 py-2 bg-purple-500 hover:bg-purple-600 text-white font-semibold">
                View All
              </Button>
            </motion.div>

            {/* BIG FEATURED POST */}
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-16 md:mb-24"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              viewport={{ once: true }}
            >
              <motion.img
                src="/vr.jpg"
                alt="VR Gaming AI"
                className="w-full h-64 md:h-auto object-cover rounded-lg md:rounded-2xl"
                whileHover={{ scale: 1.03 }}
                transition={{ duration: 0.3 }}
              />

              <motion.div
                className="flex flex-col justify-between h-full"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                viewport={{ once: true }}
              >
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">
                  Development - 10 March 2023
                </p>

                <h3 className="text-xl sm:text-2xl md:text-2xl font-bold text-white leading-tight mb-3">
                  How to make a Game look more attractive with New VR & AI Technology
                </h3>

                <p className="text-sm md:text-base text-gray-200 leading-relaxed opacity-80 mb-4">
                  Google has been investing in AI for many years, driving innovation across industries and redefining the boundaries of technology. In the gaming world, the integration of VR and AI is transforming how players interact with virtual environments, offering unprecedented levels of visual fidelity and immersive storytelling. Adaptive gameplay powered by AI personalizes experiences, while VR brings these worlds to life, making games more attractive and engaging than ever before. As developers continue to push the limits, the synergy between AI and VR promises a future where games are not only visually stunning but also deeply responsive to each player&apos;s unique style.
                </p>

                <Button
                  variant="outline"
                  className="w-fit border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white bg-transparent mt-8"
                >
                  Read More →
                </Button>
              </motion.div>
            </motion.div>

            {/* SMALLER CARDS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 lg:gap-10">
              {[ "/island.jpg", "/setup.jpg", "/soccer.jpg" ].map((img, idx) => (
                <motion.div
                  key={idx}
                  className="bg-slate-900 rounded-lg md:rounded-2xl overflow-hidden shadow-lg"
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: idx * 0.15 }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.03 }}
                >
                  <motion.img
                    src={img}
                    className="w-full h-48 object-cover cursor-pointer"
                    whileHover={{ scale: 1.08 }}
                    transition={{ duration: 0.3 }}
                  />

                  <div className="p-6 flex flex-col">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                      Category — Date
                    </p>

                    <h3 className="text-lg font-bold text-white mb-2 leading-snug">
                      Animated Card Title
                    </h3>

                    <p className="text-sm text-gray-400 opacity-75 leading-relaxed mb-4 grow">
                      Small description text…
                    </p>

                    <a
                      href="#"
                      className="text-purple-400 hover:text-purple-300 text-sm font-semibold"
                    >
                      Read More →
                    </a>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
