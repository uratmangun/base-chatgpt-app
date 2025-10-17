import { NextRequest, NextResponse } from 'next/server';
import { CdpClient } from '@coinbase/cdp-sdk';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, network, token } = body;

    // Validate inputs
    if (!address || !network || !token) {
      return NextResponse.json(
        { error: 'Missing required parameters: address, network, token' },
        { status: 400 }
      );
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: 'Invalid Ethereum address format' },
        { status: 400 }
      );
    }

    // Validate network
    if (network !== 'base-sepolia') {
      return NextResponse.json(
        { error: 'Only base-sepolia network is supported' },
        { status: 400 }
      );
    }

    // Validate token
    const validTokens = ['eth', 'usdc', 'eurc', 'cbbtc'];
    if (!validTokens.includes(token.toLowerCase())) {
      return NextResponse.json(
        { error: `Invalid token. Supported tokens: ${validTokens.join(', ')}` },
        { status: 400 }
      );
    }

    // Check for CDP API credentials
    const cdpApiKeyId = process.env.CDP_API_KEY_ID;
    const cdpApiKeySecret = process.env.CDP_API_KEY_SECRET;

    if (!cdpApiKeyId || !cdpApiKeySecret) {
      return NextResponse.json(
        { error: 'CDP API credentials not configured on server' },
        { status: 500 }
      );
    }

    // Initialize CDP client
    const cdp = new CdpClient();

    // Request faucet funds
    const faucetResponse = await cdp.evm.requestFaucet({
      address,
      network,
      token: token.toLowerCase(),
    });

    // Return success response
    return NextResponse.json({
      success: true,
      transactionHash: faucetResponse.transactionHash,
      address,
      network,
      token: token.toLowerCase(),
      explorerLink: `https://sepolia.basescan.org/tx/${faucetResponse.transactionHash}`,
    });
  } catch (error: any) {
    console.error('Faucet request error:', error);
    
    // Handle rate limit errors
    if (error.message?.includes('rate limit') || error.message?.includes('quota')) {
      return NextResponse.json(
        { error: 'Faucet rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to request faucet funds' },
      { status: 500 }
    );
  }
}
