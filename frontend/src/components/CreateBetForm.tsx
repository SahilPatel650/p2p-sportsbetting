'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '@/context/Web3Context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { EventBus } from '@/components/SportsEventsList';

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

export function CreateBetForm() {
  const { betManager, isConnected, isCorrectNetwork } = useWeb3();
  const [amount, setAmount] = useState('0.01');
  const [daysUntilDeadline, setDaysUntilDeadline] = useState('7');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [events, setEvents] = useState<SportsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SportsEvent | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [threshold, setThreshold] = useState<string>('100');
  const [betType, setBetType] = useState<'more' | 'less'>('more');

  const calculateDeadline = () => {
    const days = parseInt(daysUntilDeadline) || 7;
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_SPORTS_API_URL || "";
      

      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`API request failed`);
      }
      
      const data: SportsEvent[] = await response.json();
      
      const sortedEvents = data.sort((a, b) => 
        new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime()
      );
      
      const filteredEvents = sortedEvents.filter(event => 
        event.bookmakers && 
        event.bookmakers.length > 0 && 
        event.bookmakers[0].markets && 
        event.bookmakers[0].markets.length > 0 &&
        event.bookmakers[0].markets[0].outcomes &&
        event.bookmakers[0].markets[0].outcomes.length > 0
      );
      
      setEvents(filteredEvents);
      setLoading(false);
      
    } catch (err: any) {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents().then(() => {
      
      if (EventBus.selectedEvent) {
        setSelectedEvent(EventBus.selectedEvent);
        EventBus.setSelectedEvent(null);
        return;
      }
      
      try {
        const storedEvent = localStorage.getItem('selectedSportsEvent');
        if (storedEvent) {
          const parsedEvent = JSON.parse(storedEvent);
          setSelectedEvent(parsedEvent);
          localStorage.removeItem('selectedSportsEvent');
        }
      } catch (error) {
        console.error("Local cache error", error);
      }
    });
  }, []);

  const handleEventSelect = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (event) {
      setSelectedEvent(event);
      setSelectedTeam('');
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  const handleCreateBet = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }


    if (!betManager) {
      toast.error('Betting contract not initialized');
      return;
    }

    if (!selectedEvent) {
      toast.error('Please select a sports event');
      return;
    }

    if (!selectedTeam) {
      toast.error('Please select a team');
      return;
    }

    const thresholdValue = parseInt(threshold);
    if (isNaN(thresholdValue) || thresholdValue <= 0) {
      toast.error('Please enter a valid threshold');
      return;
    }

    const amountInEth = parseFloat(amount);
    if (isNaN(amountInEth) || amountInEth <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    try {
      const deadline = calculateDeadline();
      const amountInWei = ethers.parseEther(amount);
      
      const description = `${selectedEvent.sport_title}: ${selectedEvent.home_team} vs ${selectedEvent.away_team} - ${selectedTeam} will score ${betType} than ${threshold} points`;
      
      const tx = await betManager.createBet(
        description, 
        deadline,
        `${selectedEvent.sport_title}: ${selectedEvent.home_team} vs ${selectedEvent.away_team}`,
        selectedTeam,
        thresholdValue,
        betType === 'more',
        {
          value: amountInWei
        }
      );
      
      toast.info('Transaction submitted. Waiting for confirmation...');
      
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        toast.success('Bet created successfully!');
        setSelectedEvent(null);
        setSelectedTeam('');
        setThreshold('100');
        setBetType('more');
        setAmount('0.01');
        setDaysUntilDeadline('7');
      } else {
        toast.error('Transaction failed');
      }
    } catch (error: any) {
      console.error('Error creating bet:', error);
      toast.error(error.message || 'Failed to create bet');
    } finally {
      setIsSubmitting(false);
    }
  };

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
    <Card>
      <CardHeader>
        <CardTitle>Create New Sports Bet</CardTitle>
        <CardDescription>Place a stake and challenge others to a sports bet</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCreateBet} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="event" className="text-sm font-medium">
              Select Game
            </label>
            <Select 
              onValueChange={handleEventSelect} 
              value={selectedEvent?.id || ''}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a game" />
              </SelectTrigger>
              <SelectContent>
                {events.length === 0 ? (
                  <SelectItem value="none" disabled>No games available</SelectItem>
                ) : (
                  events.map(event => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.home_team} vs {event.away_team} ({formatDate(event.commence_time)})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          
          {selectedEvent && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Select Team
              </label>
              <RadioGroup 
                value={selectedTeam} 
                onValueChange={setSelectedTeam}
                className="flex flex-col space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value={selectedEvent.home_team} id="home-team" />
                  <Label htmlFor="home-team">{selectedEvent.home_team} (Home)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value={selectedEvent.away_team} id="away-team" />
                  <Label htmlFor="away-team">{selectedEvent.away_team} (Away)</Label>
                </div>
              </RadioGroup>
            </div>
          )}
          
          {selectedTeam && (
            <div className="space-y-2">
              <label htmlFor="threshold" className="text-sm font-medium">
                Points Threshold
              </label>
              <Input
                id="threshold"
                type="number"
                placeholder="100"
                min="1"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                required
              />
              <p className="text-xs text-gray-500">
                Set the threshold for the number of points
              </p>
            </div>
          )}
          
          {selectedTeam && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Bet Type
              </label>
              <RadioGroup 
                value={betType} 
                onValueChange={(value: string) => setBetType(value as 'more' | 'less')}
                className="flex space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="more" id="more" />
                  <Label htmlFor="more">More Than</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="less" id="less" />
                  <Label htmlFor="less">Less Than</Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-gray-500">
                {selectedTeam} will score {betType} than {threshold} points
              </p>
            </div>
          )}
          
          <div className="space-y-2">
            <label htmlFor="amount" className="text-sm font-medium">
              Stake Amount (ETH)
            </label>
            <Input
              id="amount"
              type="number"
              placeholder="0.01"
              min="0.001"
              step="0.001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="deadline" className="text-sm font-medium">
              Deadline (days)
            </label>
            <Input
              id="deadline"
              type="number"
              placeholder="7"
              min="1"
              max="30"
              value={daysUntilDeadline}
              onChange={(e) => setDaysUntilDeadline(e.target.value)}
              required
            />
            <p className="text-xs text-gray-500">
              The bet must be settled before this deadline, or a refund can be claimed
            </p>
          </div>
          
          {selectedEvent && selectedTeam && (
            <div className="p-4 bg-gray-50 rounded-md">
              <h3 className="font-medium mb-2">Bet Preview</h3>
              <p className="text-sm">
                {selectedEvent.sport_title}: {selectedEvent.home_team} vs {selectedEvent.away_team}<br />
                {selectedTeam} will score {betType} than {threshold} points<br />
                Stake Amount: {amount} ETH
              </p>
            </div>
          )}
          
          <CardFooter className="px-0 pt-4">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={!isConnected || !isCorrectNetwork || isSubmitting || !selectedEvent || !selectedTeam}
            >
              {isSubmitting ? 'Creating Bet...' : 'Create Bet'}
            </Button>
          </CardFooter>
        </form>
      </CardContent>
    </Card>
  );
} 