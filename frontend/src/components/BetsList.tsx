'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '@/context/Web3Context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface Bet {
  creator: string;
  joiner: string;
  amount: bigint;
  description: string;
  deadline: bigint;
  creatorWon: boolean;
  status: number;
  isSettled: boolean;
  sportEvent: string;
  selectedTeam: string;
  threshold: bigint;
  isMoreLine: boolean;
}

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

const formatDate = (timestamp: bigint | undefined): string => {
  if (!timestamp) return 'Unknown Date';
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatAddress = (address: string | undefined): string => {
  if (!address) return 'Unknown Address';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

export function BetsList() {
  const { betManager, account, isConnected, isCorrectNetwork } = useWeb3();
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(false);
  const [joiningBet, setJoiningBet] = useState<number | null>(null);

  const fetchBets = async () => {
    if (!betManager || !isConnected) return;
    
    setLoading(true);
    try {
      const allBets = await betManager.getBets();
      
      const formattedBets = allBets
        .map((bet: Bet, index: number) => {
          const status = typeof bet.status === 'bigint' ? Number(bet.status) : 
                        typeof bet.status === 'number' ? bet.status : 0;
          
          return {
            ...bet,
            id: index,
            creator: bet.creator || '',
            joiner: bet.joiner || '',
            amount: bet.amount || BigInt(0),
            description: bet.description || 'No description',
            deadline: bet.deadline || BigInt(0),
            status: status,
            creatorWon: Boolean(bet.creatorWon),
            isSettled: Boolean(bet.isSettled),
            sportEvent: bet.sportEvent || '',
            selectedTeam: bet.selectedTeam || '',
            threshold: bet.threshold || BigInt(0),
            isMoreLine: Boolean(bet.isMoreLine)
          };
        });
      
      console.log('Updated bets:', formattedBets.map((bet: Bet) => ({
        id: bet.id,
        status: bet.status,
        statusText: getBetStatusText(bet.status)
      })));
      
      setBets(formattedBets);
    } catch (error) {
      toast.error('Failed to load bets');
    } finally {
      setLoading(false);
    }
  };

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
      const bet = await betManager.getBetDetails(betId);
      console.log('Bet details before joining:', {
        id: betId,
        status: bet.status,
        statusText: getBetStatusText(bet.status),
        creator: bet.creator,
        joiner: bet.joiner,
        amount: bet.amount.toString(),
        currentAccount: account,
        isZeroAddress: bet.joiner === ethers.ZeroAddress,
        contractAddress: betManager.address
      });

      if (!bet) {
        toast.error('This bet no longer exists');
        return;
      }

      const betStatus = Number(bet.status);
      if (betStatus !== 0) {
        const statusText = getBetStatusText(betStatus);
        toast.error(`This bet is ${statusText.toLowerCase()}`);
        return;
      }

      if (bet.joiner !== ethers.ZeroAddress) {
        toast.error('Bet has been already joined');
        return;
      }

      if (bet.creator.toLowerCase() === account?.toLowerCase()) {
        toast.error('You cannot join your own bet');
        return;
      }


      console.log('Attempting to join bet with:', {
        betId,
        amount: amount.toString(),
        value: amount.toString(),
        contractAddress: betManager.address
      });

      try {
        const tx = await betManager.joinBet(betId, {
          value: amount
        });
        
        console.log('Transaction submitted:', {
          hash: tx.hash,
          from: account,
          to: betManager.address,
          value: amount.toString()
        });
        
        toast.info('Transaction submitted. Waiting for confirmation...');
        
        const receipt = await tx.wait();
        console.log('Transaction receipt:', {
          status: receipt.status,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString()
        });
        
        if (receipt.status === 1) {
          toast.success('Successfully joined the bet!');
          fetchBets();
        } else {
          toast.error('Transaction failed');
        }
      } catch (txError: any) {
        console.error('Transaction error:', {
          message: txError.message,
          code: txError.code,
          data: txError.data
        });
        throw txError;
      }
    } catch (error: any) {
      
      let errorMessage = 'Failed to join bet';
      
      toast.error(errorMessage);
    } finally {
      setJoiningBet(null);
    }
  };

  const handleCancelBet = async (betId: number) => {
    if (!betManager || !isConnected || !isCorrectNetwork) {
      toast.error('Please connect your wallet to Sepolia network');
      return;
    }

    try {
      toast.info('Cancelling bet');
      const tx = await betManager.cancelBet(betId);
      await tx.wait();
      toast.success('Bet cancelled successfully!');
      fetchBets();
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel bet');
    }
  };

  const handleRefundBet = async (betId: number) => {
    if (!betManager || !isConnected || !isCorrectNetwork) {
      toast.error('Please connect your wallet to Sepolia network');
      return;
    }

    try {
      toast.info('Claiming refund');
      const tx = await betManager.timeoutBet(betId);
      await tx.wait();
      toast.success('Refund claimed successfully!');
      fetchBets();
    } catch (error: any) {
      console.error('Error claiming refund:', error);
      toast.error(error.message || 'Failed to claim refund');
    }
  };

  useEffect(() => {
    if (!betManager) return;
    
    fetchBets();
    
    const handleBetCreated = () => {
      console.log('Bet created event detected');
      fetchBets();
    };
    
    const handleBetJoined = () => {
      console.log('Bet joined event detected');
      fetchBets();
    };
    
    const handleBetSettled = () => {
      console.log('Bet settled event detected');
      fetchBets();
    };
    
    const handleBetCancelled = () => {
      console.log('Bet cancelled event detected');
      fetchBets();
    };
    
    const handleBetRefunded = () => {
      console.log('Bet refunded event detected');
      fetchBets();
    };
    
    betManager.on('BetCreated', handleBetCreated);
    betManager.on('BetJoined', handleBetJoined);
    betManager.on('BetSettled', handleBetSettled);
    betManager.on('BetCancelled', handleBetCancelled);
    betManager.on('BetRefunded', handleBetRefunded);
    
    return () => {
      betManager.off('BetCreated', handleBetCreated);
      betManager.off('BetJoined', handleBetJoined);
      betManager.off('BetSettled', handleBetSettled);
      betManager.off('BetCancelled', handleBetCancelled);
      betManager.off('BetRefunded', handleBetRefunded);
    };
  }, [betManager]);
  
  const openBets = bets.filter(bet => bet.status === 0);
  const activeBets = bets.filter(bet => bet.status === 1);
  const completedBets = bets.filter(bet => bet.status === 2);
  const cancelledOrRefundedBets = bets.filter(bet => bet.status === 3 || bet.status === 4);
  
  const now = Math.floor(Date.now() / 1000);
  
  const isPastDeadline = (bet: Bet): boolean => {
    return Number(bet.deadline) < now;
  };

  const isInvolvedInBet = (bet: Bet): boolean => {
    if (!account) return false;
    return bet.creator.toLowerCase() === account.toLowerCase() || 
           bet.joiner.toLowerCase() === account.toLowerCase();
  };
  
  const getUserRoleInBet = (bet: Bet): string => {
    if (!account) return 'Not Involved';
    if (bet.creator.toLowerCase() === account.toLowerCase()) return 'Creator';
    if (bet.joiner.toLowerCase() === account.toLowerCase()) return 'Joiner';
    return 'Not Involved';
  };
  
  const formatOutcome = (bet: Bet): string => {
    return `${bet.selectedTeam} will score ${bet.isMoreLine ? 'more' : 'less'} than ${bet.threshold.toString()} points`;
  };
  
  const renderBetCard = (bet: Bet) => {
    const statusText = getBetStatusText(bet.status);
    const deadline = formatDate(bet.deadline);
    const isPast = isPastDeadline(bet);
    const userRole = getUserRoleInBet(bet);
    const isRefundable = isPast && bet.status === 1 && !bet.isSettled;
    const betAmount = ethers.formatEther(bet.amount);
    
    return (
      <Card key={bet.id} className={`
        ${statusText === 'Open' ? 'border-blue-300' : ''}
        ${statusText === 'Active' ? 'border-green-300' : ''}
        ${statusText === 'Completed' ? 'border-purple-300' : ''}
        ${statusText === 'Cancelled' || statusText === 'Refunded' ? 'border-gray-300' : ''}
        ${isRefundable ? 'border-yellow-300' : ''}
      `}>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <div className="text-lg">
              {bet.sportEvent || 'Sports Event'}
            </div>
            <div className="text-sm font-normal">
              <span className={`
                inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                ${statusText === 'Open' ? 'bg-blue-100 text-blue-800' : ''}
                ${statusText === 'Active' ? 'bg-green-100 text-green-800' : ''}
                ${statusText === 'Completed' ? 'bg-purple-100 text-purple-800' : ''}
                ${statusText === 'Cancelled' || statusText === 'Refunded' ? 'bg-gray-100 text-gray-800' : ''}
                ${isRefundable ? 'bg-yellow-100 text-yellow-800' : ''}
              `}>
                {statusText}
              </span>
            </div>
          </CardTitle>
          <CardDescription>
            <span className="font-medium">Bet ID:</span> {bet.id}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm">
            <div className="font-semibold mb-2">Outcome Prediction:</div>
            <div className="bg-gray-50 p-3 rounded-md mb-3">
              {formatOutcome(bet)}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="font-semibold">Amount:</div>
                <div>{betAmount} ETH</div>
              </div>
              <div>
                <div className="font-semibold">Deadline:</div>
                <div className={isPast ? 'text-red-500' : ''}>
                  {deadline}
                  {isPast && ' (Passed)'}
                </div>
              </div>
              <div>
                <div className="font-semibold">Creator:</div>
                <div>
                  {formatAddress(bet.creator)}
                  {userRole === 'Creator' && ' (You)'}
                </div>
              </div>
              <div>
                <div className="font-semibold">Joiner:</div>
                <div>
                  {bet.joiner && bet.joiner !== ethers.ZeroAddress
                    ? formatAddress(bet.joiner) + (userRole === 'Joiner' ? ' (You)' : '')
                    : 'Not joined yet'}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-between">
          {statusText === 'Open' && (
            <>
              {bet.creator.toLowerCase() === account?.toLowerCase() ? (
                <Button 
                  variant="outline" 
                  onClick={() => handleCancelBet(bet.id as number)}
                  disabled={!isConnected || !isCorrectNetwork}
                >
                  Cancel Bet
                </Button>
              ) : (
                <Button 
                  onClick={() => handleJoinBet(bet.id as number, bet.amount)}
                  disabled={joiningBet === bet.id || !isConnected || !isCorrectNetwork}
                >
                  {joiningBet === bet.id ? 'Joining...' : 'Join Bet'}
                </Button>
              )}
              <div className="text-sm text-gray-500">
                Stake: {betAmount} ETH
              </div>
            </>
          )}
          
          {statusText === 'Active' && (
            <>
              {isRefundable && isInvolvedInBet(bet) ? (
                <Button 
                  variant="outline" 
                  onClick={() => handleRefundBet(bet.id as number)}
                  disabled={!isConnected || !isCorrectNetwork}
                >
                  Claim Refund
                </Button>
              ) : (
                <div className="text-sm">
                  Waiting for settlement
                </div>
              )}
              <div className="text-sm text-gray-500">
                Total pot: {(Number(betAmount) * 2).toFixed(4)} ETH
              </div>
            </>
          )}
          
          {statusText === 'Completed' && (
            <div className="text-sm w-full text-center">
              Winner: {bet.creatorWon ? formatAddress(bet.creator) : formatAddress(bet.joiner)}
              {bet.creatorWon && userRole === 'Creator' && ' (You)'}
              {!bet.creatorWon && userRole === 'Joiner' && ' (You)'}
            </div>
          )}
          
          {(statusText === 'Cancelled' || statusText === 'Refunded') && (
            <div className="text-sm w-full text-center text-gray-500">
              This bet was {statusText.toLowerCase()}
            </div>
          )}
        </CardFooter>
      </Card>
    );
  };

  if (loading) {
    return <div className="p-6 text-center">Loading bets...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold mb-4">Open Bets ({openBets.length})</h2>
        {openBets.length === 0 ? (
          <Card>
            <CardContent className="py-4">
              <p className="text-center text-gray-500">
                No open bets available. Create a new bet to get started!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {openBets.map(renderBetCard)}
          </div>
        )}
      </div>
      
      {activeBets.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Active Bets ({activeBets.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeBets.map(renderBetCard)}
          </div>
        </div>
      )}
      
      {completedBets.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Completed Bets ({completedBets.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedBets.map(renderBetCard)}
          </div>
        </div>
      )}
      
      {cancelledOrRefundedBets.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Cancelled/Refunded Bets ({cancelledOrRefundedBets.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cancelledOrRefundedBets.map(renderBetCard)}
          </div>
        </div>
      )}
    </div>
  );
}