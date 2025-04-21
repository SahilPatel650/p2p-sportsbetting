'use client';

import { useState, useEffect } from 'react';
import { useWeb3 } from '@/context/Web3Context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

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

export const EventBus = {
  selectedEvent: null as SportsEvent | null,
  setSelectedEvent: function(event: SportsEvent | null) {
    this.selectedEvent = event;
    if (event) {
      localStorage.setItem('selectedSportsEvent', JSON.stringify(event));
    } else {
      localStorage.removeItem('selectedSportsEvent');
    }
  }
};

export function SportsEventsList() {
  const { isConnected } = useWeb3();
  const [events, setEvents] = useState<SportsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  const fetchEvents = async () => {
    setLoading(true);
    
    const apiUrl = process.env.NEXT_PUBLIC_SPORTS_API_URL || "";
    


    const response = await fetch(apiUrl);
    
    
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
  };

  useEffect(() => {
    fetchEvents();
  }, []);

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sportEvents.map((event) => (
                <Card key={event.id} className="overflow-hidden bg-white">
                  <CardHeader className="bg-gray-50 p-4">
                    <CardTitle className="text-lg">
                      {event.home_team} vs {event.away_team}
                    </CardTitle>
                    <CardDescription>
                      {formatDate(event.commence_time)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="text-sm text-gray-500">
                      {sportTitle}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className="bg-gray-100 p-2 rounded text-center">
                        <div className="font-semibold">{event.home_team}</div>
                        <div className="text-xs mt-1">Home</div>
                      </div>
                      <div className="bg-gray-100 p-2 rounded text-center">
                        <div className="font-semibold">{event.away_team}</div>
                        <div className="text-xs mt-1">Away</div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-gray-50 justify-center p-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        console.log("Create a Bet clicked for event:", event);
                        
                        EventBus.setSelectedEvent(event);
                        
                        if (typeof (window as any).switchToCreateBetTab === 'function') {
                          console.log("Using global switchToCreateBetTab function");
                          (window as any).switchToCreateBetTab();
                        }
                        
                        let tabElement = document.querySelector('[value="createBet"]');
                        
                        if (!tabElement) {
                          const allTabs = document.querySelectorAll('[role="tab"]');
                          for (let i = 0; i < allTabs.length; i++) {
                            const tab = allTabs[i] as HTMLElement;
                            if (tab.textContent?.includes('Create Bet')) {
                              tabElement = tab;
                              break;
                            }
                          }
                        }
                        
                        if (tabElement) {
                          console.log("Tab element found, clicking it");
                          (tabElement as HTMLElement).click();
                        }
                        
                        console.log("Dispatching custom event");
                        window.dispatchEvent(new CustomEvent('switch-to-create-bet'));
                        
                        window.location.hash = 'create-bet';
                      }}
                    >
                      Create a Bet
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
} 