'use client';

import { useEffect, useState, useRef } from 'react';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreateBetForm } from '@/components/CreateBetForm';
import { BetsList } from '@/components/BetsList';
import { SportsEventsList } from '@/components/SportsEventsList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWeb3 } from '@/context/Web3Context';

export default function Home() {
  const { isConnected, isCorrectNetwork } = useWeb3();
  const [activeTab, setActiveTab] = useState<string>("createBet");
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const betManagerAddress = process.env.NEXT_PUBLIC_BET_MANAGER_ADDRESS;
    const oracleRegistryAddress = process.env.NEXT_PUBLIC_BET_ORACLE_REGISTRY_ADDRESS;
    

    (window as any).switchToCreateBetTab = () => {
      setActiveTab("createBet");
    };
  }, []);

  useEffect(() => {
    const handleSwitchTab = () => {
      setActiveTab("createBet");
      if (tabsRef.current) {
        const tabElement = tabsRef.current.querySelector('[value="createBet"]');
        if (tabElement) {
          (tabElement as HTMLElement).click();
        }
      }
    };

    window.addEventListener('switch-to-create-bet', handleSwitchTab);
    
    return () => {
      window.removeEventListener('switch-to-create-bet', handleSwitchTab);
    };
  }, []);

  return (
    <main className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">

        {isConnected ? (
          isCorrectNetwork ? (
            <Tabs ref={tabsRef} value={activeTab} onValueChange={setActiveTab} defaultValue="createBet">
              <TabsList className="mb-4">
                <TabsTrigger value="createBet">Create Bet</TabsTrigger>
                <TabsTrigger value="bets">All Bets</TabsTrigger>
                <TabsTrigger value="sports">Sports Events</TabsTrigger>
              </TabsList>
              
              <TabsContent value="createBet">
                <div className="max-w-md mx-auto">
                  <CreateBetForm />
                </div>
              </TabsContent>
              
              <TabsContent value="bets">
                <BetsList />
              </TabsContent>
              
              <TabsContent value="sports">
                <SportsEventsList />
              </TabsContent>
            </Tabs>
          ) : (
            <Card className="bg-yellow-50">
            </Card>
          )
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Welcome to PeerPlay</CardTitle>
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
