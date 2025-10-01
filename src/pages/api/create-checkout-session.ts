// This is a mock API endpoint for development
// In production, this should be a secure backend endpoint

export async function POST(request: Request) {
  const body = await request.json();
  const { planId, priceInCents, userEmail, successUrl, cancelUrl } = body;

  // Mock session ID for development
  const sessionId = `cs_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // In production, you would:
  // 1. Create a Stripe Checkout Session using the Stripe SDK
  // 2. Store the session in your database
  // 3. Return the actual session ID

  return new Response(JSON.stringify({ sessionId }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function GET() {
  return new Response('Method not allowed', { status: 405 });
}
