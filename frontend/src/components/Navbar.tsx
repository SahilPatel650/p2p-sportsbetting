'use client';

import React from 'react';
import { useWeb3 } from '@/context/Web3Context';
import { Button } from '@/components/ui/button';
import { Toaster, toast } from 'sonner';

export function Navbar() {
  const { account, isConnected, isLoading, connect, disconnect, isCorrectNetwork, switchNetwork } = useWeb3();

  const formatAccount = (account: string) => {
    return `${account.substring(0, 6)}...${account.substring(account.length - 4)}`;
  };

  const handleConnect = async () => {
    try {
      await connect();
    } catch (error) {
      toast.error('Failed to connect to MetaMask');
      console.error(error);
    }
  };

  const handleSwitchNetwork = async () => {
    try {
      await switchNetwork();
      toast.success('Switched to Sepolia network');
    } catch (error) {
      toast.error('Failed to switch network');
      console.error(error);
    }
  };

  return (
    <nav className="flex items-center justify-between p-4 bg-white border-b">
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-bold">PeerPlay</h1>
      </div>
      <div className="flex items-center space-x-4">
        {isConnected ? (
          <>
            {!isCorrectNetwork && (
              <Button variant="destructive" onClick={handleSwitchNetwork}>
                Switch to Sepolia
              </Button>
            )}
            <div className="px-4 py-2 text-sm bg-slate-100 rounded-full">
              {formatAccount(account || '')}
            </div>
            <Button variant="outline" onClick={disconnect}>
              Disconnect
            </Button>
          </>
        ) : (
          <Button onClick={handleConnect} disabled={isLoading}>
            {isLoading ? 'Connecting...' : 'Connect Wallet'}
          </Button>
        )}
      </div>
    </nav>
  );
} 