import { Manrope } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import './globals.css'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
})

export const metadata = {
  title: '404 - Hallucination Detected',
  description: 'The AI made this up.',
}

export default function GlobalNotFound() {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${manrope.variable} antialiased min-h-screen bg-background text-foreground flex flex-col items-center justify-center overflow-hidden`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <div className="w-full max-w-6xl p-4 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center justify-items-center animate-in fade-in zoom-in duration-500">
            
            <div className="relative w-[80%] aspect-square md:aspect-auto md:h-[500px] max-w-md md:max-w-full rounded-2xl overflow-hidden border-2 border-border shadow-2xl bg-muted group order-2 md:order-1">
              <div className="absolute inset-0 bg-linear-to-tr from-background/20 to-transparent z-10 pointer-events-none" />
              <img 
                src="/cat_2.png" 
                alt="AI Hallucination Meme"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 grayscale group-hover:grayscale-0"
              />
              <div className="absolute bottom-4 left-4 right-4 bg-black/80 p-3 rounded-lg text-sm font-mono text-green-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none text-left">
                <div className="flex flex-col gap-1">
                  <span>&gt; query_context: <span className="text-red-400">missing</span></span>
                  <span>&gt; logic_integrity: <span className="text-red-400">0%</span></span>
                  <span>&gt; hallucination_status: <span className="text-red-400 animate-pulse font-extrabold">CRITICAL</span></span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-6 md:space-y-8 order-1 md:order-2 z-10">
              
              <div className="flex flex-col items-center md:items-start">
                <h1 className="text-8xl md:text-9xl lg:text-[10rem] font-black tracking-tighter text-transparent bg-clip-text bg-linear-to-br from-foreground to-muted-foreground select-none leading-none">
                  404
                </h1>
                 <div className="mt-2 text-sm md:text-base font-mono bg-muted/50 px-4 py-2 rounded-full border border-border text-muted-foreground backdrop-blur-sm">
                  &gt; error: hallucination_detected
                </div>
              </div>

              <div className="space-y-4 max-w-lg">
                <h2 className="text-2xl md:text-4xl font-bold tracking-tight leading-tight">
                  &quot;Your model is hallucinating now...&quot;
                </h2>
                <p className="text-muted-foreground text-lg md:text-xl leading-relaxed">
                  We explicitly told the AI to <span className="text-foreground font-semibold italic">&quot;stick to the context info only&quot;</span>, 
                  but it decided to dream up this page anyway. 
                </p>
                <p className="text-sm text-muted-foreground/80 italic">
                  (It probably thinks this page is real. It&apos;s not. Please forgive it.)
                </p>
              </div>

              <Button asChild size="lg" className="rounded-full px-10 h-14 text-lg font-bold shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 w-full md:w-auto">
                <a href="/">
                  Return to Reality
                </a>
              </Button>
            </div>
          </div>
           <div className="fixed inset-0 -z-10 bg-[linear-gradient(to_right,#8080800a_2px,transparent_2px),linear-gradient(to_bottom,#8080800a_2px,transparent_2px)] bg-size-[14px_24px]"></div>
           <div className="fixed left-0 right-0 top-0 -z-10 m-auto h-[500px] w-[500px] rounded-full bg-primary/20 opacity-60 blur-[120px]"></div>
        </ThemeProvider>
      </body>
    </html>
  )
}