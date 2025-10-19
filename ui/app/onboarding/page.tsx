"use client";

import { useState, useEffect } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import {
  toMetaMaskSmartAccount,
  Implementation,
} from "@metamask/delegation-toolkit";
import type { Hex } from "viem";

export default function OnboardingPage() {
  const { address, isConnected, chain } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(
    null
  );
  const [isDeploying, setIsDeploying] = useState(false);
  const [isDeployed, setIsDeployed] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (isConnected && address && publicClient) {
      checkSmartAccount();
    }
  }, [isConnected, address, publicClient]);

  const checkSmartAccount = async () => {
    if (!address || !publicClient || !chain) return;

    try {
      setDeploymentStatus("Checking for existing smart account...");

      // Check localStorage for cached smart account address
      const cachedSmartAccount = localStorage.getItem(
        `smartAccount_${address}`
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
        `smartAccount_${address}`,
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

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <Link href="/" className="text-blue-500 hover:text-blue-400">
            ← Back to Home
          </Link>
          <ConnectButton />
        </div>

        <h1 className="text-4xl font-bold mb-8">Smart Account Onboarding</h1>

        {!isConnected ? (
          <div className="card">
            <p className="text-gray-400 mb-4">
              Connect your wallet to get started
            </p>
            <ConnectButton />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Connected Account Info */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">
                Connected EOA (Externally Owned Account)
              </h2>
              <p className="text-gray-400 break-all font-mono">{address}</p>
              <p className="text-sm text-gray-500 mt-2">
                Chain: {chain?.name || "Unknown"} ({chain?.id})
              </p>
            </div>

            {/* Smart Account Status */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">
                MetaMask Smart Account (DeleGator)
              </h2>

              <div className="mb-4">
                <p className="text-sm text-gray-400 mb-2">
                  Deterministic Address:
                </p>
                {smartAccountAddress ? (
                  <div className="flex items-center gap-2">
                    <p
                      className={`break-all font-mono ${
                        isDeployed ? "text-green-400" : "text-yellow-400"
                      }`}
                    >
                      {smartAccountAddress}
                    </p>
                    {isDeployed && (
                      <span className="text-xs bg-green-600 px-2 py-1 rounded">
                        Deployed
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500">Computing...</p>
                )}
              </div>

              {deploymentStatus && (
                <div className="mb-4 p-4 bg-gray-900 rounded">
                  <p className="text-sm">{deploymentStatus}</p>
                </div>
              )}

              {error && (
                <div className="mb-4 p-4 bg-red-900/30 border border-red-500 rounded">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={deploySmartAccount}
                disabled={isDeploying || !address || isDeployed}
                className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeploying
                  ? "Deploying Smart Account..."
                  : isDeployed
                  ? "Smart Account Deployed ✓"
                  : "Deploy Smart Account"}
              </button>
            </div>

            {/* Info Box */}
            <div className="card bg-blue-900/20 border-blue-500">
              <h3 className="text-lg font-semibold mb-2">
                What is a Smart Account?
              </h3>
              <ul className="text-gray-400 space-y-2 text-sm">
                <li>
                  • A MetaMask DeleGator is a smart contract wallet (ERC-4337)
                </li>
                <li>
                  • It allows you to delegate trading authority to Monachads
                </li>
                <li>
                  • Delegations are enforced by on-chain caveats (spending
                  limits, allowed targets, etc.)
                </li>
                <li>
                  • Your EOA remains the owner and can revoke delegations
                  anytime
                </li>
                <li>
                  • Uses MetaMask Delegation Framework for secure, gasless
                  delegation
                </li>
              </ul>
            </div>

            {/* How it works */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-2">
                How Delegation Works
              </h3>
              <ol className="text-gray-400 space-y-2 text-sm list-decimal list-inside">
                <li>Your EOA owns the smart account (DeleGator)</li>
                <li>Sign a delegation with caveats (limits, conditions)</li>
                <li>
                  Monachad executes trades on your behalf via UserOperation
                </li>
                <li>Caveats are enforced on-chain automatically</li>
                <li>You can revoke delegations anytime</li>
              </ol>
            </div>

            {/* Next Steps */}
            {isDeployed && (
              <div className="card bg-green-900/20 border-green-500">
                <h3 className="text-lg font-semibold mb-4">
                  ✓ Ready to Trade!
                </h3>
                <p className="text-gray-400 mb-4">
                  Your smart account is deployed and ready for delegations.
                </p>
                <Link href="/matches" className="btn btn-primary">
                  Browse Matches →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
