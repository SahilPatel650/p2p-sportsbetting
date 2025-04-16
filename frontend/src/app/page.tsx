'use client';

import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreateBetForm } from '@/components/CreateBetForm';
import { BetsList } from '@/components/BetsList';
import { useWeb3 } from '@/context/Web3Context';

export default function Home() {
  const { isConnected, isCorrectNetwork } = useWeb3();
  const [showSetupCard, setShowSetupCard] = useState(true);

  useEffect(() => {
    // Check if environment variables are set
    const betManagerAddress = process.env.NEXT_PUBLIC_BET_MANAGER_ADDRESS;
    const oracleRegistryAddress = process.env.NEXT_PUBLIC_BET_ORACLE_REGISTRY_ADDRESS;
    
    // Hide setup card if both addresses are set and not empty
    if (betManagerAddress && betManagerAddress.length > 0 && 
        oracleRegistryAddress && oracleRegistryAddress.length > 0) {
      setShowSetupCard(false);
    }
  }, []);

  return (
    <main className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        {showSetupCard && (
          <Card className="mb-6 border-yellow-500">
            <CardHeader>
              <CardTitle>Setup Required</CardTitle>
              <CardDescription>
                Please deploy your contracts to Sepolia first and set the environment variables.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                Add these to your <code>.env.local</code> file:
              </p>
              <pre className="p-2 mt-2 bg-gray-100 rounded text-sm">
                <code>
                  NEXT_PUBLIC_BET_MANAGER_ADDRESS=your_contract_address_here<br />
                  NEXT_PUBLIC_BET_ORACLE_REGISTRY_ADDRESS=your_contract_address_here
                </code>
              </pre>
            </CardContent>
          </Card>
        )}

        {isConnected ? (
          isCorrectNetwork ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <CreateBetForm />
              </div>
              <div className="lg:col-span-2">
                <BetsList />
              </div>
            </div>
          ) : (
            <Card className="bg-yellow-50">
              <CardHeader>
                <CardTitle>Wrong Network</CardTitle>
              </CardHeader>
              <CardContent>
                <p>Please switch to Sepolia testnet to use this application.</p>
              </CardContent>
            </Card>
          )
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Welcome to P2P Sports Betting</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Connect your wallet to get started!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
