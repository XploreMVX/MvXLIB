import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

// Connexion à la base de données Supabase
const sql = postgres(process.env.DATABASE_URL || '');

export async function POST(req: NextRequest) {
  try {
    // Récupérer le token d'authentification depuis le cookie
    const authToken = req.cookies.get('auth_token')?.value;

    if (authToken) {
      // Invalider la session dans la base de données
      await sql`
        UPDATE "sessions"
        SET expires_at = NOW()
        WHERE token = ${authToken}
      `;
    }

    // Créer la réponse et supprimer le cookie d'authentification
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });
    
    response.cookies.delete('auth_token');
    
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Failed to logout' }, { status: 500 });
  }
} 