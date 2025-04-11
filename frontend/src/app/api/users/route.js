import clientPromise from '../../../../lib/mongodb';

export async function GET() {
    try {
      console.log('GET /api/users called');
      const client = await clientPromise;
      const db = client.db('BallandBeerDB');
      const users = await db.collection('users').find({}).toArray();
  
      return Response.json(users);
    } catch (error) {
      console.error('Error in GET /api/users:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

export async function POST(request) {
  const body = await request.json()
  const client = await clientPromise
  const db = client.db('BallandBeerDB')
  const result = await db.collection('users').insertOne(body)

  return Response.json(result)
}
