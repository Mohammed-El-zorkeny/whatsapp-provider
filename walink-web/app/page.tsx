import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, MessageSquare, Link as LinkIcon, Zap, FileText, Webhook, BarChart, CheckCircle2, Mail, QrCode } from "lucide-react";
import Image from "next/image";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-text-primary selection:bg-primary/30">
      
      {/* NAVBAR */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <div className="w-8 h-8 bg-primary rounded bg-gradient-to-br from-primary to-accent shadow-lg flex items-center justify-center">
              <LinkIcon className="text-white w-4 h-4" />
            </div>
            Wa<span className="text-primary">Link</span>
          </Link>
          
          <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-text-secondary">
            <Link href="#features" className="hover:text-primary transition-colors">Features</Link>
            <Link href="#pricing" className="hover:text-primary transition-colors">Pricing</Link>
            <Link href="#docs" className="hover:text-primary transition-colors">Docs</Link>
            <Link href="/blog" className="hover:text-primary transition-colors">Blog</Link>
          </div>

          <div className="flex items-center space-x-4">
            <Link href="/login">
              <Button variant="ghost" className="text-text-primary hover:text-primary hover:bg-surface-2 hidden md:flex">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button className="bg-primary hover:bg-primary-dark text-white rounded-full px-6 shadow-md shadow-primary/20">
                Start Free
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-16">
        
        {/* HERO SECTION */}
        <section className="max-w-7xl mx-auto px-6 text-center space-y-8 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] pointer-events-none -z-10" />
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-2 border border-border/80 text-xs font-semibold text-primary uppercase tracking-wide mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            V2.0 Now Live
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight max-w-4xl mx-auto leading-[1.1]">
            Send WhatsApp Messages via <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">API</span>.
          </h1>
          
          <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto">
            No Business Account needed. The most reliable WhatsApp API for developers.
            Connect in seconds without the official API complexity.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/register">
              <Button className="h-14 px-8 bg-primary hover:bg-primary-dark text-white rounded-full text-lg font-medium shadow-[0_0_30px_rgba(108,71,255,0.3)] hover:shadow-[0_0_40px_rgba(108,71,255,0.5)] transition-shadow">
                Start Free Now <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="#docs">
              <Button variant="outline" className="h-14 px-8 rounded-full text-lg font-medium border-border/80 bg-surface-2 hover:bg-surface-2/80 text-text-primary">
                View Docs
              </Button>
            </Link>
          </div>

          <div className="pt-12 flex items-center justify-center gap-4 text-sm text-text-muted font-medium">
            <div className="flex -space-x-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className={`w-8 h-8 rounded-full border-2 border-background bg-surface-2 flex items-center justify-center overflow-hidden`}>
                   {/* Placeholder user faces mapped conceptually */}
                   <Image src={`/mock_avatar_${i}.jpg`} alt="User avatar" width={32} height={32} unoptimized />
                </div>
              ))}
            </div>
            Trusted by <strong className="text-text-primary">1,200+</strong> developers worldwide
          </div>

          {/* Hero Mock Code Block */}
          <div className="mt-16 relative max-w-4xl mx-auto rounded-xl border border-border/50 bg-[#0A0A0F] shadow-2xl text-left overflow-hidden">
             <div className="flex items-center px-4 py-3 border-b border-border/30 bg-[#11111A]">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 rounded-full bg-danger/80" />
                  <div className="w-3 h-3 rounded-full bg-warning/80" />
                  <div className="w-3 h-3 rounded-full bg-success/80" />
                </div>
                <div className="mx-auto text-xs text-text-muted font-mono">POST /api/messages/send</div>
             </div>
             <div className="p-6 overflow-x-auto text-sm font-mono text-primary-light/80 leading-relaxed">
               <span className="text-accent">{`{`}</span><br />
               &nbsp;&nbsp;<span className="text-primary-dark font-semibold">"to"</span>: <span className="text-success">"201012345678"</span>,<br />
               &nbsp;&nbsp;<span className="text-primary-dark font-semibold">"type"</span>: <span className="text-success">"text"</span>,<br />
               &nbsp;&nbsp;<span className="text-primary-dark font-semibold">"message"</span>: <span className="text-success">"Hello from WaLink!"</span>,<br />
               &nbsp;&nbsp;<span className="text-primary-dark font-semibold">"options"</span>: [<br />
               &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-success">"priority": "high"</span>,<br />
               &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-success">"track": true</span><br />
               &nbsp;&nbsp;]<br />
               <span className="text-accent">{`}`}</span>
             </div>
             <div className="absolute right-4 bottom-4 flex gap-3">
               <div className="bg-success/20 text-success border border-success/30 px-3 py-1 text-xs rounded-md flex items-center gap-2">
                 <CheckCircle2 className="w-3 h-3" /> 200 OK
               </div>
               {/* Decorative WAHA Mock Status Float */}
               <div className="absolute -right-12 -top-24 bg-surface-1/90 backdrop-blur border border-border rounded-xl p-3 shadow-2xl rotate-3">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2 text-center font-bold">WaLink Server</div>
                  <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg flex items-center justify-center border border-primary/20 relative mx-auto">
                    <QrCode className="w-8 h-8 text-primary" />
                    <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-success rounded-full border-2 border-surface-1" />
                  </div>
                  <div className="text-[9px] text-center mt-2 leading-tight">Scan to link your phone in seconds</div>
               </div>
             </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="max-w-7xl mx-auto px-6 py-32 text-center relative">
          <h2 className="text-3xl font-bold tracking-tight mb-4">How It Works</h2>
          <p className="text-text-secondary max-w-2xl mx-auto mb-16">Setup your automated messaging in three simple steps.</p>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-surface-1 border border-border/50 rounded-2xl p-8 text-left hover:border-primary/50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">1. Connect QR</h3>
              <p className="text-text-muted text-sm leading-relaxed">
                Scan the dynamically generated QR code using your WhatsApp mobile app to create a secure session.
              </p>
            </div>
            <div className="bg-surface-1 border border-border/50 rounded-2xl p-8 text-left hover:border-primary/50 transition-colors relative">
               {/* Arrow Connector Line abstract */}
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6">
                <LinkIcon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">2. Get API Key</h3>
              <p className="text-text-muted text-sm leading-relaxed">
                Instantly generate unique authentication keys to secure your API requests and manage permissions.
              </p>
            </div>
            <div className="bg-surface-1 border border-border/50 rounded-2xl p-8 text-left hover:border-primary/50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">3. Send Messages</h3>
              <p className="text-text-muted text-sm leading-relaxed">
                Start pushing notifications, files, and updates via our high-speed, scalable REST API endpoints.
              </p>
            </div>
          </div>
        </section>

        {/* FEATURES GRID */}
        <section id="features" className="max-w-7xl mx-auto px-6 py-16">
          <div className="mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Powerful Features</h2>
            <p className="text-text-secondary max-w-2xl">Everything you need to build powerful WhatsApp automations without the overhead.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
               { i: <MessageSquare/>, t: 'Multi-session', d: 'Run dozens of WhatsApp numbers simultaneously from a single dashboard.' },
               { i: <FileText/>, t: 'File Support', d: 'Send PDF, JPG, MP4, and Audio files effortlessly with our media API.' },
               { i: <Webhook/>, t: 'Webhooks', d: 'Get instant POST notifications for incoming messages and delivery status.' },
               { i: <LinkIcon/>, t: 'Group Management', d: 'Programmatically create groups, add members, and manage roles.' },
               { i: <MessageSquare/>, t: 'Auto-Reply', d: 'Build interactive menu systems and automated support bots in minutes.' },
               { i: <BarChart/>, t: 'Analytics', d: 'Deep insights into message throughput, success rates, and engagement.' }
            ].map((f, idx) => (
              <div key={idx} className="p-6 rounded-2xl bg-surface-2/40 border border-border/40 hover:bg-surface-2 transition-colors">
                <div className="text-primary mb-4 w-8 h-8">{f.i}</div>
                <h4 className="font-bold text-lg mb-2">{f.t}</h4>
                <p className="text-sm text-text-muted">{f.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="max-w-7xl mx-auto px-6 py-32 text-center relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/5 rounded-[100%] blur-[120px] pointer-events-none -z-10" />

          <h2 className="text-3xl font-bold tracking-tight mb-4">Simple Pricing</h2>
          <p className="text-text-secondary mb-16">Start for free, scale as your application grows.</p>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter Plan */}
            <div className="bg-surface-1 border border-border rounded-2xl p-8 text-left flex flex-col relative">
              <h3 className="text-xl font-bold mb-2">Starter</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-extrabold">$0</span>
                <span className="text-text-muted text-sm">/mo</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1 text-sm text-text-secondary">
                <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-primary" /> 1 Session</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-primary" /> 100 Messages / day</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-primary" /> Basic Support</li>
              </ul>
              <Button variant="outline" className="w-full bg-surface-2 border-border hover:bg-surface-2/80">Get Started</Button>
            </div>

            {/* Pro Plan */}
            <div className="bg-surface-1 border border-primary rounded-2xl p-8 text-left flex flex-col relative shadow-[0_0_30px_rgba(108,71,255,0.15)] transform md:-translate-y-4">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-white text-[10px] uppercase font-bold tracking-wider py-1 px-3 rounded-full">
                Most Popular
              </div>
              <h3 className="text-xl font-bold mb-2">Professional</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-extrabold">$49</span>
                <span className="text-text-muted text-sm">/mo</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1 text-sm text-text-secondary">
                <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-primary" /> 5 Sessions</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-primary" /> Unlimited Messages</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-primary" /> Priority Support</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-primary" /> Media Support</li>
              </ul>
              <Button className="w-full bg-primary hover:bg-primary-dark">Choose Plan</Button>
            </div>

            {/* Business Plan */}
            <div className="bg-surface-1 border border-border rounded-2xl p-8 text-left flex flex-col relative">
              <h3 className="text-xl font-bold mb-2">Enterprise</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-extrabold">$199</span>
                <span className="text-text-muted text-sm">/mo</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1 text-sm text-text-secondary">
                <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-primary" /> Unlimited Sessions</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-primary" /> Dedicated Hosting</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-primary" /> 24/7 Phone Support</li>
              </ul>
              <Button variant="outline" className="w-full bg-surface-2 border-border hover:bg-surface-2/80">Contact Sales</Button>
            </div>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-border/40 bg-[#0A0A0F] py-16">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
              <div className="w-6 h-6 bg-primary rounded bg-gradient-to-br from-primary to-accent shadow-lg flex items-center justify-center">
                <LinkIcon className="text-white w-3 h-3" />
              </div>
              Wa<span className="text-primary">Link</span>
            </Link>
            <p className="text-sm text-text-muted max-w-xs">
              Leading the way in WhatsApp automation and API solutions for developers since 2021.
            </p>
            <div className="flex gap-4 text-text-muted pt-2">
              <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center cursor-pointer hover:bg-surface-1 transition-colors"><Webhook className="w-4 h-4"/></div>
              <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center cursor-pointer hover:bg-surface-1 transition-colors"><Mail className="w-4 h-4"/></div>
              <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center cursor-pointer hover:bg-surface-1 transition-colors"><MessageSquare className="w-4 h-4"/></div>
            </div>
          </div>
          <div>
            <h4 className="font-bold text-sm mb-4">Product</h4>
            <ul className="space-y-3 text-sm text-text-muted">
              <li><Link href="#" className="hover:text-primary transition-colors">Features</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Pricing</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Integrations</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">API Ref</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-sm mb-4">Company</h4>
            <ul className="space-y-3 text-sm text-text-muted">
              <li><Link href="#" className="hover:text-primary transition-colors">About Us</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Careers</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Press</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-sm mb-4">Resources</h4>
            <ul className="space-y-3 text-sm text-text-muted">
              <li><Link href="#" className="hover:text-primary transition-colors">Documentation</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Blog</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Community</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Templates</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-sm mb-4">Legal</h4>
            <ul className="space-y-3 text-sm text-text-muted">
              <li><Link href="#" className="hover:text-primary transition-colors">Privacy</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Terms</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Cookie Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-16 pt-8 border-t border-border/40 flex flex-col md:flex-row items-center justify-between text-xs text-text-muted">
          <p>© 2024 WaLink Technologies Inc. All rights reserved.</p>
          <div className="flex items-center gap-2 mt-4 md:mt-0">
            <span>System Status</span>
            <span className="flex items-center text-success"><span className="w-2 h-2 rounded-full bg-success mr-2 animate-pulse"></span> All Systems Operational</span>
          </div>
        </div>
      </footer>
    </div>
  );
}


