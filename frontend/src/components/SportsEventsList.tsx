'use client';

import { useState, useEffect } from 'react';
import { useWeb3 } from '@/context/Web3Context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ethers } from 'ethers';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

// Define types for the API response
interface Outcome {
  name: string;
  price: number;
}

interface Market {
  key: string;
  last_update: string;
  outcomes: Outcome[];
}

interface Bookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: Market[];
}

interface SportsEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Bookmaker[];
}

export function SportsEventsList() {
  const { betManager, isConnected, isCorrectNetwork } = useWeb3();
  const [events, setEvents] = useState<SportsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBets, setSelectedBets] = useState<Record<string, string>>({});
  const [betAmounts, setBetAmounts] = useState<Record<string, string>>({});
  const [daysUntilDeadline, setDaysUntilDeadline] = useState<Record<string, string>>({});
  const [creatingBets, setCreatingBets] = useState<Record<string, boolean>>({});

  // Format date for display
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  // Format American odds to more readable format
  const formatOdds = (price: number): string => {
    if (price > 0) {
      return `+${price}`;
    }
    return price.toString();
  };

  // Calculate deadline timestamp from days
  const calculateDeadline = (daysStr: string): number => {
    const now = Math.floor(Date.now() / 1000); // current timestamp in seconds
    const days = parseInt(daysStr) || 7;
    return now + (days * 24 * 60 * 60); // add days in seconds
  };

  // Fetch sports events from API
  const fetchEvents = async () => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_SPORTS_API_URL;
      
      if (!apiUrl) {
        throw new Error('Sports API URL not configured');
      }

      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      const data: SportsEvent[] = await response.json();
      
      // Sort events by commence time (soonest first)
      const sortedEvents = data.sort((a, b) => 
        new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime()
      );
      
      // Only keep events with valid bookmakers and markets
      const filteredEvents = sortedEvents.filter(event => 
        event.bookmakers && 
        event.bookmakers.length > 0 && 
        event.bookmakers[0].markets && 
        event.bookmakers[0].markets.length > 0 &&
        event.bookmakers[0].markets[0].outcomes &&
        event.bookmakers[0].markets[0].outcomes.length > 0
      );
      
      // Initialize default bet amounts and deadlines
      const newBetAmounts: Record<string, string> = {};
      const newDaysUntilDeadline: Record<string, string> = {};
      
      filteredEvents.forEach(event => {
        newBetAmounts[event.id] = '0.01';
        newDaysUntilDeadline[event.id] = '7';
      });
      
      setBetAmounts(newBetAmounts);
      setDaysUntilDeadline(newDaysUntilDeadline);
      setEvents(filteredEvents);
      
    } catch (err: any) {
      console.error('Error fetching sports events:', err);
      setError(err.message || 'Failed to fetch sports events');
      toast.error('Failed to load sports events');
    } finally {
      setLoading(false);
    }
  };

  // Create a bet for a sports event
  const createBet = async (event: SportsEvent, teamName: string) => {
    if (!betManager || !isConnected || !isCorrectNetwork) {
      toast.error('Please connect your wallet to Sepolia network');
      return;
    }

    const betAmount = betAmounts[event.id];
    const amountInEth = parseFloat(betAmount);
    
    if (isNaN(amountInEth) || amountInEth <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    // Create bet description
    const description = `${event.sport_title}: ${event.home_team} vs ${event.away_team} - ${teamName} will win`;
    
    // Convert event ID to bytes32 for the blockchain
    // Using the first 32 bytes of the event ID
    const eventId = event.id;
    
    // Set creating state
    setCreatingBets(prev => ({ ...prev, [eventId]: true }));
    
    try {
      const deadline = calculateDeadline(daysUntilDeadline[eventId]);
      const amountInWei = ethers.parseEther(betAmount);
      
      // Create the bet transaction
      const tx = await betManager.createBet(
        description,
        deadline,
        { value: amountInWei }
      );
      
      toast.info('Transaction submitted. Waiting for confirmation...');
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        toast.success('Bet created successfully!');
        // Reset selection
        setSelectedBets(prev => {
          const updated = { ...prev };
          delete updated[eventId];
          return updated;
        });
      } else {
        toast.error('Transaction failed');
      }
    } catch (error: any) {
      console.error('Error creating bet:', error);
      toast.error(error.message || 'Failed to create bet');
    } finally {
      setCreatingBets(prev => ({ ...prev, [eventId]: false }));
    }
  };

  // Load events on component mount
  useEffect(() => {
    fetchEvents();
  }, []);

  // Group events by sport
  const eventsBySport: Record<string, SportsEvent[]> = {};
  events.forEach(event => {
    if (!eventsBySport[event.sport_title]) {
      eventsBySport[event.sport_title] = [];
    }
    eventsBySport[event.sport_title].push(event);
  });

  if (loading) {
    return <div className="p-6 text-center">Loading available sports events...</div>;
  }

  if (error) {
    return (
      <Card className="bg-red-50">
        <CardHeader>
          <CardTitle>Error Loading Sports Events</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{error}</p>
          <Button onClick={fetchEvents} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Available Sports Events</h2>
        <Button onClick={fetchEvents} variant="outline" size="sm">
          Refresh
        </Button>
      </div>

      {Object.keys(eventsBySport).length === 0 ? (
        <Card>
          <CardContent className="py-4">
            <p className="text-center text-gray-500">No sports events available right now.</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(eventsBySport).map(([sportTitle, sportEvents]) => (
          <div key={sportTitle} className="space-y-4">
            <h3 className="text-lg font-semibold">{sportTitle}</h3>
            <div className="grid gap-4">
              {sportEvents.map((event) => {
                const market = event.bookmakers[0]?.markets[0];
                const outcomes = market?.outcomes || [];
                const homeTeamOutcome = outcomes.find(o => o.name === event.home_team);
                const awayTeamOutcome = outcomes.find(o => o.name === event.away_team);
                
                return (
                  <Card key={event.id} className="overflow-hidden">
                    <CardHeader className="bg-gray-50">
                      <CardTitle className="text-lg">
                        {event.home_team} vs {event.away_team}
                      </CardTitle>
                      <CardDescription>
                        Start time: {formatDate(event.commence_time)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="grid gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className={`p-3 rounded-lg border-2 cursor-pointer ${selectedBets[event.id] === event.home_team ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                               onClick={() => setSelectedBets({...selectedBets, [event.id]: event.home_team})}>
                            <div className="font-semibold">{event.home_team}</div>
                            {homeTeamOutcome && (
                              <div className={`text-sm ${homeTeamOutcome.price > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                Odds: {formatOdds(homeTeamOutcome.price)}
                              </div>
                            )}
                          </div>
                          <div className={`p-3 rounded-lg border-2 cursor-pointer ${selectedBets[event.id] === event.away_team ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                               onClick={() => setSelectedBets({...selectedBets, [event.id]: event.away_team})}>
                            <div className="font-semibold">{event.away_team}</div>
                            {awayTeamOutcome && (
                              <div className={`text-sm ${awayTeamOutcome.price > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                Odds: {formatOdds(awayTeamOutcome.price)}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {selectedBets[event.id] && (
                          <div className="grid gap-3 mt-2 p-3 bg-gray-50 rounded-lg">
                            <div className="text-sm font-medium">Create a bet on {selectedBets[event.id]}</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label htmlFor={`amount-${event.id}`} className="text-xs">
                                  Stake Amount (ETH)
                                </label>
                                <Input
                                  id={`amount-${event.id}`}
                                  type="number"
                                  placeholder="0.01"
                                  min="0.001"
                                  step="0.001"
                                  value={betAmounts[event.id]}
                                  onChange={(e) => setBetAmounts({
                                    ...betAmounts,
                                    [event.id]: e.target.value
                                  })}
                                />
                              </div>
                              <div>
                                <label htmlFor={`deadline-${event.id}`} className="text-xs">
                                  Deadline (days)
                                </label>
                                <Input
                                  id={`deadline-${event.id}`}
                                  type="number"
                                  placeholder="7"
                                  min="1"
                                  max="30"
                                  value={daysUntilDeadline[event.id]}
                                  onChange={(e) => setDaysUntilDeadline({
                                    ...daysUntilDeadline,
                                    [event.id]: e.target.value
                                  })}
                                />
                              </div>
                            </div>
                            <Button
                              onClick={() => createBet(event, selectedBets[event.id])}
                              disabled={!isConnected || !isCorrectNetwork || creatingBets[event.id]}
                              className="mt-2"
                            >
                              {creatingBets[event.id] ? 'Creating Bet...' : 'Create Bet'}
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
} 