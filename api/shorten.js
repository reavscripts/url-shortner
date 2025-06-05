// api/shorten.js
import { createClient } from '@supabase/supabase-js';
// NON importare customAlphabet qui se usi dynamic import sotto
// import { customAlphabet } from 'nanoid'; // Rimuovi o commenta questa riga!

// Inizializza Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Rimuovi la definizione qui se la sposti nel try/catch
// const generateShortId = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 7);


export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { long_url } = req.body;

    if (!long_url || !long_url.startsWith('http://') && !long_url.startsWith('https://')) {
        return res.status(400).json({ message: 'Invalid URL provided. Please ensure it starts with http:// or https://' });
    }

    try {
        // Esegui il dynamic import QUI DENTRO la funzione
        const { customAlphabet } = await import('nanoid'); // <-- NUOVA RIGA
        const generateShortId = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ012345690', 7); // <-- Usa la funzione appena importata

        // 1. Controlla se l'URL lungo esiste già
        const { data: existingUrl, error: existingError } = await supabase
            .from('short_urls')
            .select('short_id')
            .eq('long_url', long_url)
            .single();

        if (existingUrl) {
            const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:3000`;
            const shortUrl = `${baseUrl}/${existingUrl.short_id}`;
            return res.status(200).json({ shortUrl });
        }

        // 2. Genera un nuovo short ID unico
        let shortId;
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 10;

        while (!isUnique && attempts < maxAttempts) {
            shortId = generateShortId();
            const { data: duplicateId, error: duplicateError } = await supabase
                .from('short_urls')
                .select('short_id')
                .eq('short_id', shortId)
                .single();

            if (!duplicateId || (duplicateError && duplicateError.code === 'PGRST116')) {
                isUnique = true;
            } else if (duplicateError) {
                throw duplicateError;
            }
            attempts++;
        }

        if (!isUnique) {
            return res.status(500).json({ message: 'Failed to generate a unique short ID after multiple attempts.' });
        }

        // 3. Salva nel database
        const { data, error } = await supabase
            .from('short_urls')
            .insert([{ long_url, short_id: shortId }])
            .select();

        if (error) {
            console.error('Supabase insert error:', error);
            return res.status(500).json({ message: 'Error saving URL to database.', error: error.message });
        }

        const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:3000`;
        const shortUrl = `${baseUrl}/${shortId}`;

        res.status(200).json({ shortUrl });

    } catch (error) {
        console.error('Catch all server error in shorten.js:', error);
        res.status(500).json({ message: 'Internal server error.', error: error.message });
    }
}