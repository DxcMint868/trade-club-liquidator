'use client';

import { useState, useEffect, useRef } from 'react';
import { Navigation } from '@/components/navigation';

// Define a type for the section refs
type SectionRefs = {
  [key: string]: React.RefObject<HTMLDivElement>;
};

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('introduction');
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Create refs for each section
  const sectionRefs: SectionRefs = {
    introduction: useRef<HTMLDivElement>(null),
    inspiration: useRef<HTMLDivElement>(null),
    coreConcepts: useRef<HTMLDivElement>(null),
    architecture: useRef<HTMLDivElement>(null),
    delegation: useRef<HTMLDivElement>(null),
    theArena: useRef<HTMLDivElement>(null),
    tokenomics: useRef<HTMLDivElement>(null),
    governance: useRef<HTMLDivElement>(null),
    roadmap: useRef<HTMLDivElement>(null),
  };

  const navItems = [
    { id: 'introduction', title: 'Introduction' },
    { id: 'inspiration', title: 'Inspiration & Motivation' },
    { id: 'coreConcepts', title: 'Core Concepts' },
    { id: 'architecture', title: 'Architecture' },
    { id: 'delegation', title: 'Smart Account Delegation' },
    { id: 'theArena', title: 'The Arena: Matches' },
    { id: 'tokenomics', title: '$TCLUB Tokenomics' },
    { id: 'governance', title: 'Governance & Bribe Wars' },
    { id: 'roadmap', title: 'Roadmap' },
  ];

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY; // No offset for precise switching
      let current = 'introduction';
      Object.entries(sectionRefs).forEach(([id, ref]) => {
        if (ref.current) {
          const offsetTop = ref.current.offsetTop;
          if (offsetTop <= scrollPosition) {
            current = id;
          }
        }
      });
      setActiveSection(current);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Set initial active section

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollToSection = (id: string) => {
    sectionRefs[id].current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const Section: React.FC<{ title: string; id: string; children: React.ReactNode; refProp: React.RefObject<HTMLDivElement> }> = ({ title, id, children, refProp }) => (
    <div id={id} ref={refProp} className="mb-16 scroll-mt-24">
      <h2 className="text-3xl md:text-4xl font-bold text-purple-300 mb-6 pb-2 border-b-2 border-purple-500/20">{title}</h2>
      <div className="prose prose-invert prose-lg max-w-none prose-p:text-white/80 prose-headings:text-purple-200 prose-strong:!text-purple-300 prose-a:text-blue-400 hover:prose-a:text-blue-300">
        {children}
      </div>
    </div>
  );

  return (
    <main className="relative min-h-screen">
      <div className="absolute inset-0 bg-gradient-to-b from-[#080413] via-[#060310] via-30% to-[#04020d] to-black" />
      
      <div className="relative z-10">
        <Navigation color="#a855f7" />
        
        <div className="relative z-20 pt-32 px-4 sm:px-6 lg:px-8 pb-20">
          <div className="max-w-6xl mx-auto">
            <header className="text-center mb-20">
              <h1 className="text-5xl md:text-7xl font-bold text-purple-200 mb-4">TradeClub Whitepaper</h1>
              <p className="text-xl md:text-2xl text-purple-300/80 italic">The Future of Competitive Social Trading</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
              {/* Sticky Sidebar Navigation */}
              <aside className="lg:col-span-1 lg:sticky lg:top-24 h-max">
                <nav className="space-y-2">
                  {navItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => scrollToSection(item.id)}
                      className={`block w-full text-left px-4 py-2 rounded-md transition-all duration-200 text-sm font-medium ${
                        activeSection === item.id
                          ? 'bg-purple-500/20 text-purple-200 border-l-4 border-purple-400'
                          : 'text-white/60 hover:bg-purple-500/10 hover:text-white'
                      }`}>
                      {item.title}
                    </button>
                  ))}
                </nav>
              </aside>

              {/* Main Content */}
              <div ref={contentRef} className="lg:col-span-3">
                <Section title="1. Introduction" id="introduction" refProp={sectionRefs.introduction}>
                  <p>TradeClub is a revolutionary esports-style competitive social trading platform built on the Monad blockchain. It transforms DeFi trading from a passive, isolated activity into an engaging, competitive spectacle. By leveraging MetaMask Smart Accounts, TradeClub introduces a secure, non-custodial delegation system, allowing users to copy-trade the platform's most skilled traders—the Monachads—without ever giving up control of their assets.</p>
                  <p>The platform addresses key pain points for both expert and novice traders. Skilled traders gain a new avenue to monetize their expertise and build a verifiable on-chain reputation. Meanwhile, supporters can access top-tier strategies passively, participate in exciting, time-bound trading matches, and learn from the best in a transparent environment.</p>
                </Section>

                <Section title="2. Inspiration & Motivation" id="inspiration" refProp={sectionRefs.inspiration}>
                  <p>The concept of TradeClub is heavily inspired by the explosive growth of competitive esports and the vibrant, high-stakes trading culture emerging from regions like South Korea. In these communities, trading is not just about profit; it's a performance, a sport, and a source of entertainment. Traders build massive followings, and their strategies are analyzed and celebrated like those of professional athletes.</p>
                  <img src="/korea-esport.avif" alt="Korean Esports Arena" className="rounded-lg shadow-2xl my-6" />
                  <p>TradeClub aims to capture this energy and bring it to the global DeFi stage. We believe that the future of trading is social, competitive, and entertaining. Furthermore, we embrace the rich meme culture that fuels the crypto space. The Monachads are not just avatars; they represent the spirit of the degen, the strategist, and the community member, all clashing in the glorious arena of the free market.</p>
                </Section>

                <Section title="2. Core Concepts" id="coreConcepts" refProp={sectionRefs.coreConcepts}>
                  <p>TradeClub revolves around three key user personas and the unique environment they interact in:</p>
                  <ul>
                    <li><strong>The Monachad (Competitive Trader):</strong> An experienced DeFi trader who competes in matches to prove their skill, earn performance fees, and build a following. They are the star athletes of the TradeClub arena.</li>
                    <li><strong>The Supporter (Delegator):</strong> A user who wants to gain exposure to trading without the time commitment. They use their Smart Account to delegate trading authority to a Monachad, automatically copying their trades in a secure, non-custodial manner.</li>
                    <li><strong>The Spectator:</strong> Any community member who watches matches, learns strategies, and engages with the community. They are the fans who bring the arena to life.</li>
                  </ul>
                  <img src="/monachad1.png" alt="Monachad" className="rounded-lg shadow-2xl my-6 w-1/2 mx-auto" 
                    style={{
                      filter: 'drop-shadow(0 0 40px rgba(168, 85, 247, 0.3))',
                      animation: 'float 6s ease-in-out infinite'
                    }}
                  />
                  <p>The entire ecosystem is designed to be a fusion of competitive gaming and high-finance, creating a new category of DeFi entertainment.</p>
                </Section>

                <Section title="3. Architecture" id="architecture" refProp={sectionRefs.architecture}>
                  <p>TradeClub is built on a robust 4-layer architecture to ensure real-time performance, security, and decentralization:</p>
                  <ol>
                    <li><strong>Frontend Layer (Next.js):</strong> A highly interactive user interface built with Next.js, integrating directly with the MetaMask Delegation Toolkit for seamless smart account management and delegation signing.</li>
                    <li><strong>Backend Layer (NestJS):</strong> A powerful backend that manages match logic, aggregates data, and provides real-time updates via WebSockets. It orchestrates the copy-trading engine and serves data to the frontend.</li>
                    <li><strong>Indexing Layer (Envio):</strong> A high-performance indexing solution that listens to on-chain events from smart contracts in real-time. It captures trades, delegation changes, and match status updates, feeding them to the backend instantly.</li>
                    <li><strong>Blockchain Layer (Monad):</strong> The foundation of the platform, consisting of smart contracts deployed on the high-throughput Monad blockchain. This layer handles all value-bearing operations, including match escrows, delegation enforcement, and prize distribution.</li>
                  </ol>
                </Section>

                <Section title="4. Smart Account Delegation" id="delegation" refProp={sectionRefs.delegation}>
                  <p>The cornerstone of TradeClub's innovation is its use of MetaMask Smart Accounts for non-custodial copy trading. This system allows Supporters to delegate trading permissions with unparalleled security and control.</p>
                  <p>The flow is as follows:</p>
                  <ul>
                    <li>A Supporter chooses a Monachad to follow in a specific match.</li>
                    <li>Using the TradeClub UI, the Supporter signs a delegation message (EIP-712) that grants the Monachad specific permissions.</li>
                    <li>These permissions are governed by on-chain 'caveats' or enforcers, which set strict rules such as:</li>
                    <ul>
                        <li><strong>Spending Limits:</strong> The maximum value that can be traded.</li>
                        <li><strong>Allowed Contracts:</strong> A whitelist of DEXs or tokens that can be interacted with.</li>
                        <li><strong>Time-Locks:</strong> The delegation is only valid for the duration of the match.</li>
                    </ul>
                    <li>When the Monachad executes a trade, the backend's Copy Trading Engine detects it, creates a proportional trade for the Supporter, and submits it to the blockchain using the signed delegation.</li>
                    <li>The smart contract verifies the delegation and its caveats before executing the trade. At no point do funds leave the Supporter's smart account.</li>
                  </ul>
                </Section>

                <Section title="5. The Arena: Matches" id="theArena" refProp={sectionRefs.theArena}>
                  <p>Matches are the heart of the TradeClub experience. They are time-limited, competitive events with clear rules and objectives.</p>
                  <ul>
                    <li><strong>Creation:</strong> Monachads can create matches, defining parameters like entry fee, duration (e.g., 1-hour Speed Round or 24-hour Endurance Match), and win conditions (e.g., highest percentage PnL).</li>
                    <li><strong>Joining:</strong> Other Monachads can join by staking the required entry margin.</li>
                    <li><strong>Prizes:</strong> Entry fees are pooled into a prize pot, which is distributed to the winner(s) at the end of the match.</li>
                    <li><strong>Real-time Tracking:</strong> All match activity, including live leaderboards and trade feeds, is broadcast to spectators and participants in real-time.</li>
                  </ul>
                </Section>

                <Section title="6. $TCLUB Tokenomics" id="tokenomics" refProp={sectionRefs.tokenomics}>
                  <p>The TradeClub ecosystem is powered by its native governance token, $TCLUB.</p>
                  <ul>
                    <li><strong>Utility:</strong> $TCLUB is primarily used for governance, allowing holders to vote on platform proposals and influence its future direction.</li>
                    <li><strong>Earning Mechanisms:</strong> Users can earn $TCLUB tokens through various forms of platform participation, such as winning matches, achieving high rankings, or contributing to the community.</li>
                    <li><strong>Revenue Sharing:</strong> A portion of the platform's revenue (from trading fees, match fees, etc.) will be directed to the DAO treasury, controlled by $TCLUB holders.</li>
                  </ul>
                </Section>

                <Section title="7. Governance & Bribe Wars" id="governance" refProp={sectionRefs.governance}>
                  <p>TradeClub features a sophisticated DAO governance model that goes beyond simple voting.</p>
                  <ul>
                    <li><strong>Vote Delegation:</strong> Token holders can delegate their voting power to other users—such as influential Monachads—without transferring their tokens, thanks to MetaMask Smart Accounts.</li>
                    <li><strong>Bribe Wars:</strong> This unique mechanic allows users to create 'bribe pools' to incentivize others to vote on proposals in a particular way. Delegators who contribute their voting power to a winning side share in the bribe rewards. This creates a dynamic, market-driven layer to governance.</li>
                    <li><strong>Transparency:</strong> All bribe offers, delegations, and votes are fully transparent and recorded on-chain, ensuring a fair and auditable process.</li>
                  </ul>
                </Section>

                <Section title="8. Roadmap" id="roadmap" refProp={sectionRefs.roadmap}>
                  <p>TradeClub's development is planned in three key phases:</p>
                  <ol>
                    <li><strong>Phase 1: MVP Launch & Community Building:</strong> Launch with core features (matches, delegation, copy trading) and focus on building a strong initial community of traders and supporters.</li>
                    <li><strong>Phase 2: Mainstream Adoption:</strong> Enhance the UI/UX, introduce a mobile app, and form partnerships with major DeFi communities and influencers to scale the user base.</li>
                    <li><strong>Phase 3: Decentralization & Expansion:</strong> Fully decentralize governance to the DAO, explore multi-chain deployments, and introduce institutional-grade features for professional trading firms.</li>
                  </ol>
                </Section>
                <img src="/pepemon2.png" alt="Pepemon" className="rounded-lg shadow-2xl my-6 w-1/2 mx-auto" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="relative z-20 mt-20 pt-10 pb-40 border-t border-purple-500/20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <p className="text-white/60 mb-6">© 2025 TradeClub. All rights reserved.</p>
              <div className="flex justify-center space-x-8 mb-8">
                <a href="https://twitter.com/tradeclub" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 transition-colors text-lg">
                  Twitter
                </a>
                <a href="https://discord.gg/tradeclub" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 transition-colors text-lg">
                  Discord
                </a>
                <a href="https://github.com/tradeclub" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 transition-colors text-lg">
                  GitHub
                </a>
                <a href="https://docs.tradeclub.com" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 transition-colors text-lg">
                  Docs
                </a>
              </div>
              <p className="text-white/40 text-sm">
                Built on Monad Blockchain • Secure • Decentralized • Community-Driven
              </p>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}