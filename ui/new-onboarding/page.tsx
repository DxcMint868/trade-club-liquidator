"use client";

import { useState, useEffect } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import type { Hex } from "viem";

// Icon components for steps
const CheckCircle = ({ className }: { className: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

const LoadingSpinner = () => (
  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export default function OnboardingPage() {
  const { address, isConnected, chain } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isDeployed, setIsDeployed] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [monachadVisible, setMonachadVisible] = useState(false);
  const [pepemonVisible, setPepemonVisible] = useState(false);

  const currentColor = "#a855f7"; // Purple for this page

  useEffect(() => {
    // Trigger the animation shortly after the component mounts
    const timer = setTimeout(() => {
        setMonachadVisible(true);
        setPepemonVisible(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isConnected && address && publicClient) {
      checkSmartAccount();
    } else {
      // Reset state if disconnected
      setSmartAccountAddress(null);
      setIsDeployed(false);
      setDeploymentStatus("");
      setError("");
    }
  }, [isConnected, address, publicClient, chain]);

  const checkSmartAccount = async () => {
    if (!address || !publicClient || !chain) return;

    try {
      setDeploymentStatus("Checking for existing smart account...");

      // Check localStorage for cached smart account address
      const cachedSmartAccount = localStorage.getItem(
        `smartAccount_${address}_${chain.id}`
      );

      if (cachedSmartAccount) {
        const code = await publicClient.getCode({
          address: cachedSmartAccount as Hex,
        });
        if (code && code !== "0x") {
          setSmartAccountAddress(cachedSmartAccount);
          setIsDeployed(true);
          setDeploymentStatus(`Smart account found: ${cachedSmartAccount}`);
          return;
        }
      }

      setDeploymentStatus("No smart account found. Deploy one to continue.");
      setError("");
    } catch (err: any) {
      console.error("Failed to check smart account:", err);
      setError(`Failed to check smart account: ${err.message}`);
    }
  };

  const deploySmartAccount = async () => {
    if (!address || !walletClient || !publicClient || !chain) {
      setError("Please connect your wallet first");
      return;
    }

    setIsDeploying(true);
    setError("");

    try {
      setDeploymentStatus(
        "Requesting smart account deployment from backend..."
      );

      // Call backend API to deploy the smart account
      // Backend will use its relayer to sponsor the deployment transaction
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/smart-account/deploy`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userAddress: address,
            implementation: "Hybrid",
            deployParams: [
              address, // EOA owner
              [], // No P256 signers
              [], // No delegate signers
              [], // No auth policies
            ],
            deploySalt:
              "0x0000000000000000000000000000000000000000000000000000000000000000",
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Deployment failed");
      }

      const result = await response.json();

      setSmartAccountAddress(result.smartAccountAddress);

      if (result.status === "already-deployed") {
        setIsDeployed(true);
        setDeploymentStatus(
          `Smart account already deployed at: ${result.smartAccountAddress}`
        );
      } else if (result.status === "deployed") {
        setIsDeployed(true);
        setDeploymentStatus(
          `Smart account deployed successfully!\n` +
            `Address: ${result.smartAccountAddress}\n` +
            `Tx: ${result.txHash}\n` +
            `Block: ${result.blockNumber}`
        );
      }

      // Cache in localStorage
      localStorage.setItem(
        `smartAccount_${address}_${chain.id}`,
        result.smartAccountAddress
      );

      console.log("Deployment result:", result);
    } catch (err: any) {
      console.error("Smart account creation error:", err);
      setError(
        `Failed to create smart account: ${err.message || "Unknown error"}`
      );
      setDeploymentStatus("");
    } finally {
      setIsDeploying(false);
    }
  };

  const getStepStatus = (step: number) => {
    if (!isConnected) {
      return step === 1 ? 'active' : 'inactive';
    }
    if (isDeployed) return 'completed';

    if (step === 1) return 'completed';
    if (step === 2) return isDeploying ? 'loading' : 'active';
    return 'inactive';
  };

  const Step = ({ num, title, status, children }: { num: number, title: string, status: 'completed' | 'active' | 'loading' | 'inactive', children: React.ReactNode }) => {
    const statusStyles: Record<'completed' | 'active' | 'loading' | 'inactive', { border: string; icon: JSX.Element }> = {
      completed: { border: 'border-green-500/50', icon: <CheckCircle className="w-6 h-6 text-green-400" /> },
      active: { border: 'border-purple-500/80', icon: <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse" /> },
      loading: { border: 'border-purple-500/80', icon: <LoadingSpinner /> },
      inactive: { border: 'border-gray-700/50', icon: <div className="w-3 h-3 bg-gray-600 rounded-full" /> },
    };

    return (
      <div className={`relative pl-12 pb-10 ${status === 'inactive' ? 'opacity-50' : ''}`}>
        <div className={`absolute left-0 top-0 flex items-center justify-center w-8 h-8 bg-black/50 rounded-full border-2 ${statusStyles[status].border}`}>
          {statusStyles[status].icon}
        </div>
        <div className="absolute left-4 top-8 w-px h-full bg-gray-700/50"></div>
        <h3 className="text-xl font-semibold text-white/90 mb-3">{title}</h3>
        <div className="text-white/70 text-sm leading-relaxed">
          {children}
        </div>
      </div>
    );
  };

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#080413] via-[#060310] via-30% to-[#04020d] to-black" />
      
      <div className="relative z-10">
        <Navigation color={currentColor} />
        
        <div className="relative z-20 pt-32 px-4 sm:px-6 lg:px-8 pb-20">
          
          {/* Pepemon5 side image */}
          <div 
            className={`fixed left-30 top-[25vh] z-5 transition-all duration-700 ease-in-out pointer-events-none hidden lg:block ${
              pepemonVisible ? 'translate-x-0 opacity-95' : '-translate-x-full opacity-0'
            }`}
          >
            <img
              src="/pepemon5.png"
              alt="pepemon side"
              className="w-3/4 max-w-[800px]"
              style={{
                filter: 'drop-shadow(0 0 30px rgba(168, 85, 247, 0.4))',
                animation: pepemonVisible ? 'float 8s ease-in-out infinite' : 'none'
              }}
            />
          </div>

          {/* Monachad side image */}
          <div 
            className={`fixed right-0 top-[20vh] z-0 transition-all duration-1000 ease-out pointer-events-none hidden lg:block ${
              monachadVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
            }`}
            style={{ transform: monachadVisible ? 'translateX(0)' : 'translateX(100%)' }}
          >
            <img
              src="/pepemon6.png"
              alt="pepemon"
              className="w-full max-w-[700px]"
              style={{
                filter: 'drop-shadow(0 0 40px rgba(168, 85, 247, 0.3))',
                animation: monachadVisible ? 'float 6s ease-in-out infinite' : 'none'
              }}
            />
          </div>

          <div className="max-w-2xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold mb-4 text-center text-purple-300">
              Become a Delegator
            </h1>
            <p className="text-xl md:text-2xl text-center text-purple-200/80 mb-16 italic">
              Create your Smart Account to start delegating.
            </p>

            <div className="bg-black/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-8 shadow-2xl">
              
              <Step num={1} title="Connect Your Wallet" status={getStepStatus(1)}>
                {!isConnected ? (
                  <>
                    <p className="mb-4">Connect your wallet to own and manage your Smart Account.</p>
                    <ConnectButton />
                  </>
                ) : (
                  <>
                    <p className="mb-2">Your Externally Owned Account (EOA) is connected.</p>
                    <p className="font-mono text-green-400 break-all text-xs bg-black/30 px-3 py-2 rounded-md border border-green-500/20">{address}</p>
                    <p className="text-xs text-white/50 mt-2">Chain: {chain?.name || "Unknown"} ({chain?.id})</p>
                  </>
                )}
              </Step>

              <Step num={2} title="Deploy Your Smart Account" status={getStepStatus(2)}>
                {isConnected && (
                  <>
                    <p className="mb-4">
                      This action will deploy a new ERC-4337 smart contract wallet, owned by your EOA. This enables secure, non-custodial delegation.
                    </p>
                    
                    {smartAccountAddress && (
                      <div className="mb-4">
                        <p className="text-xs text-white/50 mb-1">Deterministic Smart Account Address:</p>
                        <p className={`font-mono break-all text-xs px-3 py-2 rounded-md border ${isDeployed ? 'text-green-400 bg-black/30 border-green-500/20' : 'text-yellow-400 bg-black/30 border-yellow-500/20'}`}>
                          {smartAccountAddress}
                        </p>
                      </div>
                    )}

                    {deploymentStatus && !isDeploying && (
                      <div className="mb-4 p-3 bg-black/30 rounded-md border border-purple-500/20 text-xs whitespace-pre-wrap">
                        <p>{deploymentStatus}</p>
                      </div>
                    )}

                    {error && (
                      <div className="mb-4 p-3 bg-red-900/30 border border-red-500 rounded-md text-xs">
                        <p className="text-red-400">{error}</p>
                      </div>
                    )}

                    <button
                      onClick={deploySmartAccount}
                      disabled={isDeploying || !address || isDeployed}
                      className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-full transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none flex items-center justify-center gap-3"
                    >
                      {isDeploying && <LoadingSpinner />}
                      {isDeploying
                        ? "Deploying..."
                        : isDeployed
                        ? "Deployment Complete ✓"
                        : "Deploy Smart Account"}
                    </button>
                  </>
                )}
              </Step>

              <div className="relative pl-12">
                 <div className="absolute left-0 top-0 flex items-center justify-center w-8 h-8 bg-black/50 rounded-full border-2 ${getStepStatus(3) === 'inactive' ? 'border-gray-700/50' : 'border-green-500/50'}">
                  {isDeployed ? <CheckCircle className="w-6 h-6 text-green-400" /> : <div className="w-3 h-3 bg-gray-600 rounded-full" />}
                </div>
                <h3 className={`text-xl font-semibold mb-3 ${isDeployed ? 'text-white/90' : 'text-gray-600'}`}>Start Delegating</h3>
                <div className={`text-sm leading-relaxed ${isDeployed ? 'text-white/70' : 'text-gray-600'}`}>
                  <p className="mb-4">Your Smart Account is ready. You can now browse matches and delegate to your favorite Monachads.</p>
                  {isDeployed && (
                    <Link href="/matches">
                      <Button variant="ghost" className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10">
                        Browse The Arena →
                      </Button>
                    </Link>
                  )}
                </div>
              </div>

            </div>

            {/* Why Become a DeleGator Section */}
            <div className="mt-16">
              <h2 className="text-3xl font-bold text-center text-purple-300 mb-8">Why Become a DeleGator?</h2>
              <div className="grid md:grid-cols-2 gap-8">
                
                {/* Copy Trading Card */}
                <div className="bg-black/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-8 shadow-2xl hover:border-purple-500/40 transition-all duration-300 hover:scale-[1.02]">
                  <h3 className="text-2xl font-semibold text-purple-400 mb-4">Passive Income via Copy Trading</h3>
                  <ul className="space-y-3 text-white/70 text-sm">
                    <li className="flex items-start"><span className="text-purple-400 mr-3 mt-1">✓</span><span>Automatically mirror the trades of top-performing Monachads.</span></li>
                    <li className="flex items-start"><span className="text-purple-400 mr-3 mt-1">✓</span><span>Maintain full custody of your funds with non-custodial delegation.</span></li>
                    <li className="flex items-start"><span className="text-purple-400 mr-3 mt-1">✓</span><span>Set strict, on-chain enforced rules like spending limits and time-locks.</span></li>
                    <li className="flex items-start"><span className="text-purple-400 mr-3 mt-1">✓</span><span>Explore different strategies by delegating to multiple traders.</span></li>
                  </ul>
                </div>

                {/* Governance Card */}
                <div className="bg-black/40 backdrop-blur-xl border border-blue-500/20 rounded-3xl p-8 shadow-2xl hover:border-blue-500/40 transition-all duration-300 hover:scale-[1.02]">
                  <h3 className="text-2xl font-semibold text-blue-400 mb-4">Shape the Future with Governance</h3>
                  <ul className="space-y-3 text-white/70 text-sm">
                    <li className="flex items-start"><span className="text-blue-400 mr-3 mt-1">✓</span><span>Use your TCLUB tokens to vote on key platform decisions.</span></li>
                    <li className="flex items-start"><span className="text-blue-400 mr-3 mt-1">✓</span><span>Delegate your voting power to influential community members without transferring tokens.</span></li>
                    <li className="flex items-start"><span className="text-blue-400 mr-3 mt-1">✓</span><span>Participate in 'Bribe Wars' to earn rewards for your vote.</span></li>
                    <li className="flex items-start"><span className="text-blue-400 mr-3 mt-1">✓</span><span>Influence the roadmap, fee structures, and new features.</span></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}