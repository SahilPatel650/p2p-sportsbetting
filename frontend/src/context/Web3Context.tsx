'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import BetManagerABI from '../contracts/BetManager.json';
import BetOracleRegistryABI from '../contracts/BetOracleRegistry.json';

// Contract addresses - these will be populated after deployment
const BET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_BET_MANAGER_ADDRESS || '';
const BET_ORACLE_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_BET_ORACLE_REGISTRY_ADDRESS || '';

// Debug log
console.log('Contract Addresses:', {
  BET_MANAGER_ADDRESS,
  BET_ORACLE_REGISTRY_ADDRESS,
  ALL_ENV: process.env
});

// Sepolia Chain ID
const SEPOLIA_CHAIN_ID = 11155111;

interface Web3ContextProps {
  account: string | null;
  chainId: number | null;
  isConnected: boolean;
  isLoading: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  betManager: ethers.Contract | null;
  oracleRegistry: ethers.Contract | null;
  isCorrectNetwork: boolean;
  switchNetwork: () => Promise<void>;
}

const Web3Context = createContext<Web3ContextProps>({
  account: null,
  chainId: null,
  isConnected: false,
  isLoading: false,
  connect: async () => {},
  disconnect: () => {},
  betManager: null,
  oracleRegistry: null,
  isCorrectNetwork: false,
  switchNetwork: async () => {},
});

export function Web3Provider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [betManager, setBetManager] = useState<ethers.Contract | null>(null);
  const [oracleRegistry, setOracleRegistry] = useState<ethers.Contract | null>(null);

  // Check if user has MetaMask installed
  const checkIfMetaMaskInstalled = () => {
    return typeof window !== 'undefined' && window.ethereum !== undefined;
  };

  // Connect to MetaMask
  const connect = async () => {
    if (!checkIfMetaMaskInstalled()) {
      console.error('MetaMask is not installed!');
      return;
    }

    setIsLoading(true);
    try {
      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      
      // Setup provider and signer
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      setAccount(accounts[0]);
      setChainId(parseInt(chainId, 16));
      setProvider(provider);
      setSigner(signer);
      setIsConnected(true);
      
      // Initialize contracts if addresses are available
      if (BET_MANAGER_ADDRESS && BET_ORACLE_REGISTRY_ADDRESS) {
        const betManagerContract = new ethers.Contract(
          BET_MANAGER_ADDRESS,
          BetManagerABI.abi,
          signer
        );
        const oracleRegistryContract = new ethers.Contract(
          BET_ORACLE_REGISTRY_ADDRESS,
          BetOracleRegistryABI.abi,
          signer
        );
        
        setBetManager(betManagerContract);
        setOracleRegistry(oracleRegistryContract);
      }
    } catch (error) {
      console.error('Error connecting to MetaMask:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Disconnect from MetaMask
  const disconnect = () => {
    setAccount(null);
    setChainId(null);
    setProvider(null);
    setSigner(null);
    setBetManager(null);
    setOracleRegistry(null);
    setIsConnected(false);
  };

  // Check if connected to the correct network (Sepolia)
  const isCorrectNetwork = chainId === SEPOLIA_CHAIN_ID;

  // Switch to Sepolia network
  const switchNetwork = async () => {
    if (!checkIfMetaMaskInstalled()) return;
    
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }], // Sepolia's chainId in hex
      });
    } catch (error: any) {
      // If the chain hasn't been added to MetaMask
      if (error.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0xaa36a7',
                chainName: 'Sepolia Testnet',
                nativeCurrency: {
                  name: 'SepoliaETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: ['https://sepolia.infura.io/v3/'],
                blockExplorerUrls: ['https://sepolia.etherscan.io/'],
              },
            ],
          });
        } catch (addError) {
          console.error('Error adding Sepolia network to MetaMask:', addError);
        }
      } else {
        console.error('Error switching networks:', error);
      }
    }
  };

  // Setup event listeners for MetaMask
  useEffect(() => {
    if (!checkIfMetaMaskInstalled()) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // User has disconnected all accounts
        disconnect();
      } else if (accounts[0] !== account) {
        setAccount(accounts[0]);
      }
    };

    const handleChainChanged = (chainId: string) => {
      setChainId(parseInt(chainId, 16));
      // Refresh the page on chain change per MetaMask's recommendation
      window.location.reload();
    };

    const handleConnect = () => {
      connect();
    };

    const handleDisconnect = () => {
      disconnect();
    };

    // Subscribe to MetaMask events
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    window.ethereum.on('connect', handleConnect);
    window.ethereum.on('disconnect', handleDisconnect);

    // Auto-connect if already authorized
    const checkConnection = async () => {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        connect();
      }
    };
    checkConnection();

    // Cleanup event listeners
    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
      window.ethereum.removeListener('connect', handleConnect);
      window.ethereum.removeListener('disconnect', handleDisconnect);
    };
  }, [account]);

  return (
    <Web3Context.Provider
      value={{
        account,
        chainId,
        isConnected,
        isLoading,
        connect,
        disconnect,
        betManager,
        oracleRegistry,
        isCorrectNetwork,
        switchNetwork,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  return useContext(Web3Context);
}

// Add type definitions for window.ethereum
declare global {
  interface Window {
    ethereum: any;
  }
} 