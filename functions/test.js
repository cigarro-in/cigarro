// Simple test function
export async function onRequest(context) {
  console.log('TEST FUNCTION CALLED!');
  return new Response(JSON.stringify({ 
    message: 'Test function works!',
    method: context.request.method,
    url: context.request.url
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
