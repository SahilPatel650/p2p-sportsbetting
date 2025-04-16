'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '@/context/Web3Context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

// Define Bet interface based on our contract structure
interface Bet {
  creator: string;
  joiner: string;
  amount: bigint;
  description: string;
  deadline: bigint;
  creatorWon: boolean;
  status: number;
  isSettled: boolean;
  id?: number; // Added for UI purposes
}

// Convert status number to readable string
const getBetStatusText = (status: number | undefined): string => {
  if (status === undefined) return 'Unknown';
  const statusMap: Record<number, string> = {
    0: 'Open',
    1: 'Active',
    2: 'Completed',
    3: 'Cancelled',
    4: 'Refunded'
  };
  return statusMap[status] || 'Unknown';
};

// Format timestamp to readable date
const formatDate = (timestamp: bigint | undefined): string => {
  if (!timestamp) return 'Unknown Date';
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleString();
};

// Format address for display
const formatAddress = (address: string | undefined): string => {
  if (!address) return 'Unknown Address';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

export function BetsList() {
  const { betManager, account, isConnected, isCorrectNetwork } = useWeb3();
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(false);
  const [joiningBet, setJoiningBet] = useState<number | null>(null);

  // Fetch all bets
  const fetchBets = async () => {
    if (!betManager || !isConnected) return;
    
    setLoading(true);
    try {
      const allBets = await betManager.getBets();
      
      // Transform and add ID for each bet
      const formattedBets = allBets
        .filter((bet: any) => bet !== null && typeof bet === 'object') // Filter out null or invalid bets
        .map((bet: Bet, index: number) => ({
          ...bet,
          id: index,
          // Ensure properties exist or provide defaults
          creator: bet.creator || '',
          joiner: bet.joiner || '',
          amount: bet.amount || BigInt(0),
          description: bet.description || 'No description',
          deadline: bet.deadline || BigInt(0),
          status: typeof bet.status === 'number' ? bet.status : 0,
          creatorWon: Boolean(bet.creatorWon),
          isSettled: Boolean(bet.isSettled)
        }));
      
      setBets(formattedBets);
    } catch (error) {
      console.error('Error fetching bets:', error);
      toast.error('Failed to load bets');
    } finally {
      setLoading(false);
    }
  };

  // Join a bet
  const handleJoinBet = async (betId: number, amount: bigint) => {
    if (!betManager || !isConnected || !isCorrectNetwork) {
      toast.error('Please connect your wallet to Sepolia network');
      return;
    }

    if (!betId && betId !== 0) {
      toast.error('Invalid bet ID');
      return;
    }

    if (!amount) {
      toast.error('Invalid bet amount');
      return;
    }

    setJoiningBet(betId);
    try {
      // Check if bet exists and is joinable before proceeding
      const bet = await betManager.getBetDetails(betId);
      if (!bet || bet.status !== 0) {
        toast.error('This bet is no longer available to join');
        return;
      }

      const tx = await betManager.joinBet(betId, {
        value: amount
      });
      
      toast.info('Transaction submitted. Waiting for confirmation...');
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        toast.success('Successfully joined the bet!');
        // Refresh bets list
        fetchBets();
      } else {
        toast.error('Transaction failed');
      }
    } catch (error: any) {
      console.error('Error joining bet:', error);
      let errorMessage = 'Failed to join bet';
      
      // Try to extract a more useful error message
      if (error.message) {
        if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds to join this bet';
        } else if (error.message.includes('user rejected')) {
          errorMessage = 'Transaction was rejected';
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setJoiningBet(null);
    }
  };

  // Initialize and set up event listeners
  useEffect(() => {
    if (isConnected && betManager) {
      fetchBets();
      
      // Listen for new bet events
      const betCreatedFilter = betManager.filters.BetCreated();
      const betJoinedFilter = betManager.filters.BetJoined();
      const betSettledFilter = betManager.filters.BetSettled();
      const betCancelledFilter = betManager.filters.BetCancelled();
      
      betManager.on(betCreatedFilter, () => {
        fetchBets();
      });
      
      betManager.on(betJoinedFilter, () => {
        fetchBets();
      });
      
      betManager.on(betSettledFilter, () => {
        fetchBets();
      });
      
      betManager.on(betCancelledFilter, () => {
        fetchBets();
      });
      
      // Clean up event listeners
      return () => {
        betManager.off(betCreatedFilter);
        betManager.off(betJoinedFilter);
        betManager.off(betSettledFilter);
        betManager.off(betCancelledFilter);
      };
    }
  }, [betManager, isConnected]);

  // Filter for bets that are still open and not created by current user
  const openBets = bets.filter(bet => 
    bet.status === 0 && // Open status
    bet.creator && account && bet.creator.toLowerCase() !== account.toLowerCase() // Not created by current user
  );

  // Get user's bets (either as creator or joiner)
  const userBets = account ? bets.filter(bet => 
    (bet.creator && bet.creator.toLowerCase() === account.toLowerCase()) || 
    (bet.joiner && bet.joiner.toLowerCase() === account.toLowerCase())
  ) : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Open Bets</h2>
        {loading ? (
          <p>Loading bets...</p>
        ) : openBets.length > 0 ? (
          <div className="grid gap-4">
            {openBets.map((bet) => (
              <Card key={bet.id} className="overflow-hidden">
                <CardHeader className="bg-gray-50">
                  <CardTitle className="text-lg">{bet.description}</CardTitle>
                  <CardDescription>Created by: {formatAddress(bet.creator)}</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid gap-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Stake:</span>
                      <span className="font-medium">{ethers.formatEther(bet.amount)} ETH</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Deadline:</span>
                      <span className="font-medium">{formatDate(bet.deadline)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Status:</span>
                      <span className="font-medium text-green-600">{getBetStatusText(bet.status)}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-gray-50">
                  <Button
                    onClick={() => handleJoinBet(bet.id!, bet.amount)}
                    disabled={joiningBet === bet.id || !isConnected || !isCorrectNetwork}
                    className="w-full"
                  >
                    {joiningBet === bet.id ? 'Joining...' : `Join Bet (${ethers.formatEther(bet.amount)} ETH)`}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-4">
              <p className="text-center text-gray-500">No open bets available.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">My Bets</h2>
        {loading ? (
          <p>Loading bets...</p>
        ) : userBets.length > 0 ? (
          <div className="grid gap-4">
            {userBets.map((bet) => (
              <Card key={bet.id} className="overflow-hidden">
                <CardHeader className={bet.status === 0 ? "bg-blue-50" : bet.status === 1 ? "bg-yellow-50" : "bg-gray-50"}>
                  <CardTitle className="text-lg">{bet.description}</CardTitle>
                  <CardDescription>
                    {bet.creator && bet.creator.toLowerCase() === account?.toLowerCase() 
                      ? "You created this bet"
                      : `You joined this bet (created by ${formatAddress(bet.creator)})`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid gap-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Stake:</span>
                      <span className="font-medium">{ethers.formatEther(bet.amount)} ETH</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Deadline:</span>
                      <span className="font-medium">{formatDate(bet.deadline)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Status:</span>
                      <span className={`font-medium ${
                        bet.status === 0 ? "text-blue-600" : 
                        bet.status === 1 ? "text-yellow-600" : 
                        bet.status === 2 ? "text-green-600" : 
                        "text-gray-600"
                      }`}>
                        {getBetStatusText(bet.status)}
                      </span>
                    </div>
                    {bet.status === 1 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Opponent:</span>
                        <span className="font-medium">
                          {bet.creator && bet.creator.toLowerCase() === account?.toLowerCase() 
                            ? formatAddress(bet.joiner)
                            : formatAddress(bet.creator)}
                        </span>
                      </div>
                    )}
                    {bet.status === 2 && bet.isSettled && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Result:</span>
                        <span className="font-medium">
                          {(bet.creator && bet.creator.toLowerCase() === account?.toLowerCase() && bet.creatorWon) ||
                           (bet.joiner && bet.joiner.toLowerCase() === account?.toLowerCase() && !bet.creatorWon)
                            ? "You won!" 
                            : "You lost"}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
                {bet.status === 0 && bet.creator && bet.creator.toLowerCase() === account?.toLowerCase() && (
                  <CardFooter className="bg-gray-50">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        if (!betManager) {
                          toast.error('Betting contract not initialized');
                          return;
                        }
                        try {
                          setJoiningBet(bet.id!);
                          const tx = await betManager.cancelBet(bet.id);
                          await tx.wait();
                          toast.success('Bet cancelled successfully');
                          fetchBets();
                        } catch (error: any) {
                          toast.error(error.message || 'Failed to cancel bet');
                        } finally {
                          setJoiningBet(null);
                        }
                      }}
                      disabled={joiningBet === bet.id}
                      className="w-full"
                    >
                      {joiningBet === bet.id ? 'Cancelling...' : 'Cancel Bet'}
                    </Button>
                  </CardFooter>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-4">
              <p className="text-center text-gray-500">You have no active bets.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
} 