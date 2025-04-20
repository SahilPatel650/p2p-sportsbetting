'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, RefreshCw, CheckCircle, XCircle, PlayCircle } from 'lucide-react';
import { useWeb3 } from '@/context/Web3Context';
import { ethers } from 'ethers';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

// For demo purposes, we're using mock data
// In a production environment, you would use a real sports data API
const MOCK_ORACLE_ADDRESS = '0x1234567890123456789012345678901234567890';

interface Team {
  name: string;
  id: string;
}

interface Bet {
  id: string;
  creator: string;
  joiner: string;
  gameId: string;
  team: Team;
  isOver: boolean;
  points: number;
  amount: string;
  timestamp: number;
  isActive: boolean;
  isResolved: boolean;
  didCreatorWin?: boolean;
}

interface GameResult {
  gameId: string;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number;
  awayScore: number;
  status: 'completed' | 'in_progress' | 'scheduled';
  date: string;
}

export function BetResolver() {
  const { provider, address, betManagerContract } = useWeb3() as any; // Type assertion to avoid TypeScript errors
  const [loading, setLoading] = useState(false);
  const [activeBets, setActiveBets] = useState<Bet[]>([]);
  const [gameResults, setGameResults] = useState<GameResult[]>([]);
  const [resolvingBet, setResolvingBet] = useState<string | null>(null);
  const [demoRunning, setDemoRunning] = useState(false);
  const { toast } = useToast();

  // Generate realistic mock data including user's address if available
  const generateMockBets = () => {
    const userAddress = address || '0xDa4366F42A79336941E47de3C30B9B9e3CBC1';
    
    return [
      {
        id: '0',
        creator: userAddress,
        joiner: '0x3805EF0F989C3D9c3c401734d89583BF63',
        gameId: 'MLB_2023_2001',
        team: { name: 'Atlanta Braves', id: 'ATL' },
        isOver: true,
        points: 5,
        amount: '0.001',
        timestamp: Date.now() - 86400000, // 1 day ago
        isActive: true,
        isResolved: false
      }
    ];
  };

  // Generate realistic mock game results
  const generateMockGameResults = (): GameResult[] => {
    return [
      {
        gameId: 'MLB_2023_2001',
        homeTeam: { name: 'Minnesota Twins', id: 'MIN' },
        awayTeam: { name: 'Atlanta Braves', id: 'ATL' },
        homeScore: 3,
        awayScore: 6,
        status: 'completed',
        date: '2023-11-19'
      }
    ];
  };

  // Simulated Oracle contract call to get verified game results
  const getOracleVerifiedResult = async (gameId: string): Promise<GameResult | null> => {
    console.log(`Calling Oracle contract at ${MOCK_ORACLE_ADDRESS} for game ${gameId}`);
    
    // In a real implementation, this would call the Oracle contract
    // For demo purposes, we'll simulate the contract call with a delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const result = gameResults.find(result => result.gameId === gameId);
    
    if (result) {
      toast({
        title: 'Oracle Verified',
        description: `Game result for ${result.homeTeam.name} vs ${result.awayTeam.name} verified by oracle`,
        variant: 'success'
      });
    }
    
    return result || null;
  };

  // Load active bets from the contract
  const loadActiveBets = async () => {
    if (!betManagerContract && !demoRunning) return;
    
    setLoading(true);
    try {
      // In a real implementation, you would call your contract
      // For demo purposes, we'll use mock data
      const mockBets = generateMockBets();
      setActiveBets(mockBets);
      
      toast({
        title: 'Success',
        description: 'Active bets loaded successfully',
        variant: 'success'
      });
    } catch (error) {
      console.error('Error loading active bets:', error);
      toast({
        title: 'Error',
        description: 'Failed to load active bets',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch game results from external API
  const fetchGameResults = async () => {
    setLoading(true);
    try {
      // In a real implementation, you would fetch from a sports data API
      // For demo purposes, we'll use mock data
      const mockResults = generateMockGameResults();
      setGameResults(mockResults);
      
      toast({
        title: 'Success',
        description: 'Game results fetched successfully',
        variant: 'success'
      });
    } catch (error) {
      console.error('Error fetching game results:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch game results',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Determine if a bet creator won based on game results
  const didCreatorWin = (bet: Bet, gameResult: GameResult): boolean => {
    if (!gameResult) return false;
    
    if (bet.team.id === gameResult.awayTeam.id) {
      return bet.isOver ? gameResult.awayScore > bet.points : gameResult.awayScore < bet.points;
    } else {
      return bet.isOver ? gameResult.homeScore > bet.points : gameResult.homeScore < bet.points;
    }
  };

  // Resolve a bet on the contract
  const resolveBet = async (bet: Bet) => {
    // Allow resolution in demo mode even without contract
    if (!demoRunning && !betManagerContract) {
      toast({
        title: 'Error',
        description: 'Wallet not connected',
        variant: 'destructive'
      });
      return;
    }

    setResolvingBet(bet.id);
    
    try {
      // First, get verified result from oracle
      toast({
        title: 'Processing',
        description: 'Requesting verified result from oracle...',
      });
      
      const verifiedResult = await getOracleVerifiedResult(bet.gameId);
      
      if (!verifiedResult) {
        toast({
          title: 'Error',
          description: 'Oracle could not verify game result',
          variant: 'destructive'
        });
        return;
      }
      
      const creatorWon = didCreatorWin(bet, verifiedResult);
      
      // Attempt actual contract call to trigger MetaMask
      if (betManagerContract) {
        toast({
          title: 'Processing',
          description: 'Submitting transaction to blockchain. Check MetaMask...',
        });
        
        try {
          // This will trigger MetaMask to prompt for transaction approval
          // Replace with your actual contract function
          const tx = await betManagerContract.settleBet(
            bet.id, 
            creatorWon, 
            {
              gasLimit: 500000, // Adjust as needed
            }
          );
          
          toast({
            title: 'Transaction Submitted',
            description: 'Waiting for confirmation...',
          });
          
          // Wait for transaction to be mined
          const receipt = await tx.wait();
          
          toast({
            title: 'Transaction Confirmed',
            description: `Transaction hash: ${receipt.transactionHash}`,
            variant: 'success'
          });
          
          // Update local state to reflect the bet resolution
          setActiveBets(prevBets => 
            prevBets.map(b => 
              b.id === bet.id 
                ? { ...b, isResolved: true, isActive: false, didCreatorWin: creatorWon } 
                : b
            )
          );
          
          return;
        } catch (error: any) {
          console.error('Contract call error:', error);
          // If user rejected the transaction
          if (error.code === 4001) {
            toast({
              title: 'Transaction Rejected',
              description: 'You rejected the MetaMask transaction',
              variant: 'destructive'
            });
            return;
          }
          
          toast({
            title: 'Contract Error',
            description: error.message || 'Failed to call contract method',
            variant: 'destructive'
          });
          return;
        }
      }
      
      // Fallback to mock resolution for demo mode
      if (demoRunning) {
        // Simulating the contract call delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Update local state to reflect the bet resolution
        setActiveBets(prevBets => 
          prevBets.map(b => 
            b.id === bet.id 
              ? { ...b, isResolved: true, isActive: false, didCreatorWin: creatorWon } 
              : b
          )
        );
        
        toast({
          title: 'Bet Resolved (Demo)',
          description: `Bet resolved successfully. ${creatorWon ? 'Creator won!' : 'Creator lost!'}`,
          variant: creatorWon ? 'success' : 'default'
        });
      }
    } catch (error) {
      console.error('Error resolving bet:', error);
      toast({
        title: 'Error',
        description: 'Failed to resolve bet',
        variant: 'destructive'
      });
    } finally {
      setResolvingBet(null);
    }
  };

  // Auto-demo functionality - run through the whole process automatically
  const runDemo = async () => {
    setDemoRunning(true);
    
    // Reset state
    setActiveBets([]);
    setGameResults([]);
    
    // Step 1: Load bets
    toast({
      title: 'Demo',
      description: 'Loading active bets...',
    });
    await loadActiveBets();
    
    // Step 2: Wait a moment then fetch game results
    await new Promise(resolve => setTimeout(resolve, 2000));
    toast({
      title: 'Demo',
      description: 'Fetching game results...',
    });
    await fetchGameResults();
    
    // Step 3: Wait a moment then resolve the bet
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const bets = generateMockBets();
    
    toast({
      title: 'Demo',
      description: 'Resolving bet...',
    });
    
    await resolveBet(bets[0]);
    
    toast({
      title: 'Demo Complete',
      description: 'Bet has been resolved via Oracle',
      variant: 'success'
    });
    
    setDemoRunning(false);
  };

  // Load bets when component mounts
  useEffect(() => {
    if (betManagerContract || demoRunning) {
      loadActiveBets();
    }
  }, [betManagerContract, demoRunning]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Bet Resolver</h2>
        <div className="space-x-2">
          <Button 
            onClick={loadActiveBets} 
            variant="outline" 
            disabled={loading || demoRunning}
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh Bets
          </Button>
          <Button 
            onClick={fetchGameResults}
            disabled={loading || demoRunning}
          >
            Fetch Game Results
          </Button>
          <Button 
            onClick={runDemo}
            variant="secondary"
            disabled={loading || demoRunning}
          >
            <PlayCircle className="h-4 w-4 mr-2" />
            Run Demo
          </Button>
        </div>
      </div>

      {gameResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Game Results</CardTitle>
            <CardDescription>Latest results from sports games (Oracle verified)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {gameResults.map((game) => (
                <div key={game.gameId} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">MLB: {game.awayTeam.name} vs {game.homeTeam.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{game.homeScore} - {game.awayScore}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Active Bets</CardTitle>
          <CardDescription>Bets waiting to be resolved via Oracle</CardDescription>
        </CardHeader>
        <CardContent>
          {activeBets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-4">No active bets found</p>
              {!gameResults.length && (
                <Button
                  onClick={loadActiveBets}
                  variant="outline"
                  size="sm"
                  disabled={loading || demoRunning}
                >
                  Load Demo Bets
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {activeBets.map((bet) => {
                const gameResult = gameResults.find(result => result.gameId === bet.gameId);
                
                return (
                  <div key={bet.id} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <p className="font-medium">MLB: {bet.team.name} vs {gameResult?.homeTeam.name || 'Minnesota Twins'}</p>
                      </div>
                      <Badge variant={bet.isResolved ? (bet.didCreatorWin ? "success" : "destructive") : "outline"}>
                        {bet.isResolved ? (bet.didCreatorWin ? "Won" : "Lost") : "Active"}
                      </Badge>
                    </div>
                    
                    <div className="space-y-3 mb-3">
                      <div className="bg-gray-50 p-3 rounded-md">
                        <p className="font-medium">Outcome Prediction:</p>
                        <p>{bet.team.name} will score more than {bet.points} points</p>
                      </div>
                      
                      <div>
                        <p className="font-medium">Amount:</p>
                        <p>{bet.amount} ETH</p>
                      </div>
                      
                      <div>
                        <p className="font-medium">Creator:</p>
                        <p>{formatAddress(bet.creator)} (You)</p>
                      </div>
                      
                      <div>
                        <p className="font-medium">Joiner:</p>
                        <p>{formatAddress(bet.joiner)}</p>
                      </div>
                      
                      <div>
                        <p className="font-medium">{bet.isResolved ? 'Result:' : 'Waiting for settlement'}</p>
                        <p>Total pot: {parseFloat(bet.amount) * 2} ETH</p>
                      </div>
                    </div>
                    
                    {gameResult && !bet.isResolved && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-md">
                        <p className="text-sm mb-1">Game Result (Oracle Verified):</p>
                        <p className="font-medium">
                          {gameResult.homeTeam.name} {gameResult.homeScore} - {gameResult.awayScore} {gameResult.awayTeam.name}
                        </p>
                        <p className="text-sm mt-1">
                          {bet.team.name} scored {bet.team.id === gameResult.awayTeam.id ? gameResult.awayScore : gameResult.homeScore} points
                          {(bet.team.id === gameResult.awayTeam.id ? gameResult.awayScore : gameResult.homeScore) > bet.points ? 
                            " (More than " + bet.points + " ✓)" : 
                            " (Not more than " + bet.points + " ✗)"}
                        </p>
                      </div>
                    )}
                    
                    {gameResult && !bet.isResolved && !demoRunning && (
                      <div className="mt-3 flex justify-end">
                        <Button
                          onClick={() => resolveBet(bet)}
                          disabled={loading || resolvingBet === bet.id}
                        >
                          {resolvingBet === bet.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Resolving via Oracle...
                            </>
                          ) : (
                            <>Resolve with Oracle</>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <p className="text-sm text-gray-500">
            {activeBets.filter(b => !b.isResolved).length} bet(s) available to resolve
          </p>
          <Button 
            variant="default"
            onClick={() => {
              activeBets.forEach(bet => {
                const gameResult = gameResults.find(result => result.gameId === bet.gameId);
                if (gameResult && gameResult.status === 'completed' && !bet.isResolved) {
                  resolveBet(bet);
                }
              });
            }}
            disabled={loading || activeBets.length === 0 || gameResults.length === 0 || demoRunning}
          >
            Resolve All with Oracle
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// Helper function to format addresses
function formatAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
} 