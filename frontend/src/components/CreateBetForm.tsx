'use client';

import { useState } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '@/context/Web3Context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export function CreateBetForm() {
  const { betManager, isConnected, isCorrectNetwork } = useWeb3();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('0.01');
  const [daysUntilDeadline, setDaysUntilDeadline] = useState('7');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate deadline timestamp from days
  const calculateDeadline = () => {
    const now = Math.floor(Date.now() / 1000); // current timestamp in seconds
    const days = parseInt(daysUntilDeadline) || 7;
    return now + (days * 24 * 60 * 60); // add days in seconds
  };

  const handleCreateBet = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!isCorrectNetwork) {
      toast.error('Please switch to Sepolia network');
      return;
    }

    if (!betManager) {
      toast.error('Betting contract not initialized');
      return;
    }

    if (!description) {
      toast.error('Please enter a bet description');
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
      
      // Create the bet transaction
      const tx = await betManager.createBet(description, deadline, {
        value: amountInWei
      });
      
      toast.info('Transaction submitted. Waiting for confirmation...');
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        toast.success('Bet created successfully!');
        // Reset form
        setDescription('');
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Bet</CardTitle>
        <CardDescription>Place a stake and challenge others to a sports bet</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCreateBet} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              Bet Description
            </label>
            <Input
              id="description"
              placeholder="Lakers vs Warriors, Lakers will win"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
            <p className="text-xs text-gray-500">
              Be specific about the event and outcome you're betting on
            </p>
          </div>
          
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
          
          <CardFooter className="px-0 pt-4">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={!isConnected || !isCorrectNetwork || isSubmitting}
            >
              {isSubmitting ? 'Creating Bet...' : 'Create Bet'}
            </Button>
          </CardFooter>
        </form>
      </CardContent>
    </Card>
  );
} 