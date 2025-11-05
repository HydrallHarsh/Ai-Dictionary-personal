"use client";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
export default function Home() {
  return (
    <>
      <Navbar />
      <div className="relative isolate">
        <main className="bg-gray-700 relative min-h-screen overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-r from-purple-600 via-blue-600 to-purple-800 z-0">
            <img
              src="/home_design_waves_2.svg"
              alt="wave"
              className="absolute -top-35 left-0.5 -translate-0.5 w-[45%] z-0 pointer-events-none select-none"
            />
            <div className="absolute top-0 left-0 w-full h-64 z-0"></div>

            <div className="relative z-40 container mx-auto py-10 px-4 md:px-16 lg:py-20">
              <div className="flex flex-col md:grid md:grid-cols-2 gap-8 md:gap-12 lg:gap-16 items-center md:items-center">
                <div className="space-y-6 w-full">
                  <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight">
                    AI Dictonary
                  </h1>
                  <p className="text-lg text-white opacity-90 leading-relaxed max-w-lg mb-8">
                    Your ultimate resource for everything AI. Explore
                    definitions, concepts, and the latest trends in artificial
                    intelligence all in one place.
                  </p>
                  <Button className="px-8 py-3 bg-white text-purple-600 hover:bg-gray-100 font-semibold">
                    Read more
                  </Button>
                </div>
                <div className="flex items-center justify-center">
                  <div className="rounded-3xl overflow-hidden border-3 border-white shadow-2xl bg-linear-to-br from-slate-900 to-slate-800 w-full max-w-md aspect-square flex items-center justify-center z-50">
                    <img
                      src="/ai_logo_page_1.svg"
                      alt="AI Icon"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
        <section className="bg-gray-700 py-12 md:py-16 lg:py-20">
          <div className="container mx-auto px-4 md:px-6 ">
            <div className="flex items-center justify-between mb-12 md:mb-16 gap-4">
              <h2 className="text-3xl sm:text-4xl md:text-4xl font-bold text-white text-balance">
                Our Recent Post
              </h2>
              <Button className="shrink-0 px-6 py-2 bg-purple-500 hover:bg-purple-600 text-white font-semibold">
                View All
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-16 md:mb-24">
              <img
                src="/vr.jpg"
                alt="VR Gaming AI"
                className="w-full h-64 md:h-auto object-cover rounded-lg md:rounded-2xl"
              />
              <div className="flex flex-col justify-between h-full">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">
                  Development - 10 March 2023
                </p>

                <h3 className="text-xl sm:text-2xl md:text-2xl font-bold text-white leading-tight mb-3 text-balance">
                  How to make a Game look more attractive with New VR & AI
                  Technology
                </h3>

                <p className="text-sm md:text-base text-gray-200 leading-relaxed opacity-80 mb-4">
                  Google has been investing in AI for many years and bringing
                  its benefits to individuals, businesses and communities.
                  Whether it's publishing state-of-the-art research, building
                  helpful products or developing tools and resources that make
                  AI accessible to everyone. The integration of VR and AI
                  technologies is revolutionizing the gaming industry, creating
                  immersive experiences that were once thought impossible. These
                  advancements are not only enhancing visual fidelity but also
                  enabling dynamic storytelling and adaptive gameplay mechanics
                  that respond to player behavior in real-time.
                </p>
                <Button
                  variant="outline"
                  className="w-fit border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white bg-transparent mt-8"
                >
                  Read More →
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 lg:gap-10">
              <div className="bg-slate-900 rounded-lg md:rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
                <img
                  src="/island.jpg"
                  alt="Travel"
                  className="w-full h-48 object-cover hover:scale-105 transition-transform duration-300 cursor-pointer"
                />

                <div className="p-6 flex flex-col">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                    Travel - 13 March 2023
                  </p>

                  <h3 className="text-lg font-bold text-white mb-2 leading-snug">
                    8 Rules Of Travelling In Sea You Need To Know
                  </h3>

                  <p className="text-sm text-gray-400 opacity-75 leading-relaxed mb-4 grow">
                    Traveling in sea has many advantages. Some of the advantages
                    of transporting goods by sea include.
                  </p>

                  <a
                    href="#"
                    className="text-purple-400 hover:text-purple-300 text-sm font-semibold"
                  >
                    Read More →
                  </a>
                </div>
              </div>

              <div className="bg-slate-900 rounded-lg md:rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
                <img
                  src="setup.jpg"
                  alt="Development"
                  className="w-full h-48 object-cover hover:scale-105 transition-transform duration-300 cursor-pointer"
                />

                <div className="p-6 flex flex-col">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                    Development - 11 March 2023
                  </p>

                  <h3 className="text-lg font-bold text-white mb-2 leading-snug">
                    How to build strong portfolio and get a Job in UI/UX
                  </h3>

                  <p className="text-sm text-gray-400 opacity-75 leading-relaxed mb-4 grow">
                    Building on how humans work to identify a ballpark value
                    added activity to bets test. Overcome the digital skill gap.
                  </p>

                  <a
                    href="#"
                    className="text-purple-400 hover:text-purple-300 text-sm font-semibold"
                  >
                    Read More →
                  </a>
                </div>
              </div>

              <div className="bg-slate-900 rounded-lg md:rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
                <img
                  src="/soccer.jpg"
                  alt="Sports"
                  className="w-full h-48 object-cover hover:scale-105 transition-transform duration-300 cursor-pointer"
                />

                <div className="p-6 flex flex-col">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                    Sports - 10 March 2023
                  </p>

                  <h3 className="text-lg font-bold text-white mb-2 leading-snug">
                    How to Be a Professional Footballer in 2023
                  </h3>

                  <p className="text-sm text-gray-400 opacity-75 leading-relaxed mb-4 grow">
                    Recognize the holistic world view of discipline and
                    innovation via workplace diversity and engagement.
                  </p>

                  <a
                    href="#"
                    className="text-purple-400 hover:text-purple-300 text-sm font-semibold"
                  >
                    Read More →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
